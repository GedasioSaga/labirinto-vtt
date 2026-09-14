import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapLine, MapMarker } from '../types/map'
import { compileFloor } from './floorSdf'
import { rasterizeMinimap, type MinimapRasterStyle } from './minimapRaster'
import { scoreWindow } from './calibrateMinimap'
import { buildMinimapFromImage, MINIMAP_IMAGE_DEFAULTS } from './minimapFromImage'

const SIZE = 140
const RECT = { x: 0, y: 0, w: SIZE, h: SIZE }
const STYLE: MinimapRasterStyle = {
  background: [0, 0, 0],
  floor: [0, 107, 0],
  stroke: [133, 133, 133],
  strokeAlpha: 0.955,
  strokeWidth: 1.2,
  lineAlpha: 0.955,
  samples: 4,
}

describe('buildMinimapFromImage', () => {
  it('ida e volta: mapa rasterizado → vetorizado → rasterizado de novo bate ≥ 97% dos pixels com tinta', () => {
    const floor: FloorPiece[] = [
      { id: 'a', shape: { kind: 'rect', cx: 70.3, cy: 66.8, w: 96.4, h: 80.2 }, op: 'add', rotation: 12, modifiers: { rounding: 4 } },
      { id: 'h', shape: { kind: 'ellipse', cx: 88, cy: 60, rx: 13.5, ry: 9.2 }, op: 'subtract', modifiers: {} },
    ]
    const lines: MapLine[] = [
      { id: 'l', points: [{ x: 35.4, y: 85.2 }, { x: 70.6, y: 92.7 }, { x: 72.1, y: 52.3 }], closed: false, dotted: false, color: '#858585', width: 1.2 },
    ]
    const markers: MapMarker[] = [{ id: 'k', cx: 50.2, cy: 50.7, w: 7, h: 2.5, rotation: 30, color: '#cc9933' }]
    const reference = rasterizeMinimap({ originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor(floor), lines, markers }, STYLE)

    const result = buildMinimapFromImage(reference, SIZE, SIZE, { ...MINIMAP_IMAGE_DEFAULTS, rect: RECT }, (kind, i) => `${kind}-${i}`)
    expect(result.pieces.length).toBeGreaterThan(0)
    expect(result.markers.length).toBe(1)
    expect(Math.abs(result.strokeWidth - 1.2)).toBeLessThanOrEqual(0.2)

    const again = rasterizeMinimap(
      { originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor(result.pieces), lines: result.lines, markers: result.markers },
      { ...STYLE, strokeWidth: result.strokeWidth },
    )
    const score = scoreWindow(reference, SIZE, again, RECT)
    expect(score.matches / score.ink).toBeGreaterThanOrEqual(0.97)
  }, 120_000)
})
