import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapLine } from '../types/map'
import { compileFloor } from './floorSdf'
import { clippedPixelArea, halfPlaneCoverage, hexToRgb, rasterizeMinimap, subsamplePositions, type MinimapRasterStyle } from './minimapRaster'

const STYLE: MinimapRasterStyle = {
  background: [0, 0, 0],
  floor: [0, 107, 0],
  stroke: null,
  strokeAlpha: 1,
  strokeWidth: 1,
  lineAlpha: 1,
  samples: 4,
}

function rect(cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id: 'r', shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

function pixel(out: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const o = (y * width + x) * 4
  return [out[o], out[o + 1], out[o + 2]]
}

const BASE = { originX: 0, originY: 0, width: 30, height: 20, lines: [], markers: [] }

describe('hexToRgb', () => {
  it('aceita #rrggbb e #rgb', () => {
    expect(hexToRgb('#7f857f')).toEqual([127, 133, 127])
    expect(hexToRgb('#fff')).toEqual([255, 255, 255])
  })
})

describe('subsamplePositions', () => {
  it('n-torres: 16 subamostras com x e y todos distintos', () => {
    const rooks = subsamplePositions(4, 'rooks')
    expect(rooks).toHaveLength(16)
    expect(new Set(rooks.map((p) => p.x)).size).toBe(16)
    expect(new Set(rooks.map((p) => p.y)).size).toBe(16)
    expect(new Set(subsamplePositions(4, 'grid').map((p) => p.x)).size).toBe(4)
  })

  it('borda vertical em x=10,1: n-torres dá 14/16 de cobertura (verdade 0,9), grade dá 4/4', () => {
    const floor = compileFloor([rect(20.05, 10, 19.9, 30)])
    const base = { originX: 0, originY: 0, width: 30, height: 20, lines: [], markers: [], floor }
    const green = (pattern: 'grid' | 'rooks') => pixel(rasterizeMinimap(base, { ...STYLE, pattern }), 30, 10, 10)[1]
    expect(green('grid')).toBe(107)
    expect(green('rooks')).toBe(Math.round((107 * 14) / 16))
  })
})

describe('halfPlaneCoverage', () => {
  it('borda vertical: cobertura linear; diagonal 45° pelo centro: metade; fora do alcance: 0 e 1', () => {
    expect(halfPlaneCoverage(0.4, 1, 0)).toBeCloseTo(0.9)
    expect(halfPlaneCoverage(0, Math.SQRT1_2, Math.SQRT1_2)).toBeCloseTo(0.5)
    expect(halfPlaneCoverage(-1, 0.6, 0.8)).toBe(0)
    expect(halfPlaneCoverage(1, 0.6, 0.8)).toBe(1)
    // Contínua e crescente.
    let previous = 0
    for (let s = -0.8; s <= 0.8; s += 0.01) {
      const c = halfPlaneCoverage(s, 0.6, 0.8)
      expect(c).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = c
    }
  })
})

describe('clippedPixelArea', () => {
  it('quadrado inteiro dentro dá 1; metade dá 0,5; triângulo de canto dá 0,125', () => {
    expect(clippedPixelArea([-1, -1, 3, -1, 3, 3, -1, 3], 0, 0)).toBeCloseTo(1)
    expect(clippedPixelArea([0.5, -1, 3, -1, 3, 3, 0.5, 3], 0, 0)).toBeCloseTo(0.5)
    expect(clippedPixelArea([0, 0, 0.5, 0, 0, 0.5], 0, 0)).toBeCloseTo(0.125)
    expect(clippedPixelArea([5, 5, 6, 5, 6, 6], 0, 0)).toBe(0)
  })
})

describe('rasterizeMinimap analítico', () => {
  it('linha horizontal de largura 1 com centro em y=5,25 cobre 75% da linha 5 e 25% da linha 4', () => {
    const line: MapLine = { id: 'l', points: [{ x: 2.5, y: 5.25 }, { x: 20.5, y: 5.25 }], closed: false, dotted: false, color: '#858585', width: 1 }
    const out = rasterizeMinimap({ ...BASE, floor: null, lines: [line] }, { ...STYLE, pattern: 'analytic', analyticShapes: true })
    expect(pixel(out, 30, 10, 5)[0]).toBe(Math.round(133 * 0.75))
    expect(pixel(out, 30, 10, 4)[0]).toBe(Math.round(133 * 0.25))
  })

  it('borda vertical em x=10,1 dá cobertura exata 0,9 no pixel 10', () => {
    const floor = compileFloor([rect(20.05, 10, 19.9, 30)])
    const out = rasterizeMinimap({ originX: 0, originY: 0, width: 30, height: 20, lines: [], markers: [], floor }, { ...STYLE, pattern: 'analytic' })
    expect(pixel(out, 30, 10, 10)[1]).toBe(Math.round(107 * 0.9))
    expect(pixel(out, 30, 15, 10)).toEqual([0, 107, 0])
    expect(pixel(out, 30, 5, 10)).toEqual([0, 0, 0])
  })

  it('traço de largura 1 centrado em x=10 cobre meio pixel de cada lado, igual ao modo de subamostras', () => {
    const floor = compileFloor([rect(15, 10, 10, 10)])
    const out = rasterizeMinimap(
      { originX: 0, originY: 0, width: 30, height: 20, lines: [], markers: [], floor },
      { ...STYLE, stroke: [133, 133, 133], strokeAlpha: 1, pattern: 'analytic' },
    )
    expect(pixel(out, 30, 9, 10)).toEqual([66, 66, 66])
    expect(pixel(out, 30, 10, 10)).toEqual([66, 120, 66])
  })
})

describe('rasterizeMinimap', () => {
  it('sem nada é tudo fundo', () => {
    const out = rasterizeMinimap({ ...BASE, floor: null }, STYLE)
    expect(pixel(out, 30, 5, 5)).toEqual([0, 0, 0])
  })

  it('chão alinhado ao pixel: dentro é verde puro, fora é fundo puro', () => {
    const out = rasterizeMinimap({ ...BASE, floor: compileFloor([rect(15, 10, 10, 10)]) }, STYLE)
    expect(pixel(out, 30, 12, 10)).toEqual([0, 107, 0])
    expect(pixel(out, 30, 9, 10)).toEqual([0, 0, 0])
    expect(pixel(out, 30, 10, 10)).toEqual([0, 107, 0])
  })

  it('borda no meio do pixel mistura meio a meio', () => {
    const out = rasterizeMinimap({ ...BASE, floor: compileFloor([rect(15.5, 10, 10, 10)]) }, STYLE)
    // Borda esquerda em x = 10,5: pixel 10 metade coberto (Uint8ClampedArray arredonda meio para o par).
    expect(Math.abs(pixel(out, 30, 10, 10)[1] - 107 / 2)).toBeLessThanOrEqual(0.5)
  })

  it('traço da borda com largura 1 centrado em x=10 cobre meio pixel de cada lado', () => {
    const out = rasterizeMinimap(
      { ...BASE, floor: compileFloor([rect(15, 10, 10, 10)]) },
      { ...STYLE, stroke: [133, 133, 133], strokeAlpha: 1 },
    )
    // 133 / 2 = 66,5 → 66 (arredonda meio para o par).
    expect(pixel(out, 30, 9, 10)).toEqual([66, 66, 66])
    expect(pixel(out, 30, 10, 10)).toEqual([66, 120, 66])
    expect(pixel(out, 30, 13, 10)).toEqual([0, 107, 0])
  })

  it('linha horizontal entre centros de pixel cobre os pixels das pontas inteiros e nada além', () => {
    const line: MapLine = { id: 'l', points: [{ x: 2.5, y: 5.5 }, { x: 7.5, y: 5.5 }], closed: false, dotted: false, color: '#858585', width: 1 }
    const out = rasterizeMinimap({ ...BASE, floor: null, lines: [line] }, STYLE)
    for (let x = 2; x <= 7; x += 1) expect(pixel(out, 30, x, 5)).toEqual([133, 133, 133])
    expect(pixel(out, 30, 8, 5)).toEqual([0, 0, 0])
    expect(pixel(out, 30, 1, 5)).toEqual([0, 0, 0])
    expect(pixel(out, 30, 4, 4)).toEqual([0, 0, 0])
  })

  it('pontilhada acende um pixel sim, um não', () => {
    const line: MapLine = { id: 'l', points: [{ x: 2.5, y: 5.5 }, { x: 10.5, y: 5.5 }], closed: false, dotted: true, color: '#858585', width: 1 }
    const out = rasterizeMinimap({ ...BASE, floor: null, lines: [line] }, STYLE)
    expect([2, 3, 4, 5, 6].map((x) => pixel(out, 30, x, 5)[0])).toEqual([133, 0, 133, 0, 133])
  })

  it('linha translúcida sobre chão mistura com o verde, não com o fundo', () => {
    const line: MapLine = { id: 'l', points: [{ x: 11.5, y: 8.5 }, { x: 18.5, y: 8.5 }], closed: false, dotted: false, color: '#858585', width: 1 }
    const out = rasterizeMinimap({ ...BASE, floor: compileFloor([rect(15, 10, 10, 10)]), lines: [line] }, { ...STYLE, lineAlpha: 0.955 })
    expect(pixel(out, 30, 14, 8)).toEqual([127, 132, 127])
  })

  it('marcador elíptico (poço) pinta o disco e deixa o canto do retângulo de fora', () => {
    const out = rasterizeMinimap(
      { ...BASE, floor: null, markers: [{ id: 'p', cx: 15, cy: 10, w: 14, h: 14, rotation: 0, color: '#003300', shape: 'ellipse' }] },
      STYLE,
    )
    expect(pixel(out, 30, 15, 10)).toEqual([0, 51, 0])
    expect(pixel(out, 30, 8, 3)).toEqual([0, 0, 0])
  })

  it('porta girada 0° pinta o retângulo inteiro com a cor dela', () => {
    const out = rasterizeMinimap(
      { ...BASE, floor: null, markers: [{ id: 'k', cx: 10, cy: 10, w: 4, h: 2, rotation: 0, color: '#cc9933' }] },
      STYLE,
    )
    expect(pixel(out, 30, 8, 9)).toEqual([204, 153, 51])
    expect(pixel(out, 30, 11, 10)).toEqual([204, 153, 51])
    expect(pixel(out, 30, 12, 10)).toEqual([0, 0, 0])
  })
})
