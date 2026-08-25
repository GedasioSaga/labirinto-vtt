import { describe, expect, it } from 'vitest'
import { findWallAt, findLightAt, isPointInPolygon, findRegionAt, findSelectableAt } from './selectionHitTest'
import type { Wall, Light, Region, MapData } from '../types/map'
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
