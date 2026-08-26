import { describe, expect, it } from 'vitest'
import {
  isValidWallDraft,
  buildWallFromDraft,
  buildLightAt,
  buildRegionFromPoints,
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
  it('cria região com tag e cor default', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r1', points)
    expect(region).toEqual({ id: 'r1', points, tag: 'region', fillColor: '#3a7ad0', data: {} })
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
  it('cria rótulo de texto com texto default "Rótulo" e os campos dados', () => {
    expect(buildTextDrawing('d5', { x: 10, y: 20 }, '#123456', 24)).toEqual({
      id: 'd5', kind: 'text', x: 10, y: 20, text: 'Rótulo', color: '#123456', fontSize: 24,
    })
  })
})
