import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../../types/map'
import { signedArea } from '../floorContour'
import { aguaComPincel, cantosDoPontoAPonto, retanguloDaAgua } from './pincel'

/** MAR MAIS FÁCIL (13/11/2026): retângulo e ponto a ponto presos no mapa, e o pincel Mais/Menos água. */
const G = 40
const MAPA = { minX: 0, minY: 0, maxX: 30 * G, maxY: 20 * G }
const casa = (x: number, y: number): RegionPoint => ({ x: x * G, y: y * G })
const plano = (pts: readonly RegionPoint[]): number[] => pts.flatMap((p) => [p.x, p.y])
const area = (pts: readonly RegionPoint[]): number => Math.abs(signedArea([...pts])) / (G * G)

describe('formas novas do lago e do mar', () => {
  it('o retângulo que passa da borda fica na borda', () => {
    expect(retanguloDaAgua(casa(25, 15), casa(40, -3), MAPA)).toEqual([casa(25, 0), casa(30, 0), casa(30, 15), casa(25, 15)])
  })

  it('o ponto a ponto tira o canto repetido do duplo clique e o que fecha em cima do primeiro', () => {
    const cantos = [casa(2, 2), casa(10, 2), casa(10, 8), { x: 10 * G + 2, y: 8 * G + 1 }, { x: 2 * G + 1, y: 2 * G }]
    expect(cantosDoPontoAPonto(cantos, null, 8)).toEqual([casa(2, 2), casa(10, 2), casa(10, 8)])
  })
})

describe('pincel Mais água / Menos água', () => {
  const quadrado = [casa(5, 5), casa(15, 5), casa(15, 15), casa(5, 15)]

  it('Mais água na beira de fora cresce a área e para na borda do mapa', () => {
    const traco = [casa(15, 6), casa(15, 14)]
    const r = aguaComPincel(plano(quadrado), traco, 2 * G, true, G, MAPA, 2000)
    expect(r.pontos).not.toBeNull()
    const pontos = r.pontos ?? []
    // 100 casas² + a faixa de 2 casas para fora (16 casas² e as pontas redondas).
    expect(area(pontos)).toBeGreaterThan(115)
    expect(area(pontos)).toBeLessThan(125)
    expect(r.partiu).toBe(false)
    expect(pontos.every((p) => p.x >= 0 && p.y >= 0 && p.x <= MAPA.maxX && p.y <= MAPA.maxY)).toBe(true)
  })

  it('Menos água que corta no meio parte a água: fica o maior pedaço e avisa', () => {
    const traco = [casa(8, 3), casa(8, 17)]
    const r = aguaComPincel(plano(quadrado), traco, 0.5 * G, false, G, null, 2000)
    expect(r.partiu).toBe(true)
    // O pedaço da direita: de x = 8,5 a 15, 6,5 x 10 casas.
    expect(area(r.pontos ?? [])).toBeGreaterThan(62)
    expect(area(r.pontos ?? [])).toBeLessThan(68)
  })

  it('um clique (traço de um ponto só) no meio não abre buraco', () => {
    const r = aguaComPincel(plano(quadrado), [casa(10, 10)], 1 * G, false, G, null, 2000)
    expect(r.buraco).toBe(true)
    expect(area(r.pontos ?? [])).toBeGreaterThan(99)
  })

  it('o mar enorme (200 x 200 casas) sai em menos de 200 ms', () => {
    const borda = { minX: 0, minY: 0, maxX: 200 * G, maxY: 200 * G }
    // Contorno à mão: um círculo torto com um ponto a cada meia casa.
    const contorno: number[] = []
    for (let i = 0; i < 1800; i += 1) {
      const t = (i / 1800) * Math.PI * 2
      const r = (90 + 4 * Math.sin(t * 7)) * G
      contorno.push(100 * G + r * Math.cos(t), 100 * G + r * Math.sin(t))
    }
    const traco = Array.from({ length: 120 }, (_, k) => casa(10 + k * 1.5, 100))
    const inicio = performance.now()
    const r = aguaComPincel(contorno, traco, 3 * G, false, G, borda, 2000)
    const ms = performance.now() - inicio
    expect(r.pontos).not.toBeNull()
    expect((r.pontos ?? []).length).toBeLessThanOrEqual(2000)
    expect(ms).toBeLessThan(200)
  })
})
