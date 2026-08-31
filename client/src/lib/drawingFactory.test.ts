import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import {
  isValidWallDraft,
  buildWallFromDraft,
  buildLightAt,
  buildRegionFromPoints,
  isValidRoomDraft,
  buildRoomFromDraft,
  isValidRegularPolygonDraft,
  buildRegularPolygonRoomFromDraft,
  isValidFreehandDraft,
  buildFreehandDrawing,
  isValidLineDraft,
  buildLineDrawing,
  isValidCircleDraft,
  buildCircleDrawing,
  isValidCurveDraft,
  buildCurveDrawing,
  isValidTextDraft,
  buildTextDrawing,
} from './drawingFactory'

describe('isValidWallDraft', () => {
  it('mesmo ponto de início e fim é inválido (clique sem arrastar)', () => {
    expect(isValidWallDraft({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(false)
  })

  it('pontos diferentes é válido', () => {
    expect(isValidWallDraft({ x: 0, y: 0 }, { x: 64, y: 0 })).toBe(true)
  })
})

describe('buildWallFromDraft', () => {
  it('cria parede sólida (bloqueia luz e movimento, sem porta) com o id dado', () => {
    const wall = buildWallFromDraft('w1', { x: 0, y: 0 }, { x: 64, y: 0 })
    expect(wall).toEqual({
      id: 'w1',
      x1: 0,
      y1: 0,
      x2: 64,
      y2: 0,
      blocksLight: true,
      blocksMove: true,
      door: null,
    })
  })
})

describe('buildLightAt', () => {
  it('cria luz com raio proporcional ao grid e defaults de tocha', () => {
    const light = buildLightAt('l1', { x: 32, y: 32 }, 64)
    expect(light).toEqual({
      id: 'l1',
      x: 32,
      y: 32,
      radius: 512,
      color: '#ffaa33',
      intensity: 0.8,
    })
  })

  it('raio escala com o tamanho do grid', () => {
    const light = buildLightAt('l2', { x: 0, y: 0 }, 32)
    expect(light.radius).toBe(256)
  })
})

describe('buildRegionFromPoints', () => {
  it('cria região com tag, cor e padrão de preenchimento default', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r1', points)
    expect(region).toEqual({ id: 'r1', points, tag: 'region', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} })
  })

  it('aceita tag customizada', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r2', points, 'trap')
    expect(region.tag).toBe('trap')
  })

  it('aceita cor customizada', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r3', points, 'trap', '#00ff00')
    expect(region.fillColor).toBe('#00ff00')
  })

  it('aceita padrão de preenchimento customizado', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r4', points, 'trap', '#00ff00', 'hatch')
    expect(region.fillPattern).toBe('hatch')
  })

  it('sem passar fillPattern, default é solid', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r5', points, 'trap', '#00ff00')
    expect(region.fillPattern).toBe('solid')
  })
})

describe('isValidRoomDraft', () => {
  it('retângulo normal (largura e altura diferentes de zero) é válido', () => {
    expect(isValidRoomDraft({ x: 0, y: 0 }, { x: 100, y: 50 })).toBe(true)
  })

  it('largura zero é inválido', () => {
    expect(isValidRoomDraft({ x: 10, y: 0 }, { x: 10, y: 50 })).toBe(false)
  })

  it('altura zero é inválido', () => {
    expect(isValidRoomDraft({ x: 0, y: 20 }, { x: 100, y: 20 })).toBe(false)
  })
})

describe('buildRoomFromDraft', () => {
  const wallIds: [string, string, string, string] = ['wt', 'wr', 'wb', 'wl']

  it('normaliza o drag canto-a-canto (start embaixo-direita, end em cima-esquerda) pro retângulo padrão', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 100, y: 100 }, { x: 0, y: 0 })

    expect(region.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ])
  })

  it('drag em qualquer uma das 4 direções sempre normaliza pro mesmo resultado', () => {
    const corners: [Point, Point][] = [
      [{ x: 0, y: 0 }, { x: 100, y: 100 }], // cima-esquerda -> baixo-direita
      [{ x: 100, y: 100 }, { x: 0, y: 0 }], // baixo-direita -> cima-esquerda
      [{ x: 0, y: 100 }, { x: 100, y: 0 }], // baixo-esquerda -> cima-direita
      [{ x: 100, y: 0 }, { x: 0, y: 100 }], // cima-direita -> baixo-esquerda
    ]

    const results = corners.map(([start, end]) => buildRoomFromDraft('r1', wallIds, start, end))

    for (const { region } of results) {
      expect(region.points).toEqual([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ])
    }
  })

  it('as 4 paredes usam os wallIds dados, na ordem topo/direita/baixo/esquerda, vinculadas à região', () => {
    const { region, walls } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 })

    expect(walls).toHaveLength(4)
    expect(walls[0]).toMatchObject({ id: 'wt', regionId: region.id, regionEdgeIndex: 0, x1: 0, y1: 0, x2: 100, y2: 0 })
    expect(walls[1]).toMatchObject({ id: 'wr', regionId: region.id, regionEdgeIndex: 1, x1: 100, y1: 0, x2: 100, y2: 100 })
    expect(walls[2]).toMatchObject({ id: 'wb', regionId: region.id, regionEdgeIndex: 2, x1: 100, y1: 100, x2: 0, y2: 100 })
    expect(walls[3]).toMatchObject({ id: 'wl', regionId: region.id, regionEdgeIndex: 3, x1: 0, y1: 100, x2: 0, y2: 0 })
    for (const wall of walls) {
      expect(wall.blocksLight).toBe(true)
      expect(wall.blocksMove).toBe(true)
      expect(wall.door).toBeNull()
    }
  })

  it('usa fillColor/fillPattern default quando não fornecidos', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 })
    expect(region.fillColor).toBe('#3a7ad0')
    expect(region.fillPattern).toBe('solid')
  })

  it('aceita fillColor/fillPattern customizados', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 }, '#00ff00', 'hatch')
    expect(region.fillColor).toBe('#00ff00')
    expect(region.fillPattern).toBe('hatch')
  })
})

describe('isValidRegularPolygonDraft', () => {
  it('raio zero (clique sem arrastar) é inválido', () => {
    expect(isValidRegularPolygonDraft({ x: 50, y: 50 }, { x: 50, y: 50 })).toBe(false)
  })

  it('raio bem pequeno (jitter de sub-pixel) é inválido', () => {
    expect(isValidRegularPolygonDraft({ x: 50, y: 50 }, { x: 50.3, y: 50 })).toBe(false)
  })

  it('raio positivo além do mínimo é válido', () => {
    expect(isValidRegularPolygonDraft({ x: 50, y: 50 }, { x: 150, y: 50 })).toBe(true)
  })
})

describe('buildRegularPolygonRoomFromDraft', () => {
  function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
    expect(actual.x).toBeCloseTo(expected.x, 5)
    expect(actual.y).toBeCloseTo(expected.y, 5)
  }

  it('sides=3 (triângulo): gera 3 pontos, o primeiro sob radiusPoint, e 3 paredes vinculadas', () => {
    const wallIds = ['w0', 'w1', 'w2']
    const center = { x: 0, y: 0 }
    const radiusPoint = { x: 100, y: 0 }
    const { region, walls } = buildRegularPolygonRoomFromDraft('r1', wallIds, center, radiusPoint, 3)

    expect(region.points).toHaveLength(3)
    expectPointClose(region.points[0], { x: 100, y: 0 })
    expectPointClose(region.points[1], { x: -50, y: 86.602540 })
    expectPointClose(region.points[2], { x: -50, y: -86.602540 })

    expect(walls).toHaveLength(3)
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const wall = walls[edgeIndex]
      const from = region.points[edgeIndex]
      const to = region.points[(edgeIndex + 1) % 3]
      expect(wall.id).toBe(wallIds[edgeIndex])
      expect(wall.regionId).toBe(region.id)
      expect(wall.regionEdgeIndex).toBe(edgeIndex)
      expectPointClose({ x: wall.x1, y: wall.y1 }, from)
      expectPointClose({ x: wall.x2, y: wall.y2 }, to)
      expect(wall.blocksLight).toBe(true)
      expect(wall.blocksMove).toBe(true)
      expect(wall.door).toBeNull()
    }
  })

  it('sides=6 (hexágono): gera 6 pontos e 6 paredes, todas com regionEdgeIndex 0..5', () => {
    const wallIds = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5']
    const center = { x: 0, y: 0 }
    const radiusPoint = { x: 100, y: 0 }
    const { region, walls } = buildRegularPolygonRoomFromDraft('r2', wallIds, center, radiusPoint, 6)

    expect(region.points).toHaveLength(6)
    expectPointClose(region.points[0], { x: 100, y: 0 })
    expectPointClose(region.points[1], { x: 50, y: 86.602540 })
    expectPointClose(region.points[2], { x: -50, y: 86.602540 })
    expectPointClose(region.points[3], { x: -100, y: 0 })
    expectPointClose(region.points[4], { x: -50, y: -86.602540 })
    expectPointClose(region.points[5], { x: 50, y: -86.602540 })

    expect(walls).toHaveLength(6)
    expect(walls.map((w) => w.regionEdgeIndex).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 1, 2, 3, 4, 5])
    for (const wall of walls) {
      expect(wall.regionId).toBe(region.id)
      expect(wall.door).toBeNull()
    }
  })

  it('usa fillColor/fillPattern default quando não fornecidos', () => {
    const { region } = buildRegularPolygonRoomFromDraft('r3', ['w0', 'w1', 'w2'], { x: 0, y: 0 }, { x: 10, y: 0 }, 3)
    expect(region.fillColor).toBe('#3a7ad0')
    expect(region.fillPattern).toBe('solid')
  })

  it('aceita fillColor/fillPattern customizados', () => {
    const { region } = buildRegularPolygonRoomFromDraft(
      'r4', ['w0', 'w1', 'w2'], { x: 0, y: 0 }, { x: 10, y: 0 }, 3, '#00ff00', 'hatch',
    )
    expect(region.fillColor).toBe('#00ff00')
    expect(region.fillPattern).toBe('hatch')
  })
})

describe('isValidFreehandDraft', () => {
  it('menos de 2 pontos é inválido', () => {
    expect(isValidFreehandDraft([{ x: 0, y: 0 }])).toBe(false)
  })
  it('2+ pontos é válido', () => {
    expect(isValidFreehandDraft([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true)
  })
})

describe('buildFreehandDrawing', () => {
  it('cria desenho freehand com os pontos, cor e espessura dados', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    expect(buildFreehandDrawing('d1', points, '#ff0000', 6)).toEqual({
      id: 'd1', kind: 'freehand', points, color: '#ff0000', width: 6,
    })
  })
})

describe('isValidLineDraft', () => {
  it('mesmo ponto de início e fim é inválido', () => {
    expect(isValidLineDraft({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })
  it('pontos diferentes é válido', () => {
    expect(isValidLineDraft({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true)
  })
})

describe('buildLineDrawing', () => {
  it('cria desenho line com extremos, cor e espessura dados', () => {
    expect(buildLineDrawing('d2', { x: 0, y: 0 }, { x: 10, y: 20 }, '#00ff00', 3)).toEqual({
      id: 'd2', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 20, color: '#00ff00', width: 3,
    })
  })
})

describe('isValidCircleDraft', () => {
  it('raio zero ou negativo é inválido', () => {
    expect(isValidCircleDraft(0)).toBe(false)
    expect(isValidCircleDraft(-5)).toBe(false)
  })
  it('raio positivo é válido', () => {
    expect(isValidCircleDraft(10)).toBe(true)
  })
})

describe('buildCircleDrawing', () => {
  it('cria desenho circle com centro, raio, cor, espessura e filled dados', () => {
    expect(buildCircleDrawing('d3', { x: 50, y: 50 }, 30, '#0000ff', 2, true)).toEqual({
      id: 'd3', kind: 'circle', cx: 50, cy: 50, radius: 30, color: '#0000ff', width: 2, filled: true,
    })
  })
})

describe('isValidCurveDraft', () => {
  it('menos de 2 pontos é inválido', () => {
    expect(isValidCurveDraft([{ x: 0, y: 0 }])).toBe(false)
  })
  it('2+ pontos é válido', () => {
    expect(isValidCurveDraft([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true)
  })
})

describe('buildCurveDrawing', () => {
  it('cria desenho curve com os pontos simplificados, cor e espessura dados', () => {
    const rawPoints = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 30, y: 0 }]
    expect(buildCurveDrawing('d4', rawPoints, '#123456', 5)).toEqual({
      id: 'd4', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], color: '#123456', width: 5,
    })
  })
})

describe('isValidTextDraft', () => {
  it('sempre é válido (colocação por clique, sem arrasto)', () => {
    expect(isValidTextDraft()).toBe(true)
  })
})

describe('buildTextDrawing', () => {
  it('cria rótulo de texto com texto default "Rótulo", fontFamily default "Arial" e os campos dados', () => {
    expect(buildTextDrawing('d5', { x: 10, y: 20 }, '#123456', 24)).toEqual({
      id: 'd5', kind: 'text', x: 10, y: 20, text: 'Rótulo', color: '#123456', fontSize: 24, fontFamily: 'Arial',
    })
  })

  it('aceita fontFamily customizada', () => {
    const drawing = buildTextDrawing('d6', { x: 0, y: 0 }, '#000000', 16, 'Georgia')
    expect(drawing).toMatchObject({ fontFamily: 'Georgia' })
  })
})
