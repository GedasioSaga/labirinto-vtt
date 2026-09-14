import { describe, expect, it } from 'vitest'
import { rasterizePixelLine } from './pixelLine'

describe('rasterizePixelLine', () => {
  it('sem pontos não acende nada; um ponto acende um pixel', () => {
    expect(rasterizePixelLine({ points: [], closed: false, dotted: false })).toEqual([])
    expect(rasterizePixelLine({ points: [{ x: 3.5, y: 4.5 }], closed: false, dotted: false })).toEqual([{ x: 3, y: 4 }])
  })

  it('linha horizontal acende cada pixel entre as pontas, inclusive', () => {
    const pixels = rasterizePixelLine({ points: [{ x: 2.5, y: 7.5 }, { x: 6.5, y: 7.5 }], closed: false, dotted: false })
    expect(pixels.map((p) => p.x)).toEqual([2, 3, 4, 5, 6])
    expect(new Set(pixels.map((p) => p.y))).toEqual(new Set([7]))
  })

  it('pontilhado acende um sim, um não, sem reiniciar no vértice', () => {
    const pixels = rasterizePixelLine({
      points: [{ x: 0.5, y: 0.5 }, { x: 4.5, y: 0.5 }, { x: 4.5, y: 4.5 }],
      closed: false,
      dotted: true,
    })
    // Caminho: (0,0)(1,0)(2,0)(3,0)(4,0)(4,1)(4,2)(4,3)(4,4) → acesos nas posições pares.
    expect(pixels).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 4, y: 4 }])
  })

  it('contorno fechado de quadrado acende o perímetro sem pixel repetido', () => {
    const pixels = rasterizePixelLine({
      points: [{ x: 0.5, y: 0.5 }, { x: 3.5, y: 0.5 }, { x: 3.5, y: 3.5 }, { x: 0.5, y: 3.5 }],
      closed: true,
      dotted: false,
    })
    expect(pixels).toHaveLength(12)
  })

  it('diagonal 45° acende um pixel por passo', () => {
    const pixels = rasterizePixelLine({ points: [{ x: 0.5, y: 0.5 }, { x: 5.5, y: 5.5 }], closed: false, dotted: false })
    expect(pixels).toEqual([0, 1, 2, 3, 4, 5].map((i) => ({ x: i, y: i })))
  })
})
