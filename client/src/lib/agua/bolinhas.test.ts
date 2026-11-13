import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../../types/map'
import { arrastarBolinha, bolinhasDaForma, meiosDasBolinhas, tirarBolinha } from './bolinhas'

/** MAR MAIS FÁCIL (13/11/2026): as bolinhas da água escolhida. */
const G = 40

/** Um lago redondo traçado à mão: um ponto a cada meia casa, raio de 5 casas. */
function lagoAMao(): RegionPoint[] {
  const n = 63
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    return { x: 10 * G + 5 * G * Math.cos(t), y: 10 * G + 5 * G * Math.sin(t) }
  })
}

describe('bolinhas da água', () => {
  it('a água à mão mostra poucas bolinhas, sem duas grudadas; a reta mostra um por canto', () => {
    const pontos = lagoAMao()
    const marcadas = bolinhasDaForma(pontos, true, G, false)
    expect(marcadas.length).toBeGreaterThanOrEqual(6)
    expect(marcadas.length).toBeLessThanOrEqual(24)
    for (let k = 1; k < marcadas.length; k += 1) {
      const a = pontos[marcadas[k - 1]]
      const b = pontos[marcadas[k]]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.75 * G)
    }
    expect(bolinhasDaForma(pontos.slice(0, 4), true, G, true)).toEqual([0, 1, 2, 3])
  })

  it('arrastar a bolinha leva os pontos do meio aos poucos e deixa as vizinhas e o resto no lugar', () => {
    const pontos = lagoAMao()
    const marcadas = bolinhasDaForma(pontos, true, G, false)
    const k = 2
    const i = marcadas[k]
    const alvo = { x: pontos[i].x + 2 * G, y: pontos[i].y }
    const depois = arrastarBolinha(pontos, marcadas, k, alvo, true)
    expect(depois[i]).toEqual({ x: Math.round(alvo.x * 10) / 10, y: Math.round(alvo.y * 10) / 10 })
    expect(depois[marcadas[k - 1]]).toBe(pontos[marcadas[k - 1]])
    expect(depois[marcadas[k + 1]]).toBe(pontos[marcadas[k + 1]])
    const meioDoLado = Math.floor((marcadas[k - 1] + i) / 2)
    const andou = depois[meioDoLado].x - pontos[meioDoLado].x
    expect(andou).toBeGreaterThan(0.2 * G)
    expect(andou).toBeLessThan(1.8 * G)
    // Longe da bolinha nada muda.
    expect(depois[marcadas[k + 3]]).toBe(pontos[marcadas[k + 3]])
  })

  it('Alt+clique tira a bolinha, mas não passa do mínimo de pontos', () => {
    const quadrado = [
      { x: 0, y: 0 },
      { x: 4 * G, y: 0 },
      { x: 4 * G, y: 4 * G },
      { x: 0, y: 4 * G },
    ]
    const sem = tirarBolinha(quadrado, [0, 1, 2, 3], 1, true, 3)
    expect(sem?.pontos).toEqual([quadrado[0], quadrado[2], quadrado[3]])
    expect(sem === null ? null : tirarBolinha(sem.pontos, sem.marcadas, 0, true, 3)).toBeNull()
  })

  it('o meio da linha reta fica no meio do segmento; o rio não liga a última bolinha à primeira', () => {
    const quadrado = [
      { x: 0, y: 0 },
      { x: 4 * G, y: 0 },
      { x: 4 * G, y: 2 * G },
    ]
    expect(meiosDasBolinhas(quadrado, [0, 1, 2], true, true)).toEqual([
      { x: 2 * G, y: 0 },
      { x: 4 * G, y: G },
      { x: 2 * G, y: G },
    ])
    expect(meiosDasBolinhas(quadrado, [0, 1, 2], false, true)).toHaveLength(2)
  })
})
