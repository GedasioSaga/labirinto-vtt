import { describe, expect, it, vi } from 'vitest'
import { criarSaidaEmOrdem } from '../pacoteComprimido'
import type { MensagemDoHost } from './protocoloDoCanal'
import { CARACTERES_POR_MS_DO_IPC, criarTransporteLocal } from './transporteLocal'

/**
 * O "Rust" da ponte de teste: os comandos e eventos que `hostBridge.ts` usa,
 * atendidos em memória e falando com a janela pelo canal.
 */

const SESSAO = 'sessao-de-teste-1'

function monta(geracao = 1) {
  const enviadas: MensagemDoHost[] = []
  const transporte = criarTransporteLocal({ sessao: SESSAO, geracao, codigo: 'ABC234', enviar: (m) => enviadas.push(m) })
  return { transporte, enviadas }
}

/** Uma volta da fila de microtarefas: o `net:peer` do `net_kick` sai depois de o comando voltar. */
const proximaVolta = () => Promise.resolve()

describe('transporteLocal', () => {
  it('net_start_room devolve a sala com o código combinado, sem links nem QR', async () => {
    const { transporte } = monta()
    await expect(transporte.invoke('net_start_room', { preferredCode: 'ZZZ999' })).resolves.toEqual({ code: 'ABC234', urls: [], qrSvg: '' })
  })

  it('abrir vira o clientId teste-<n>: a janela recebe `aberto` e as mensagens dela viram net:message', async () => {
    const { transporte, enviadas } = monta()
    const mensagens = vi.fn()
    await transporte.listen('net:message', mensagens)

    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 3 })
    transporte.receber({ de: 'janela', tipo: 'msg', sessao: SESSAO, conexao: 3, data: '{"type":"ping"}' })

    expect(enviadas).toEqual([{ de: 'host', tipo: 'aberto', sessao: SESSAO, conexao: 3 }])
    // Como o Rust: o objeto JSON já lido, não o texto.
    expect(mensagens).toHaveBeenCalledWith({ payload: { clientId: 'teste-3', msg: { type: 'ping' } } })
  })

  it('net_send leva a mensagem à conexão daquele clientId; conexão desconhecida não é erro', async () => {
    const { transporte, enviadas } = monta()
    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 1 })

    await transporte.invoke('net_send', { clientId: 'teste-1', msg: { type: 'welcome' } })
    await expect(transporte.invoke('net_send', { clientId: 'teste-9', msg: { type: 'welcome' } })).resolves.toBeUndefined()

    expect(enviadas.at(-1)).toEqual({ de: 'host', tipo: 'msg', sessao: SESSAO, conexao: 1, msg: { type: 'welcome' } })
    expect(enviadas).toHaveLength(2)
  })

  it('fechar-conexao vira net:peer disconnected, e o que a ponte mandar depois se perde', async () => {
    const { transporte, enviadas } = monta()
    const pares = vi.fn()
    await transporte.listen('net:peer', pares)
    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 1 })

    transporte.receber({ de: 'janela', tipo: 'fechar-conexao', sessao: SESSAO, conexao: 1 })
    await transporte.invoke('net_send', { clientId: 'teste-1', msg: { type: 'snapshot' } })

    expect(pares).toHaveBeenCalledWith({ payload: { clientId: 'teste-1', event: 'disconnected' } })
    expect(enviadas).toHaveLength(1)
  })

  it('net_kick derruba a conexão na janela e avisa a queda depois, como o Rust', async () => {
    const { transporte, enviadas } = monta()
    const pares = vi.fn()
    await transporte.listen('net:peer', pares)
    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 2 })

    await transporte.invoke('net_kick', { clientId: 'teste-2' })
    await proximaVolta()

    expect(enviadas.at(-1)).toEqual({ de: 'host', tipo: 'derrubar', sessao: SESSAO, conexao: 2 })
    expect(pares).toHaveBeenCalledWith({ payload: { clientId: 'teste-2', event: 'disconnected' } })
  })

  it('abrir de outra geração é de uma ponte que já acabou: ignorado', () => {
    const { transporte, enviadas } = monta(2)
    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 1 })
    expect(enviadas).toEqual([])
  })

  it('o link público não existe no teste, e comando desconhecido é recusado', async () => {
    const { transporte } = monta()
    await expect(transporte.invoke('net_start_tunnel')).rejects.toThrow('link público')
    await expect(transporte.invoke('grant_fs_access')).rejects.toThrow('desconhecido')
    await expect(transporte.invoke('net_stop_room')).resolves.toBeUndefined()
  })

  it('desligado, nada mais chega à janela nem vira evento', async () => {
    const { transporte, enviadas } = monta()
    const mensagens = vi.fn()
    await transporte.listen('net:message', mensagens)
    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 1 })

    transporte.desligar()
    await transporte.invoke('net_send', { clientId: 'teste-1', msg: { type: 'room.closed' } })
    transporte.receber({ de: 'janela', tipo: 'msg', sessao: SESSAO, conexao: 1, data: '{"type":"ping"}' })

    expect(enviadas).toHaveLength(1)
    expect(mensagens).not.toHaveBeenCalled()
  })

  it('o desligar do listen tira o ouvinte', async () => {
    const { transporte } = monta()
    const mensagens = vi.fn()
    const parar = await transporte.listen('net:message', mensagens)
    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 1 })

    parar()
    transporte.receber({ de: 'janela', tipo: 'msg', sessao: SESSAO, conexao: 1, data: '{}' })

    expect(mensagens).not.toHaveBeenCalled()
  })
})

/**
 * COMO O RUST (análise 18/11/2026, 2.2, e o "F5 tira da batalha"): cada `net_send` é uma tarefa solta que atravessa
 * o IPC pelo tamanho. A corrida que o conserto `sempreEmFila` fecha aparece aqui sem a sala real.
 */
describe('transporteLocal como o Rust', () => {
  /** ~8 ms de IPC: o snapshot com o mapa grande. */
  const SNAPSHOT_GRANDE = { type: 'snapshot', map: 'x'.repeat(8 * CARACTERES_POR_MS_DO_IPC) }
  const ESTADO_DA_BATALHA = { type: 'batalha.estado' }
  const umaVoltaDoRelogio = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

  function montaComoORust() {
    const enviadas: MensagemDoHost[] = []
    const transporte = criarTransporteLocal({ sessao: SESSAO, geracao: 1, codigo: 'ABC234', comoORust: true, enviar: (m) => enviadas.push(m) })
    transporte.receber({ de: 'janela', tipo: 'abrir', sessao: SESSAO, geracao: 1, conexao: 1 })
    const tiposQueChegaram = () => enviadas.flatMap((m) => (m.tipo === 'msg' && 'type' in m.msg && typeof m.msg.type === 'string' ? [m.msg.type] : []))
    return { transporte, tiposQueChegaram }
  }

  it('duas chamadas soltas: o estado da batalha logo depois do snapshot grande chega ANTES dele (a corrida)', async () => {
    const { transporte, tiposQueChegaram } = montaComoORust()
    await Promise.all([
      transporte.invoke('net_send', { clientId: 'teste-1', msg: SNAPSHOT_GRANDE }),
      transporte.invoke('net_send', { clientId: 'teste-1', msg: ESTADO_DA_BATALHA }),
    ])
    await umaVoltaDoRelogio()
    expect(tiposQueChegaram()).toEqual(['batalha.estado', 'snapshot'])
  })

  it('pela saída em ordem da ponte (sempreEmFila), a mesma dupla chega na ordem em que saiu', async () => {
    const { transporte, tiposQueChegaram } = montaComoORust()
    const enviar = criarSaidaEmOrdem(
      async (clientId, carga) => {
        await transporte.invoke('net_send', { clientId, msg: carga })
      },
      { sempreEmFila: true },
    )
    await Promise.all([enviar('teste-1', SNAPSHOT_GRANDE, false), enviar('teste-1', ESTADO_DA_BATALHA, false)])
    await umaVoltaDoRelogio()
    expect(tiposQueChegaram()).toEqual(['snapshot', 'batalha.estado'])
  })
})
