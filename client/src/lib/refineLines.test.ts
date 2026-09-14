import { describe, expect, it } from 'vitest'
import { grayStrokeWeight, refineLine } from './refineLines'

const GREEN = [0, 107, 0]
const GRAY = 133

/** Imagem verde com uma linha cinza antisserrilhada: cobertura por pixel = max(0, 1 - |distância à reta|). */
function antialiasedLine(width: number, height: number, distance: (x: number, y: number) => number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const coverage = Math.max(0, 1 - Math.abs(distance(x + 0.5, y + 0.5)))
      const mix = (base: number) => Math.round(base * (1 - coverage) + GRAY * coverage)
      pixels.set([mix(GREEN[0]), mix(GREEN[1]), mix(GREEN[2]), 255], (y * width + x) * 4)
    }
  }
  return pixels
}

describe('grayStrokeWeight', () => {
  it('verde e preto puros pesam zero; cinza cheio pesa 1; laranja fica de fora', () => {
    expect(grayStrokeWeight(0, 107, 0, 255)).toBe(0)
    expect(grayStrokeWeight(0, 0, 0, 255)).toBe(0)
    expect(grayStrokeWeight(133, 133, 133, 255)).toBe(1)
    expect(grayStrokeWeight(204, 153, 51, 255)).toBe(0)
  })
})

describe('refineLine', () => {
  it('linha horizontal com centro em y=10,3 sai de y=10,5 (centro de pixel) para ~10,3', () => {
    const pixels = antialiasedLine(60, 20, (_x, y) => y - 10.3)
    const refined = refineLine({ points: [{ x: 5.5, y: 10.5 }, { x: 50.5, y: 10.5 }], closed: false }, pixels, 60, 20, { weight: grayStrokeWeight })
    for (const p of refined) expect(p.y).toBeCloseTo(10.3, 1)
    expect(refined[0].x).toBeCloseTo(5.5, 5)
  })

  it('canto em L: vértice interno vai para a interseção das duas retas ajustadas', () => {
    // Horizontal em y=8,2 (x de 5 a 30) e vertical em x=30,2 (y de 8 a 35).
    const pixels = antialiasedLine(45, 45, (x, y) => {
      const toHorizontal = x <= 30.2 ? Math.abs(y - 8.2) : Math.hypot(x - 30.2, y - 8.2)
      const toVertical = y >= 8.2 ? Math.abs(x - 30.2) : Math.hypot(x - 30.2, y - 8.2)
      return Math.min(x < 5 ? 9 : toHorizontal, y > 35 ? 9 : toVertical)
    })
    const refined = refineLine(
      { points: [{ x: 5.5, y: 8.5 }, { x: 30.5, y: 8.5 }, { x: 30.5, y: 35.5 }], closed: false },
      pixels,
      45,
      45,
      { weight: grayStrokeWeight },
    )
    expect(refined[1].x).toBeCloseTo(30.2, 1)
    expect(refined[1].y).toBeCloseTo(8.2, 1)
  })

  it('sem traço por perto mantém os vértices originais', () => {
    const pixels = antialiasedLine(30, 30, () => 99)
    const points = [{ x: 3.5, y: 3.5 }, { x: 20.5, y: 3.5 }]
    expect(refineLine({ points, closed: false }, pixels, 30, 30, { weight: grayStrokeWeight })).toEqual(points)
  })
})
