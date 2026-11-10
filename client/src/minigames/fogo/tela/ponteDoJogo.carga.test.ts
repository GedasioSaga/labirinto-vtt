import { describe, expect, it } from 'vitest'
import { criarPonteDoJogo, type EstadoDaPonte } from './ponteDoJogo'
import { ERRO_DA_CARGA_PARADA, erroDaFalhaDoJogo } from './textos'
import type { ProgressoDaCarga } from './vigiaDaCarga'

/** A ponte com um iframe de mentira: `doJogo` entrega uma mensagem como se viesse dele. */
function ponteDeTeste() {
  const janela = {} as MessageEventSource
  const mudancas: { estado: EstadoDaPonte; erro?: string }[] = []
  const cargas: ProgressoDaCarga[] = []
  const paraOJogo: string[] = []
  const ponte = criarPonteDoJogo({
    janela: () => janela,
    enviar: (texto) => paraOJogo.push(texto),
    saida: { entradas: () => true, hash: () => true, fim: () => true },
    repassarMinhas: false,
    aoMudar: (estado, erro) => mudancas.push(erro === undefined ? { estado } : { estado, erro }),
    aoCarregar: (carga) => cargas.push(carga),
  })
  const doJogo = (campos: Record<string, unknown>) => ponte.receber({ source: janela, data: JSON.stringify({ jogo: 'fogo', v: 2, ...campos }) })
  return { ponte, doJogo, mudancas, cargas, paraOJogo }
}

describe('ponteDoJogo: a carga do jogo (casca nova do export web)', () => {
  it('repassa o progresso só enquanto carrega e recusa número torto', () => {
    const { doJogo, cargas, mudancas } = ponteDeTeste()
    doJogo({ tipo: 'carga', atual: 0, total: 39_800_000 })
    doJogo({ tipo: 'carga', atual: 1_500_000, total: 39_800_000 })
    for (const torta of [{ atual: -1, total: 10 }, { atual: 11, total: 10 }, { atual: 1.5, total: 10 }, { atual: 1, total: 0 }, { atual: '1', total: 10 }, { total: 10 }]) {
      doJogo({ tipo: 'carga', ...torta })
    }
    expect(cargas).toEqual([
      { atual: 0, total: 39_800_000 },
      { atual: 1_500_000, total: 39_800_000 },
    ])
    // Progresso não muda o estado; depois do `pronto`, não é mais carga.
    expect(mudancas).toEqual([])
    doJogo({ tipo: 'pronto', jogadores_max: 6 })
    doJogo({ tipo: 'carga', atual: 2_000_000, total: 39_800_000 })
    expect(cargas).toHaveLength(2)
    expect(mudancas).toEqual([{ estado: 'esperando' }])
  })

  it('a falha do jogo vira erro com o motivo em frase simples, e o "Tentar de novo" volta a carregar', () => {
    const { ponte, doJogo, mudancas, paraOJogo } = ponteDeTeste()
    doJogo({ tipo: 'falha', motivo: 'webgl2', texto: 'Error\nThe following features required to run Godot projects on the Web are missing:\nWebGL2' })
    expect(mudancas).toEqual([{ estado: 'erro', erro: erroDaFalhaDoJogo('webgl2') }])
    expect(erroDaFalhaDoJogo('webgl2')).toContain('WebGL 2')
    // Erro não se conserta sozinho: um `pronto` atrasado do iframe velho não muda nada.
    doJogo({ tipo: 'pronto', jogadores_max: 6 })
    expect(ponte.estado()).toBe('erro')

    expect(ponte.recarregar()).toBe(true)
    expect(ponte.estado()).toBe('carregando')
    // A segunda carga anda, para de novo (a vigia acusa) e a terceira chega ao `pronto`.
    ponte.falhouCarga(ERRO_DA_CARGA_PARADA)
    expect(ponte.recarregar()).toBe(true)
    doJogo({ tipo: 'pronto', jogadores_max: 6 })
    expect(ponte.estado()).toBe('esperando')
    expect(mudancas.map((m) => m.estado)).toEqual(['erro', 'carregando', 'erro', 'carregando', 'esperando'])
    // Com o jogo carregado não há o que recarregar, e nada foi mandado ao jogo sem partida.
    expect(ponte.recarregar()).toBe(false)
    expect(paraOJogo).toEqual([])
  })
})
