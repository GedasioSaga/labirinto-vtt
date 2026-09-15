import { describe, expect, it } from 'vitest'
import { alignToPixel, hairlinePhysicalWidth, pixelGrid, snapToPhysicalPixel, strokeWidthInWorld } from './pixelAlign'

/** Pixels físicos cobertos por um traço centrado em `center` (px físicos) com `width` px. */
function coveredPixels(centerPhysical: number, width: number): [number, number] {
  return [centerPhysical - width / 2, centerPhysical + width / 2]
}

describe('hairlinePhysicalWidth', () => {
  it.each([
    [1, 1, 1],
    [1, 1.25, 1],
    [1, 1.5, 2],
    [1, 2, 2],
    [2, 1.25, 3],
    [0.2, 1, 1],
  ])('%s px CSS em DPR %s → %s px físicos', (css, res, expected) => {
    expect(hairlinePhysicalWidth(css, res)).toBe(expected)
  })

  it('valores inválidos caem em 1', () => {
    expect(hairlinePhysicalWidth(Number.NaN, 1)).toBe(1)
    expect(hairlinePhysicalWidth(1, 0)).toBe(1)
  })
})

describe('alignToPixel', () => {
  it('DPR 1, zoom 100%: linha em coordenada inteira vai para o meio do pixel', () => {
    const grid = pixelGrid(1, 1)
    expect(alignToPixel(578, grid)).toBe(578.5)
    const [a, b] = coveredPixels(alignToPixel(578, grid) * grid.pxPerWorld, grid.physicalWidth)
    expect([a, b]).toEqual([578, 579])
  })

  it('qualquer zoom e DPR: o traço cobre pixels físicos inteiros (bordas sem fração)', () => {
    for (const res of [1, 1.25, 1.5, 2]) {
      for (const scale of [0.25, 0.35, 0.5, 0.73, 1, 1.5, 2.2, 4]) {
        const grid = pixelGrid(scale, res)
        for (const value of [0, 64, 128.3, 1000, -64]) {
          const center = alignToPixel(value, grid) * grid.pxPerWorld
          const [a, b] = coveredPixels(center, grid.physicalWidth)
          expect(Math.abs(a - Math.round(a))).toBeLessThan(1e-6)
          expect(Math.abs(b - Math.round(b))).toBeLessThan(1e-6)
          // Nunca desloca mais de meio pixel físico (mais meia espessura).
          expect(Math.abs(center - value * grid.pxPerWorld)).toBeLessThanOrEqual(0.5 + 1e-9)
        }
      }
    }
  })

  it('DPR 1,25: espessura igual em linhas consecutivas da grade', () => {
    const grid = pixelGrid(1, 1.25)
    const widths = [0, 64, 128, 192, 256].map(() => strokeWidthInWorld(grid) * grid.pxPerWorld)
    expect(new Set(widths)).toEqual(new Set([1]))
  })

  it('espessura par fica na fronteira do pixel', () => {
    const grid = pixelGrid(1, 2)
    expect(grid.physicalWidth).toBe(2)
    expect((alignToPixel(10.3, grid) * grid.pxPerWorld) % 1).toBe(0)
  })
})

describe('strokeWidthInWorld', () => {
  it('1 px físico a 50% de zoom em DPR 1 = 2 px de mundo', () => {
    expect(strokeWidthInWorld(pixelGrid(0.5, 1))).toBe(2)
  })
})

describe('snapToPhysicalPixel', () => {
  it('arredonda ao pixel físico, não ao px CSS', () => {
    expect(snapToPhysicalPixel(643.2, 1)).toBe(643)
    expect(snapToPhysicalPixel(643.2, 1.25) * 1.25).toBe(804)
    expect(snapToPhysicalPixel(10, 0)).toBe(10)
  })
})
