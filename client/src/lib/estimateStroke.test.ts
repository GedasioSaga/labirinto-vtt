import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapLine } from '../types/map'
import { compileFloor } from './floorSdf'
import { rasterizeMinimap, type MinimapRasterStyle } from './minimapRaster'
import { estimateFloorStrokeWidth, estimateLineWidth } from './estimateStroke'

const STYLE: MinimapRasterStyle = {
  background: [0, 0, 0],
  floor: [0, 107, 0],
  stroke: [133, 133, 133],
  strokeAlpha: 1,
  strokeWidth: 1.5,
  lineAlpha: 1,
  samples: 4,
}

const SIZE = 120
const RECT = { x: 0, y: 0, w: SIZE, h: SIZE }

describe('estimateFloorStrokeWidth', () => {
  it.each([0.7, 1.5])('recupera a largura %s px do contorno rasterizado com antisserrilhado', (strokeWidth) => {
    const piece: FloorPiece = { id: 'r', shape: { kind: 'rect', cx: 60.3, cy: 58.7, w: 70.4, h: 50.2 }, op: 'add', modifiers: { rounding: 6 } }
    const pixels = rasterizeMinimap(
      { originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor([piece]), lines: [], markers: [] },
      { ...STYLE, strokeWidth },
    )
    const estimated = estimateFloorStrokeWidth(pixels, SIZE, SIZE, [piece], RECT)
    expect(estimated).not.toBeNull()
    expect(Math.abs((estimated as number) - strokeWidth)).toBeLessThan(0.08)
  })

  it('sem chão devolve null', () => {
    expect(estimateFloorStrokeWidth(new Uint8ClampedArray(SIZE * SIZE * 4), SIZE, SIZE, [], RECT)).toBeNull()
  })
})

describe('estimateLineWidth', () => {
  it('recupera a largura de linhas contínuas em ângulos diferentes e ignora pontilhadas', () => {
    const lines: MapLine[] = [
      { id: 'a', points: [{ x: 10.2, y: 20.4 }, { x: 100.7, y: 20.4 }], closed: false, dotted: false, color: '#858585', width: 1.4 },
      { id: 'b', points: [{ x: 15.1, y: 40.3 }, { x: 90.6, y: 95.8 }], closed: false, dotted: false, color: '#858585', width: 1.4 },
      { id: 'c', points: [{ x: 10.5, y: 110.5 }, { x: 60.5, y: 110.5 }], closed: false, dotted: true, color: '#858585', width: 1.4 },
    ]
    const pixels = rasterizeMinimap({ originX: 0, originY: 0, width: SIZE, height: SIZE, floor: null, lines, markers: [] }, STYLE)
    const estimated = estimateLineWidth(pixels, SIZE, SIZE, lines)
    expect(Math.abs((estimated as number) - 1.4)).toBeLessThan(0.08)
    expect(estimateLineWidth(pixels, SIZE, SIZE, [lines[2]])).toBeNull()
  })
})
