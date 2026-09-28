import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { buildFloorOutline, mapFloorClip } from './floorContour'

function peca(cx: number, cy: number): FloorPiece {
  return { id: 'p', shape: { kind: 'rect', cx, cy, w: 128, h: 128 }, op: 'add', modifiers: [] } as FloorPiece
}

const MAPA = { width: 10, height: 10, grid: 100 }

describe('recorte do chão no limite do mapa', () => {
  it('chão que passa da borda fica só dentro do mapa', () => {
    const polys = buildFloorOutline([peca(0, 0)], { step: 4, clip: mapFloorClip(MAPA) })
    expect(polys.length).toBeGreaterThan(0)
    const pontos = polys.flatMap((p) => [p.outer, ...p.holes]).flat()
    for (const ponto of pontos) {
      expect(ponto.x).toBeGreaterThanOrEqual(-0.5)
      expect(ponto.y).toBeGreaterThanOrEqual(-0.5)
    }
    expect(Math.max(...pontos.map((p) => p.x))).toBeGreaterThan(50)
  })

  it('chão todo fora do mapa some', () => {
    expect(buildFloorOutline([peca(-500, -500)], { step: 4, clip: mapFloorClip(MAPA) })).toEqual([])
  })

  it('mapa sem tamanho não recorta', () => {
    expect(mapFloorClip({ width: 0, height: 10, grid: 100 })).toBeUndefined()
  })
})
