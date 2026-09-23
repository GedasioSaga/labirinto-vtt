import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarPedidoDeFechar, perguntaAoFechar, type EstadoAoFechar } from './avisoAoFechar'

const ESPERA_MAXIMA_MS = 10_000

/** Pedido de fechar do Tauri: só o `preventDefault` importa aqui. */
function pedido() {
  return { preventDefault: vi.fn() }
}

function montar(estado: EstadoAoFechar, resposta: Promise<boolean>) {
  const perguntar = vi.fn((_texto: string) => resposta)
  const fechar = vi.fn(async () => undefined)
  const aoPedirFechar = criarPedidoDeFechar({ estado: () => estado, perguntar, fechar, esperaMaximaMs: ESPERA_MAXIMA_MS })
  return { aoPedirFechar, perguntar, fechar }
}

describe('perguntaAoFechar', () => {
  it('sem sala e sem alteração: fecha direto, sem pergunta', () => {
    expect(perguntaAoFechar({ alteracoesNaoSalvas: false, jogadoresNaSala: 0 })).toBeNull()
  })

  it('com 7 jogadores na sala e mapa salvo: pergunta citando os 7', () => {
    const texto = perguntaAoFechar({ alteracoesNaoSalvas: false, jogadoresNaSala: 7 })
    expect(texto).toBe('Há 7 jogadores na sala. Fechar o Labirinto desconecta todos. Fechar mesmo assim?')
  })

  it('com 1 jogador: singular, sem "todos"', () => {
    expect(perguntaAoFechar({ alteracoesNaoSalvas: false, jogadoresNaSala: 1 })).toBe(
      'Há 1 jogador na sala. Fechar o Labirinto desconecta esse jogador. Fechar mesmo assim?',
    )
  })

  it('só alteração não salva: a pergunta de antes, igual', () => {
    expect(perguntaAoFechar({ alteracoesNaoSalvas: true, jogadoresNaSala: 0 })).toBe('Há alterações não salvas neste mapa. Fechar mesmo assim?')
  })

  it('jogadores e alteração não salva: uma pergunta só, com as duas coisas', () => {
    expect(perguntaAoFechar({ alteracoesNaoSalvas: true, jogadoresNaSala: 3 })).toBe(
      'Há 3 jogadores na sala e alterações não salvas neste mapa. Fechar o Labirinto desconecta todos. Fechar mesmo assim?',
    )
  })
})

describe('criarPedidoDeFechar', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('X com 7 jogadores: segura o fechamento e pergunta', async () => {
    const t = montar({ alteracoesNaoSalvas: false, jogadoresNaSala: 7 }, Promise.resolve(false))
    const evento = pedido()
    await t.aoPedirFechar(evento)
    expect(evento.preventDefault).toHaveBeenCalledTimes(1)
    expect(t.perguntar).toHaveBeenCalledTimes(1)
    expect(t.perguntar.mock.calls[0]?.[0]).toMatch(/^Há 7 jogadores na sala/)
  })

  it('Cancelar mantém a janela (e a sala) aberta', async () => {
    const t = montar({ alteracoesNaoSalvas: false, jogadoresNaSala: 7 }, Promise.resolve(false))
    await t.aoPedirFechar(pedido())
    expect(t.perguntar).toHaveBeenCalledTimes(1)
    expect(t.fechar).not.toHaveBeenCalled()
  })

  it('Confirmar fecha', async () => {
    const t = montar({ alteracoesNaoSalvas: false, jogadoresNaSala: 7 }, Promise.resolve(true))
    await t.aoPedirFechar(pedido())
    expect(t.fechar).toHaveBeenCalledTimes(1)
  })

  it('sem sala e sem alteração: não segura, não pergunta, deixa o Tauri fechar', async () => {
    const t = montar({ alteracoesNaoSalvas: false, jogadoresNaSala: 0 }, Promise.resolve(false))
    const evento = pedido()
    await t.aoPedirFechar(evento)
    expect(evento.preventDefault).not.toHaveBeenCalled()
    expect(t.perguntar).not.toHaveBeenCalled()
    expect(t.fechar).not.toHaveBeenCalled()
  })

  it('lê o estado no instante do X, não quando o aviso foi registrado', async () => {
    let jogadores = 0
    const perguntar = vi.fn(async (_texto: string) => false)
    const aoPedirFechar = criarPedidoDeFechar({
      estado: () => ({ alteracoesNaoSalvas: false, jogadoresNaSala: jogadores }),
      perguntar,
      fechar: async () => undefined,
      esperaMaximaMs: ESPERA_MAXIMA_MS,
    })
    jogadores = 2
    await aoPedirFechar(pedido())
    expect(perguntar).toHaveBeenCalledWith('Há 2 jogadores na sala. Fechar o Labirinto desconecta todos. Fechar mesmo assim?')
  })

  it('diálogo que falha: fecha mesmo assim (janela travada é pior)', async () => {
    const t = montar({ alteracoesNaoSalvas: true, jogadoresNaSala: 0 }, Promise.reject(new Error('sem ponte')))
    await t.aoPedirFechar(pedido())
    expect(t.fechar).toHaveBeenCalledTimes(1)
  })

  it('diálogo que nunca responde: fecha depois da espera máxima', async () => {
    vi.useFakeTimers()
    const t = montar({ alteracoesNaoSalvas: false, jogadoresNaSala: 7 }, new Promise<boolean>(() => undefined))
    const fim = t.aoPedirFechar(pedido())
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_MS - 1)
    expect(t.fechar).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await fim
    expect(t.fechar).toHaveBeenCalledTimes(1)
  })

  it('resposta antes da espera máxima não deixa o relógio vivo', async () => {
    vi.useFakeTimers()
    const t = montar({ alteracoesNaoSalvas: false, jogadoresNaSala: 7 }, Promise.resolve(false))
    await t.aoPedirFechar(pedido())
    expect(vi.getTimerCount()).toBe(0)
    expect(t.fechar).not.toHaveBeenCalled()
  })
})
