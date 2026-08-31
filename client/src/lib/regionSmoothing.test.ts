import { describe, expect, it } from 'vitest'
import { simplifyPolygon, chaikinSmooth } from './regionSmoothing'
import type { RegionPoint } from '../types/map'

const SQUARE: RegionPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]

describe('simplifyPolygon', () => {
  it('retângulo levemente ruidoso (ziguezague quase colinear em cada lado) perde bem menos pontos, mas preserva os 4 cantos reais', () => {
    // Cada lado do retângulo real A(0,0) B(100,0) C(100,100) D(0,100) ganha 3
    // pontos de ruído com desvio pequeno (<=1) — bem menor que o epsilon
    // (0.02 * diagonal ≈ 2.83 pra este retângulo 100x100), então devem sumir.
    const noisy: RegionPoint[] = [
      { x: 0, y: 0 }, // A
      { x: 25, y: 1 },
      { x: 50, y: -1 },
      { x: 75, y: 0.6 },
      { x: 100, y: 0 }, // B
      { x: 101, y: 25 },
      { x: 99, y: 50 },
      { x: 100.5, y: 75 },
      { x: 100, y: 100 }, // C
      { x: 75, y: 101 },
      { x: 50, y: 99 },
      { x: 25, y: 100.6 },
      { x: 0, y: 100 }, // D
    ]

    const result = simplifyPolygon(noisy)

    expect(result.length).toBeLessThan(noisy.length / 2)
    expect(result).toContainEqual({ x: 0, y: 0 })
    expect(result).toContainEqual({ x: 100, y: 0 })
    expect(result).toContainEqual({ x: 100, y: 100 })
    expect(result).toContainEqual({ x: 0, y: 100 })
  })

  it('retângulo exato (sem ruído) não perde nenhum canto real', () => {
    expect(simplifyPolygon(SQUARE)).toEqual(SQUARE)
  })

  it('menos de 4 pontos: já é mínimo, devolve sem mudança', () => {
    const triangle: RegionPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]
    expect(simplifyPolygon(triangle)).toEqual(triangle)
  })
})

describe('chaikinSmooth', () => {
  it('quadrado de 4 pontos vira 8 pontos (2 por aresta, incluindo o wrap da última pra primeira), cortando cada canto', () => {
    const result = chaikinSmooth(SQUARE, 1)

    expect(result).toHaveLength(8)
    // Aresta A(0,0)->B(100,0): Q a 25% e R a 75% do caminho.
    expect(result[0]).toEqual({ x: 25, y: 0 })
    expect(result[1]).toEqual({ x: 75, y: 0 })
    // Aresta B(100,0)->C(100,100).
    expect(result[2]).toEqual({ x: 100, y: 25 })
    expect(result[3]).toEqual({ x: 100, y: 75 })
    // Aresta C(100,100)->D(0,100).
    expect(result[4]).toEqual({ x: 75, y: 100 })
    expect(result[5]).toEqual({ x: 25, y: 100 })
    // Aresta D(0,100)->A(0,0) — o wrap.
    expect(result[6]).toEqual({ x: 0, y: 75 })
    expect(result[7]).toEqual({ x: 0, y: 25 })
  })

  it('nenhum ponto novo fica fora do bounding box original (cortar canto encolhe a forma, não estica)', () => {
    const result = chaikinSmooth(SQUARE, 1)
    for (const p of result) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(100)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(100)
    }
  })

  it('menos de 3 pontos: não há aresta pra cortar, devolve sem mudança', () => {
    const points: RegionPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    expect(chaikinSmooth(points, 1)).toEqual(points)
  })
})
