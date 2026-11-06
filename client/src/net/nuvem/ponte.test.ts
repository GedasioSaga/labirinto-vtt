import { describe, expect, it } from 'vitest'
import { AGORA, F_NAMI, MESTRE_NO_APP, op } from '../../lib/nuvem/campanha.fixture'
import { ponteSobre, transporteDoTauri, type Invocar } from './ponte'

/**
 * O transporte do app contra o formato da R1 (`desktop/src-tauri/src/nuvem.rs`):
 * o `invoke` é falso, mas o pedido e os erros têm a forma exata do Rust.
 */

interface Chamada {
  comando: string
  argumentos: Record<string, unknown> | undefined
}

function invocarFalso(responder: (chamada: Chamada) => unknown): { invocar: Invocar; chamadas: Chamada[] } {
  const chamadas: Chamada[] = []
  return {
    chamadas,
    invocar: async (comando, argumentos) => {
      const chamada = { comando, argumentos }
      chamadas.push(chamada)
      return responder(chamada)
    },
  }
}

describe('ponte da nuvem no app (A5 sobre a R1)', () => {
  it('manda o pedido como a R1 o lê ({ pedido: { rota, campanhaId, ... } }) e lê o 2xx cru', async () => {
    const gravada = { ...op(MESTRE_NO_APP, F_NAMI, ['nome'], 'definir', { valor: 'Nami' }), rev: 1, autorContaId: 'mestre', autorNome: 'Mestre', origem: 'app', atestadoPeloApp: false, quando: AGORA }
    const falso = invocarFalso(({ argumentos }) => {
      const pedido = argumentos?.pedido
      if (typeof pedido === 'object' && pedido !== null && 'rota' in pedido && pedido.rota === 'desde') return { t: 'ops', desde: 0, ate: 1, lista: [gravada], revAtual: 1 }
      return { respostas: [{ t: 'ack', opId: 'op_x', rev: 2 }], revAtual: 2 }
    })
    const ponte = ponteSobre(transporteDoTauri(falso.invocar))

    const desde = await ponte.desde('camp_teste', 0)
    expect(desde).toMatchObject({ t: 'ok', ate: 1, lista: [{ opId: gravada.opId, rev: 1, valor: 'Nami' }] })
    const envio = await ponte.enviarOps('camp_teste', 'cli_app', [op(MESTRE_NO_APP, F_NAMI, ['descricao'], 'definir', { valor: 'x', opId: 'op_x' })])
    expect(envio).toEqual({ t: 'ok', respostas: [{ t: 'ack', opId: 'op_x', rev: 2 }], revAtual: 2 })

    expect(falso.chamadas.map((chamada) => chamada.comando)).toEqual(['nuvem_pedir', 'nuvem_pedir'])
    expect(falso.chamadas[0].argumentos).toEqual({ pedido: { rota: 'desde', campanhaId: 'camp_teste', rev: 0, limite: 500 } })
    expect(Object.keys(falso.chamadas[1].argumentos ?? {})).toEqual(['pedido'])
    expect(falso.chamadas[1].argumentos?.pedido).toMatchObject({ rota: 'ops', campanhaId: 'camp_teste', corpo: { v: 1, clienteId: 'cli_app' } })
  })

  it('lê os erros da R1: rede = sem rede, 409 de versão = versão, 404 = não existe, credencial recusada = sem credencial', async () => {
    const erros: unknown[] = [
      { codigo: 'rede', mensagem: 'Sem conexão com o Lobby.', status: null, detalhe: null },
      { codigo: 'http', mensagem: 'O Lobby recusou o pedido (409).', status: 409, detalhe: '{"erro":"versao","detalhe":"O servidor usa o formato 2; atualize o app"}' },
      { codigo: 'nao_encontrado', mensagem: 'O Lobby não achou isso.', status: 404, detalhe: '{"erro":"nao-existe"}' },
      { codigo: 'acesso_negado', mensagem: 'O Cloudflare Access recusou a credencial do app.', status: 403, detalhe: '' },
      { codigo: 'servidor', mensagem: 'O Lobby está com problema agora (503).', status: 503, detalhe: '<html>' },
    ]
    let vez = 0
    const ponte = ponteSobre(
      transporteDoTauri(async () => {
        throw erros[vez++]
      }),
    )
    const resultados = []
    for (let i = 0; i < erros.length; i += 1) resultados.push((await ponte.desde('camp_teste', 3)).t)
    expect(resultados).toEqual(['sem-rede', 'versao', 'nao-existe', 'sem-credencial', 'sem-rede'])
  })
})
