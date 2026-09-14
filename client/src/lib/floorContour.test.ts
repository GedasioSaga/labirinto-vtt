import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { buildFloorOutline, extractFloorRings, sampleFloorGrid, signedArea } from './floorContour'
import { compileFloor } from './floorSdf'

function rect(id: string, cx: number, cy: number, w: number, h: number, op: FloorPiece['op'] = 'add'): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op, modifiers: {} }
}

describe('extractFloorRings', () => {
  it('sem peças devolve lista vazia', () => {
    expect(extractFloorRings([])).toEqual([])
  })

  it('retângulo alinhado à grade vira um anel; só os 4 cantos perdem um triângulo de step²/2 cada', () => {
    const rings = extractFloorRings([rect('a', 50, 30, 100, 60)], { step: 2 })
    expect(rings).toHaveLength(1)
    const area = Math.abs(signedArea(rings[0]))
    expect(area).toBeGreaterThanOrEqual(6000 - 4 * 2)
    expect(area).toBeLessThanOrEqual(6000)
  })

  it('retângulo fora da grade de amostra perde no máximo o canto', () => {
    const rings = extractFloorRings([rect('a', 13.3, 7.7, 81, 47)], { step: 2 })
    const area = Math.abs(signedArea(rings[0]))
    expect(area).toBeGreaterThan(81 * 47 * 0.99)
    expect(area).toBeLessThanOrEqual(81 * 47 + 1)
  })
})

describe('sampleFloorGrid', () => {
  it('só pula amostra longe da borda: sinal idêntico ao de amostrar tudo, com ruído, rotação e buraco', () => {
    const pieces: FloorPiece[] = [
      { ...rect('a', 100, 80, 160, 110), rotation: 23, modifiers: { noise: { amplitude: 5, scale: 12, seed: 9 } } },
      { id: 'c', shape: { kind: 'corridor', points: [{ x: 20, y: 150, width: 6 }, { x: 190, y: 190, width: 20 }] }, op: 'add', modifiers: {} },
      rect('h', 110, 80, 40, 30, 'subtract'),
      { id: 'p', shape: { kind: 'poly', points: [{ x: 150, y: 20 }, { x: 210, y: 40 }, { x: 170, y: 70 }] }, op: 'add', modifiers: {} },
    ]
    const compiled = compileFloor(pieces)
    const step = 0.5
    const cols = 470
    const rows = 430
    const values = sampleFloorGrid(compiled, -10, -10, cols, rows, step)
    let mismatches = 0
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const exact = compiled.sample(-10 + i * step, -10 + j * step)
        if (exact < 0 !== values[j * cols + i] < 0) mismatches += 1
      }
    }
    expect(mismatches).toBe(0)
  })
})

describe('buildFloorOutline', () => {
  it('buraco fica agrupado dentro do anel externo', () => {
    const polygons = buildFloorOutline([rect('a', 0, 0, 200, 200), rect('b', 0, 0, 60, 60, 'subtract')])
    expect(polygons).toHaveLength(1)
    expect(polygons[0].holes).toHaveLength(1)
    expect(Math.abs(signedArea(polygons[0].outer))).toBeCloseTo(40000, -2)
    expect(Math.abs(signedArea(polygons[0].holes[0]))).toBeCloseTo(3600, -2)
  })

  it('duas peças separadas viram dois polígonos; sobrepostas viram um', () => {
    expect(buildFloorOutline([rect('a', 0, 0, 40, 40), rect('b', 100, 0, 40, 40)])).toHaveLength(2)
    expect(buildFloorOutline([rect('a', 0, 0, 40, 40), rect('b', 30, 0, 40, 40)])).toHaveLength(1)
  })

  it('ilha dentro de buraco é outro polígono, e não é buraco de ninguém', () => {
    const polygons = buildFloorOutline([rect('a', 0, 0, 300, 300), rect('b', 0, 0, 150, 150, 'subtract'), rect('c', 0, 0, 40, 40)])
    expect(polygons).toHaveLength(2)
    expect(polygons[0].holes).toHaveLength(1)
    expect(polygons[1].holes).toHaveLength(0)
  })

  it('corredor largo gera área próxima de comprimento × largura + as duas pontas redondas', () => {
    const corridor: FloorPiece = {
      id: 'c',
      shape: { kind: 'corridor', points: [{ x: 0, y: 0, width: 20 }, { x: 200, y: 0, width: 20 }] },
      op: 'add',
      modifiers: {},
    }
    const [polygon] = buildFloorOutline([corridor])
    const expected = 200 * 20 + Math.PI * 10 * 10
    expect(Math.abs(signedArea(polygon.outer))).toBeGreaterThan(expected * 0.98)
    expect(Math.abs(signedArea(polygon.outer))).toBeLessThan(expected * 1.02)
  })
})
