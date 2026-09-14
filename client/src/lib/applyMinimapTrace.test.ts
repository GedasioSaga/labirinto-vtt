import { describe, expect, it } from 'vitest'
import { applyMinimapTrace, createEmptyMap } from './mapFactory'

describe('applyMinimapTrace', () => {
  it('aplica peças, linhas, marcadores e estilo sem mutar o mapa original', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const piece = { id: 'p', shape: { kind: 'rect' as const, cx: 5, cy: 5, w: 4, h: 4 }, op: 'add' as const, modifiers: {} }
    const line = { id: 'l', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }], closed: false, dotted: false, color: '#858585', width: 0.7 }
    const marker = { id: 'k', cx: 1, cy: 1, w: 4, h: 2, rotation: 0, color: '#cc9933' }
    const next = applyMinimapTrace(map, [piece], [line], [marker], { strokeWidth: 0.65, renderMode: 'raster' })
    expect(next.floor).toEqual([piece])
    expect(next.lines).toEqual([line])
    expect(next.markers).toEqual([marker])
    expect(next.floorStyle.strokeWidth).toBe(0.65)
    expect(next.floorStyle.renderMode).toBe('raster')
    expect(map.floor).toHaveLength(0)
    expect(map.floorStyle.renderMode).toBeUndefined()
  })
})
