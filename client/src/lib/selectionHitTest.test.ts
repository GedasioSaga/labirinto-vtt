import { describe, expect, it } from 'vitest'
import { findWallAt, findLightAt, isPointInPolygon, findRegionAt, findDrawingAt, findSelectableAt } from './selectionHitTest'
import type { Wall, Light, Region, Drawing, MapData } from '../types/map'
import { createEmptyMap, addWall, addLight, addRegion, addToken, addProp } from './mapFactory'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null }
const light: Light = { id: 'l1', x: 200, y: 200, radius: 300, color: '#ffaa33', intensity: 0.8 }
const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], tag: '', data: {} }

describe('findWallAt', () => {
  it('ponto perto do segmento (dentro da tolerância) encontra a parede', () => {
    expect(findWallAt([wall], { x: 50, y: 3 })?.id).toBe('w1')
  })

  it('ponto longe do segmento não encontra nada', () => {
    expect(findWallAt([wall], { x: 50, y: 100 })).toBeNull()
  })

  it('ponto perto mas fora do intervalo do segmento (além da ponta) não encontra', () => {
    expect(findWallAt([wall], { x: 150, y: 0 })).toBeNull()
  })
})

describe('findLightAt', () => {
  it('ponto perto do centro da luz encontra (raio de seleção, não o raio de iluminação)', () => {
    expect(findLightAt([light], { x: 202, y: 200 })?.id).toBe('l1')
  })

  it('ponto dentro do raio de iluminação mas longe do centro não encontra (seleção é pelo centro, não pelo glow inteiro)', () => {
    expect(findLightAt([light], { x: 400, y: 200 })).toBeNull()
  })
})

describe('isPointInPolygon', () => {
  it('ponto claramente dentro do quadrado retorna true', () => {
    expect(isPointInPolygon({ x: 50, y: 50 }, region.points)).toBe(true)
  })

  it('ponto claramente fora do quadrado retorna false', () => {
    expect(isPointInPolygon({ x: 500, y: 500 }, region.points)).toBe(false)
  })
})

describe('findRegionAt', () => {
  it('encontra a região que contém o ponto', () => {
    expect(findRegionAt([region], { x: 50, y: 50 })?.id).toBe('r1')
  })

  it('região degenerada (menos de 3 pontos) nunca é encontrada', () => {
    const degenerate: Region = { id: 'r2', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], tag: '', data: {} }
    expect(findRegionAt([degenerate], { x: 0, y: 0 })).toBeNull()
  })
})

const freehandDrawing: Drawing = { id: 'd1', kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], color: '#fff', width: 4 }
const lineDrawing: Drawing = { id: 'd2', kind: 'line', x1: 0, y1: 50, x2: 100, y2: 50, color: '#fff', width: 4 }
const circleOutline: Drawing = { id: 'd3', kind: 'circle', cx: 200, cy: 200, radius: 50, color: '#fff', width: 4, filled: false }
const circleFilled: Drawing = { id: 'd4', kind: 'circle', cx: 300, cy: 300, radius: 50, color: '#fff', width: 4, filled: true }

describe('findDrawingAt', () => {
  it('encontra freehand perto de um segmento do traço', () => {
    expect(findDrawingAt([freehandDrawing], { x: 50, y: 3 })?.id).toBe('d1')
  })

  it('não encontra freehand longe de qualquer segmento', () => {
    expect(findDrawingAt([freehandDrawing], { x: 50, y: 100 })).toBeNull()
  })

  it('encontra line perto do segmento', () => {
    expect(findDrawingAt([lineDrawing], { x: 50, y: 52 })?.id).toBe('d2')
  })

  it('circle sem fill: só encontra perto do anel, não no centro', () => {
    expect(findDrawingAt([circleOutline], { x: 250, y: 200 })?.id).toBe('d3')
    expect(findDrawingAt([circleOutline], { x: 200, y: 200 })).toBeNull()
  })

  it('circle com fill: encontra em qualquer ponto dentro do raio', () => {
    expect(findDrawingAt([circleFilled], { x: 300, y: 300 })?.id).toBe('d4')
    expect(findDrawingAt([circleFilled], { x: 320, y: 300 })?.id).toBe('d4')
  })
})

describe('findSelectableAt — drawing na cadeia de prioridade', () => {
  it('drawing tem prioridade sobre parede/região, mas não é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = { ...map, drawings: [lineDrawing] }
    const hit = findSelectableAt(map, { x: 50, y: 52 })
    expect(hit).toEqual({ kind: 'drawing', id: 'd2', draggable: false })
  })

  it('luz tem prioridade sobre drawing quando ambos no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addLight(map, { id: 'l1', x: 50, y: 52, radius: 300, color: '#fff', intensity: 1 })
    map = { ...map, drawings: [lineDrawing] }
    const hit = findSelectableAt(map, { x: 50, y: 52 })
    expect(hit).toEqual({ kind: 'light', id: 'l1', draggable: false })
  })
})

describe('findSelectableAt (cadeia de prioridade)', () => {
  it('token tem prioridade sobre tudo (marcável e arrastável)', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addWall(map, wall)
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 50, y: 3, size: 1 })
    const hit = findSelectableAt(map, { x: 50, y: 3 })
    expect(hit).toEqual({ kind: 'token', id: 't1', draggable: true })
  })

  it('prop tem prioridade sobre luz/parede/região (marcável e arrastável)', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addProp(map, { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 20 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'prop', id: 'p1', draggable: true })
  })

  it('luz tem prioridade sobre parede/região, mas não é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'light', id: 'l1', draggable: false })
  })

  it('parede tem prioridade sobre região, mas não é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addWall(map, { id: 'w2', x1: 0, y1: 50, x2: 100, y2: 50, blocksLight: true, blocksMove: true, door: null })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'wall', id: 'w2', draggable: false })
  })

  it('token tem prioridade sobre prop quando ambos estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addProp(map, { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 20 })
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 50, y: 50, size: 1 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'token', id: 't1', draggable: true })
  })

  it('prop tem prioridade sobre luz quando ambas estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    map = addProp(map, { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 20 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'prop', id: 'p1', draggable: true })
  })

  it('luz tem prioridade sobre parede quando ambas estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addWall(map, { id: 'w2', x1: 0, y1: 50, x2: 100, y2: 50, blocksLight: true, blocksMove: true, door: null })
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'light', id: 'l1', draggable: false })
  })

  it('token tem prioridade sobre luz e região quando todos estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 50, y: 50, size: 1 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'token', id: 't1', draggable: true })
  })

  it('região é encontrada quando não há nada mais específico no ponto, e não é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'region', id: 'r1', draggable: false })
  })

  it('retorna null quando nada está no ponto', () => {
    const map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    expect(findSelectableAt(map, { x: 9999, y: 9999 })).toBeNull()
  })
})
