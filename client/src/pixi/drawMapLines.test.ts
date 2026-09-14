import { describe, expect, it } from 'vitest'
import { markerCorners } from './drawMapLines'

function pairs(flat: number[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}

describe('markerCorners', () => {
  it('sem rotação: cantos do retângulo centrado, sentido horário a partir do topo-esquerdo', () => {
    const corners = pairs(markerCorners({ cx: 10, cy: 20, w: 8, h: 4, rotation: 0, color: '#cc9933' }))
    expect(corners).toEqual([
      [6, 18],
      [14, 18],
      [14, 22],
      [6, 22],
    ])
  })

  it('90° troca largura e altura em volta do mesmo centro', () => {
    const corners = pairs(markerCorners({ cx: 0, cy: 0, w: 8, h: 4, rotation: 90, color: '#cc9933' }))
    const xs = corners.map(([x]) => x)
    const ys = corners.map(([, y]) => y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(4)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(8)
  })
})
