import { describe, expect, it } from 'vitest'
import { createPolygonDistance, polygonDistanceBrute } from './polygonSdf'

/** Estrela irregular: côncava, muitos vértices, bordas em todas as direções. */
function star(vertices: number, cx: number, cy: number, radius: number): { x: number; y: number }[] {
  return Array.from({ length: vertices }, (_, i) => {
    const a = (i / vertices) * Math.PI * 2
    const r = radius * (i % 2 === 0 ? 1 : 0.55) * (1 + 0.1 * Math.sin(i * 1.7))
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

describe('createPolygonDistance', () => {
  it('menos de 3 vértices: sem área, sempre fora', () => {
    expect(createPolygonDistance([{ x: 0, y: 0 }, { x: 5, y: 5 }])(1, 1)).toBe(Infinity)
  })

  it('polígono pequeno usa força bruta e bate exatamente', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    const fn = createPolygonDistance(square)
    expect(fn(5, 5)).toBeCloseTo(-5)
    expect(fn(13, 5)).toBeCloseTo(3)
  })

  it('polígono de 300 vértices: sinal sempre igual à força bruta; módulo exato perto da borda, limite inferior longe', () => {
    const vertices = star(300, 200, 180, 150)
    const fn = createPolygonDistance(vertices)
    let exactNearBorder = 0
    for (let y = 0; y <= 380; y += 3.7) {
      for (let x = 0; x <= 420; x += 3.3) {
        const brute = polygonDistanceBrute(x, y, vertices)
        const fast = fn(x, y)
        expect(Math.sign(fast)).toBe(Math.sign(brute))
        expect(Math.abs(fast)).toBeLessThanOrEqual(Math.abs(brute) + 1e-9)
        if (Math.abs(brute) < 8) {
          expect(fast).toBeCloseTo(brute, 9)
          exactNearBorder += 1
        }
      }
    }
    expect(exactNearBorder).toBeGreaterThan(100)
    // ~14 mil pontos contra a força bruta de 300 arestas: leva ~1 s na máquina
    // parada e passou de 7 s com quatro builders rodando Playwright ao mesmo
    // tempo (22/09). O teto padrão de 5 s reprovava a suíte inteira por carga.
  }, 30_000)
})
