import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InvokeArgs } from '@tauri-apps/api/core'
import { criarJanelaDoNavegador, criarJanelaTauri, EVENTO_JANELA_FECHADA, PAGINA_DA_JANELA } from './janela'

/**
 * A janela de teste pelos comandos do Rust e, no navegador, pelo popup. O
 * ponto delicado é o evento "fechada", que não diz QUAL janela morreu: a
 * janela trocada num `abrir` também o dispara, antes ou depois de o comando
 * responder, e isso não pode matar a sessão nova.
 */

interface Chamada {
  cmd: string
  args: InvokeArgs | undefined
}

function promessaPendente<T>() {
  let resolver: (valor: T) => void = () => {}
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

/** Esvazia a fila de microtarefas (as conferências encadeiam alguns `await`). */
async function assentar(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function montaTauri(opcoes: { existe?: () => boolean } = {}) {
  const chamadas: Chamada[] = []
  let aoFechar: ((event: { payload: unknown }) => void) | null = null
  const abrirPendente: { atual: ReturnType<typeof promessaPendente<void>> | null } = { atual: null }
  const aoFecharPorFora = vi.fn()
  const janela = criarJanelaTauri({
    invoke: async (cmd, args) => {
      chamadas.push({ cmd, args })
      if (cmd === 'abrir_visao_jogador' && abrirPendente.atual !== null) await abrirPendente.atual.promessa
      if (cmd === 'mostrar_visao_jogador') return opcoes.existe?.() ?? false
      return undefined
    },
    listen: async (evento, handler) => {
      if (evento === EVENTO_JANELA_FECHADA) aoFechar = handler
      return () => {
        aoFechar = null
      }
    },
    aoFecharPorFora,
  })
  const emitirFechada = () => aoFechar?.({ payload: null })
  return { janela, chamadas, aoFecharPorFora, emitirFechada, abrirPendente }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('janela de teste no app (Tauri)', () => {
  it('abrir manda a sessão ao Rust; o X do sistema fecha a sessão quando a janela não existe mais', async () => {
    const { janela, chamadas, aoFecharPorFora, emitirFechada } = montaTauri({ existe: () => false })
    await assentar()
    await janela.abrir('sessao-123456')
    expect(chamadas).toEqual([{ cmd: 'abrir_visao_jogador', args: { sessao: 'sessao-123456' } }])

    emitirFechada()
    await assentar()

    expect(aoFecharPorFora).toHaveBeenCalledTimes(1)
  })

  it('CORRIDA: o "fechada" da janela trocada no meio do abrir não mata a sessão nova', async () => {
    const { janela, aoFecharPorFora, emitirFechada, abrirPendente } = montaTauri({ existe: () => true })
    await assentar()
    await janela.abrir('sessao-antiga1')

    // Abrir de novo com a janela velha viva: o Rust a destrói e o evento dela chega ANTES do comando voltar…
    abrirPendente.atual = promessaPendente<void>()
    const abrindo = janela.abrir('sessao-nova-02')
    emitirFechada()
    await assentar()
    abrirPendente.atual.resolver()
    await abrindo
    // …ou DEPOIS: o Rust confirma que há janela viva, e o evento era da trocada.
    emitirFechada()
    await assentar()

    expect(aoFecharPorFora).not.toHaveBeenCalled()
  })

  it('quem fecha pelo controlador não recebe o aviso de volta', async () => {
    const { janela, chamadas, aoFecharPorFora, emitirFechada } = montaTauri({ existe: () => false })
    await assentar()
    await janela.abrir('sessao-123456')

    await janela.fechar()
    emitirFechada()
    await assentar()

    expect(chamadas.map((c) => c.cmd)).toEqual(['abrir_visao_jogador', 'fechar_visao_jogador'])
    expect(aoFecharPorFora).not.toHaveBeenCalled()
  })

  it('fechar no meio do abrir: a janela que nasceu depois é fechada também', async () => {
    const { janela, chamadas, abrirPendente } = montaTauri()
    await assentar()
    abrirPendente.atual = promessaPendente<void>()
    const abrindo = janela.abrir('sessao-123456')

    await janela.fechar()
    abrirPendente.atual.resolver()
    await abrindo

    expect(chamadas.map((c) => c.cmd)).toEqual(['abrir_visao_jogador', 'fechar_visao_jogador', 'fechar_visao_jogador'])
    await expect(janela.mostrar()).resolves.toBe(false)
  })

  it('desligar para de ouvir o evento', async () => {
    const { janela, aoFecharPorFora, emitirFechada } = montaTauri({ existe: () => false })
    await assentar()
    await janela.abrir('sessao-123456')

    janela.desligar()
    emitirFechada()
    await assentar()

    expect(aoFecharPorFora).not.toHaveBeenCalled()
  })
})

describe('janela de teste no navegador (popup)', () => {
  it('abre a página com a sessão no endereço e percebe quando o mestre fecha o popup', async () => {
    vi.useFakeTimers()
    const popup = { closed: false, focus: vi.fn(), close: vi.fn() }
    const abrirPopup = vi.fn((_url: string) => popup)
    const aoFecharPorFora = vi.fn()
    const janela = criarJanelaDoNavegador({ abrirPopup, aoFecharPorFora, intervaloMs: 100 })

    await janela.abrir('sessao-123456')
    expect(abrirPopup).toHaveBeenCalledWith(`${PAGINA_DA_JANELA}?sessao=sessao-123456`)
    await expect(janela.mostrar()).resolves.toBe(true)
    expect(popup.focus).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(300)
    expect(aoFecharPorFora).not.toHaveBeenCalled()

    popup.closed = true
    vi.advanceTimersByTime(100)
    expect(aoFecharPorFora).toHaveBeenCalledTimes(1)
    await expect(janela.mostrar()).resolves.toBe(false)
  })

  it('fechar pelo controlador fecha o popup e não avisa de volta', async () => {
    vi.useFakeTimers()
    const popup = { closed: false, focus: vi.fn(), close: vi.fn() }
    const aoFecharPorFora = vi.fn()
    const janela = criarJanelaDoNavegador({ abrirPopup: () => popup, aoFecharPorFora, intervaloMs: 100 })
    await janela.abrir('sessao-123456')

    await janela.fechar()
    popup.closed = true
    vi.advanceTimersByTime(500)

    expect(popup.close).toHaveBeenCalledTimes(1)
    expect(aoFecharPorFora).not.toHaveBeenCalled()
  })

  it('popup bloqueado: abrir rejeita', async () => {
    const janela = criarJanelaDoNavegador({ abrirPopup: () => null, aoFecharPorFora: vi.fn() })
    await expect(janela.abrir('sessao-123456')).rejects.toThrow('bloqueou')
  })
})
