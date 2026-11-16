import { describe, expect, it } from 'vitest'
import { ladrilhoDe } from './chaoNoMundo.testkit'
import { forcaDaManchaClara, LUZ_DA_MANCHA_CLARA_INTEIRA, type ImagemDoLadrilho } from './chaoNoMundo'

/**
 * MANCHA CLARA NO CHÃO ESCURO (lote de 15/11/2026): com "Manchas do chão", a
 * Grama escura ficava com cara de névoa ou geada, porque a mancha clara puxa
 * 18% para o branco. Abaixo de uma luz ela enfraquece; os campos claros de
 * antes (Verde, Amarelo e Morto) ficam com a força inteira, e os bytes deles
 * não mudam (a folha tmp/referencias-2026-11-15/L4/grama-escura-manchas.png e
 * os resumos dela conferiram isso na entrega).
 */

function chapado(lado: number, rgb: readonly [number, number, number]): ImagemDoLadrilho {
  const pixels = new Uint8ClampedArray(lado * lado * 4)
  for (let i = 0; i < lado * lado; i += 1) pixels.set([rgb[0], rgb[1], rgb[2], 255], i * 4)
  return { lado, pixels }
}

describe('força da mancha clara', () => {
  it('Verde, Amarelo e Morto ficam com a mancha inteira; a Grama escura, com menos da metade', () => {
    for (const id of ['grama', 'grama-amarela', 'grama-morta']) expect(forcaDaManchaClara(ladrilhoDe(id))).toBe(1)
    const escura = forcaDaManchaClara(ladrilhoDe('grama-escura'))
    expect(escura).toBeGreaterThan(0.3)
    expect(escura).toBeLessThan(0.5)
  })

  it('cai com a luz: inteira na luz de corte, nada no preto, e menos no mais escuro', () => {
    const naLuz = LUZ_DA_MANCHA_CLARA_INTEIRA
    expect(forcaDaManchaClara(chapado(16, [naLuz, naLuz, naLuz]))).toBe(1)
    expect(forcaDaManchaClara(chapado(16, [0, 0, 0]))).toBe(0)
    expect(forcaDaManchaClara(chapado(16, [60, 60, 60]))).toBeLessThan(forcaDaManchaClara(chapado(16, [100, 100, 100])))
  })
})
