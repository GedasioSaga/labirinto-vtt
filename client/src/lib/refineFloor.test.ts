import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { compileFloor, pieceDistance } from './floorSdf'
import { rasterizeMinimap } from './minimapRaster'
import { minimapCoverage, traceFloorPieces } from './traceImage'
import { refineFloorPieces, simplifyRing } from './refineFloor'

const SIZE = 130

describe('simplifyRing', () => {
  it('quadrado com pontos no meio dos lados volta aos 4 cantos', () => {
    const ring = [
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 },
      { x: 10, y: 10 }, { x: 5, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 5 },
    ]
    expect(simplifyRing(ring, 0.1)).toHaveLength(4)
  })
})

describe('refineFloorPieces', () => {
  it('leva o contorno vetorizado da face externa do traço para o centro dele (borda verdadeira)', () => {
    const truth: FloorPiece = { id: 't', shape: { kind: 'rect', cx: 64.3, cy: 60.7, w: 80.4, h: 50.2 }, op: 'add', rotation: 9, modifiers: {} }
    const reference = rasterizeMinimap(
      { originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor([truth]), lines: [], markers: [] },
      { background: [0, 0, 0], floor: [0, 107, 0], stroke: [133, 133, 133], strokeAlpha: 1, strokeWidth: 1.2, lineAlpha: 1, samples: 4, pattern: 'rooks' },
    )
    const base = traceFloorPieces(reference, SIZE, SIZE, { coverage: minimapCoverage }, (i) => `p${i}`)
    const refined = refineFloorPieces(base, reference, SIZE, SIZE)
    const meanError = (pieces: FloorPiece[]) => {
      const points = pieces.flatMap((p) => (p.shape.kind === 'poly' ? p.shape.points : []))
      return points.reduce((sum, p) => sum + Math.abs(pieceDistance(truth, p.x, p.y)), 0) / points.length
    }
    const before = meanError(base)
    const after = meanError(refined)
    expect(after).toBeLessThan(before)
    expect(after).toBeLessThan(0.25)
  })
})
