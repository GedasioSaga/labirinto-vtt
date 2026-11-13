import { describe, expect, it } from 'vitest'
import type { Agua, RegionPoint } from '../../types/map'
import { aguaParaJogador } from './recorte'

/**
 * A ÁGUA DO RECORTE E O LUGAR ESCONDIDO (provas da 0.5.62, F-N04 e F-N05).
 * Grade de 64 px; o lugar é a caixa 24..30 x 2..8 casas; o jogador conhece o
 * mapa inteiro, menos o que o lugar esconde.
 */
const G = 64
const casa = ([x, y]: readonly [number, number]): RegionPoint => ({ x: x * G, y: y * G })
const naCaixa = (p: RegionPoint): boolean => p.x >= 24 * G && p.x <= 30 * G && p.y >= 2 * G && p.y <= 8 * G
const tudo = (): boolean => true
const nada = (): boolean => false

/** O rio que entra na caixa e sai dela (a maior parte dele fora); as duas pontas de dentro são fixas, o `miolo` muda. */
function rio(miolo: readonly (readonly [number, number])[]): Agua {
  const pontos: (readonly [number, number])[] = [[22, 0.5], [24.4, 2.6], [24.8, 3.1], ...miolo, [29.2, 7.1], [29.6, 7.6], [32, 9.5], [36, 11], [44, 12], [52, 14]]
  return { id: 'rio', tipo: 'rio', pontos: pontos.map(casa), cor: '#2f6f9f', largura: 1.5 }
}

describe('água no recorte do jogador e o lugar escondido', () => {
  it('F-N05: trocar só o miolo escondido do rio não muda o rio que ele vê, nem a fase da correnteza dele', () => {
    const a = aguaParaJogador(rio([[26.5, 4.2], [27.5, 6.6]]), G, tudo, naCaixa)
    const b = aguaParaJogador(rio([[26, 6.5], [28, 4.5]]), G, tudo, naCaixa)
    const trechosA = a?.recorte?.trechos ?? []
    // A premissa: o rio sai em dois trechos, antes e depois da caixa.
    expect(trechosA.length).toBe(2)
    expect(b?.recorte?.trechos).toEqual(trechosA)
    // Sem nada escondido, a fase é o comprimento da curva desde a nascente.
    expect(aguaParaJogador(rio([[26.5, 4.2], [27.5, 6.6]]), G, tudo, nada)?.recorte?.trechos?.[0]?.s0).toBe(0)
  })

  it('F-N04: o rio que só passa pelo lugar que esconde o que mora nele sai inteiro; o poço que mora nele não sai', () => {
    const atravessa = aguaParaJogador(rio([[26.5, 4.2], [27.5, 6.6]]), G, tudo, nada, naCaixa)
    const trechos = atravessa?.recorte?.trechos ?? []
    expect(trechos.length, 'um trecho só, sem corte na caixa').toBe(1)
    const pontosNaCaixa = (trechos[0]?.pontos ?? []).filter((_, i, xy) => i % 2 === 0 && naCaixa({ x: xy[i], y: xy[i + 1] })).length
    expect(pontosNaCaixa).toBeGreaterThan(0)

    const poco: Agua = { id: 'poco', tipo: 'lago', pontos: [[25, 2.6], [26.4, 2.8], [26.2, 3.8], [25.1, 3.7]].map(([x, y]) => casa([x, y])), cor: '#2f6f9f' }
    expect(aguaParaJogador(poco, G, tudo, nada, naCaixa)).toBeNull()
  })
})
