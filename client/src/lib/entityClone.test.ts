import { describe, expect, it } from 'vitest'
import { cloneWall, cloneLight, cloneRegion, cloneToken, cloneProp, cloneStair, cloneDrawing, cloneEntity } from './entityClone'
import type { Wall, Light, Region, Token, Prop, Stair, Drawing } from '../types/map'

const OFFSET = { dx: 10, dy: 20 }

describe('cloneWall', () => {
  const base: Wall = {
    id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0,
    blocksLight: true, blocksMove: true, door: null,
  }

  it('gera id novo e aplica o offset nas duas pontas', () => {
    const clone = cloneWall(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ x1: 10, y1: 20, x2: 110, y2: 20 })
  })

  it('solta o vínculo com a Região — regionId/regionEdgeIndex não sobrevivem à clonagem', () => {
    const linked: Wall = { ...base, regionId: 'room-1', regionEdgeIndex: 2 }
    const clone = cloneWall(linked, OFFSET)
    expect(clone.regionId).toBeUndefined()
    expect(clone.regionEdgeIndex).toBeUndefined()
    // original intocado
    expect(linked.regionId).toBe('room-1')
    expect(linked.regionEdgeIndex).toBe(2)
  })

  it('clona a porta como objeto novo, sem aliasing', () => {
    const withDoor: Wall = { ...base, door: { open: false, locked: false, kind: 'normal' } }
    const clone = cloneWall(withDoor, OFFSET)
    expect(clone.door).toEqual(withDoor.door)
    expect(clone.door).not.toBe(withDoor.door)
  })

  it('parede sem porta clona door: null', () => {
    const clone = cloneWall(base, OFFSET)
    expect(clone.door).toBeNull()
  })
})

describe('cloneLight', () => {
  const base: Light = { id: 'l1', x: 5, y: 5, radius: 100, color: '#fff', intensity: 0.8 }

  it('gera id novo e aplica offset', () => {
    const clone = cloneLight(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ x: 15, y: 25, radius: 100, color: '#fff', intensity: 0.8 })
  })
})

describe('cloneRegion', () => {
  const base: Region = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    tag: 'region',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }

  it('gera id novo e desloca todos os pontos', () => {
    const clone = cloneRegion(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone.points).toEqual([
      { x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 120 }, { x: 10, y: 120 },
    ])
  })

  it('clone profundo: mutar o array de pontos do clone não afeta o original', () => {
    const clone = cloneRegion(base, OFFSET)
    expect(clone.points).not.toBe(base.points)
    clone.points[0].x = 9999
    clone.points.push({ x: 1, y: 1 })
    expect(base.points[0].x).toBe(0)
    expect(base.points).toHaveLength(4)
  })

  it('região sem room permanece sem room no clone', () => {
    const clone = cloneRegion(base, OFFSET)
    expect(clone.room).toBeUndefined()
  })

  it('Sala (região com room): nome do clone fica distinguível do original', () => {
    const room: Region = { ...base, room: { shape: 'rect', name: 'Sala do Tesouro' } }
    const clone = cloneRegion(room, OFFSET)
    expect(clone.room?.name).not.toBe(room.room?.name)
    expect(clone.room?.name).toContain('Sala do Tesouro')
    expect(clone.room?.shape).toBe('rect')
    // original intocado
    expect(room.room?.name).toBe('Sala do Tesouro')
  })

  it('data é copiado como objeto novo (não a mesma referência)', () => {
    const withData: Region = { ...base, data: { note: 'x' } }
    const clone = cloneRegion(withData, OFFSET)
    expect(clone.data).toEqual(withData.data)
    expect(clone.data).not.toBe(withData.data)
  })
})

describe('cloneToken', () => {
  const base: Token = { id: 't1', characterId: null, name: 'Goblin', x: 0, y: 0, size: 1, image: null }

  it('gera id novo e aplica offset', () => {
    const clone = cloneToken(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ x: 10, y: 20, name: 'Goblin' })
  })

  it('reusa o mesmo caminho de imagem, não duplica arquivo', () => {
    const withImage: Token = { ...base, image: 'C:\\maps\\assets\\goblin.png' }
    const clone = cloneToken(withImage, OFFSET)
    expect(clone.image).toBe(withImage.image)
  })
})

describe('cloneProp', () => {
  const base: Prop = { id: 'p1', src: 'torch.png', x: 0, y: 0, width: 32, height: 32, linkedMapPath: null }

  it('gera id novo e aplica offset', () => {
    const clone = cloneProp(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ x: 10, y: 20 })
  })

  it('portal (linkedMapPath): clone aponta para o mesmo mapa-alvo', () => {
    const portal: Prop = { ...base, linkedMapPath: 'maps/L2.json' }
    const clone = cloneProp(portal, OFFSET)
    expect(clone.linkedMapPath).toBe('maps/L2.json')
  })
})

describe('cloneStair', () => {
  const base: Stair = {
    id: 's1',
    shape: 'straight',
    direction: 'up',
    segments: [{ x1: 0, y1: 0, x2: 0, y2: 50 }],
    stepWidth: 32,
  }

  it('gera id novo e desloca os segmentos', () => {
    const clone = cloneStair(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone.segments).toEqual([{ x1: 10, y1: 20, x2: 10, y2: 70 }])
  })

  it('clone profundo: mutar segments do clone não afeta o original', () => {
    const clone = cloneStair(base, OFFSET)
    expect(clone.segments).not.toBe(base.segments)
    clone.segments[0].x1 = 9999
    expect(base.segments[0].x1).toBe(0)
  })
})

describe('cloneDrawing — 8 kinds', () => {
  it('freehand: id novo + pontos deslocados + array novo', () => {
    const base: Drawing = { id: 'd1', kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#fff', width: 2 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    if (clone.kind !== 'freehand' || base.kind !== 'freehand') throw new Error('kind incorreto')
    expect(clone.points).toEqual([{ x: 10, y: 20 }, { x: 20, y: 30 }])
    expect(clone.points).not.toBe(base.points)
    clone.points[0].x = 9999
    expect(base.points[0].x).toBe(0)
  })

  it('line: id novo + x1/y1/x2/y2 deslocados', () => {
    const base: Drawing = { id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: '#fff', width: 2 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ kind: 'line', x1: 10, y1: 20, x2: 110, y2: 20 })
  })

  it('circle: id novo + cx/cy deslocados', () => {
    const base: Drawing = { id: 'd1', kind: 'circle', cx: 0, cy: 0, radius: 20, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ kind: 'circle', cx: 10, cy: 20, radius: 20 })
  })

  it('curve: id novo + pontos deslocados + array novo', () => {
    const base: Drawing = { id: 'd1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }], color: '#fff', width: 2 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    if (clone.kind !== 'curve' || base.kind !== 'curve') throw new Error('kind incorreto')
    expect(clone.points).toEqual([{ x: 10, y: 20 }, { x: 20, y: 30 }, { x: 30, y: 20 }])
    expect(clone.points).not.toBe(base.points)
    clone.points.push({ x: 1, y: 1 })
    expect(base.points).toHaveLength(3)
  })

  it('text: id novo + x/y deslocados', () => {
    const base: Drawing = { id: 'd1', kind: 'text', x: 0, y: 0, text: 'olá', color: '#fff', fontSize: 16 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ kind: 'text', x: 10, y: 20, text: 'olá' })
  })

  it('rect: id novo + x/y deslocados (w/h preservados)', () => {
    const base: Drawing = { id: 'd1', kind: 'rect', x: 0, y: 0, w: 50, h: 30, color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ kind: 'rect', x: 10, y: 20, w: 50, h: 30 })
  })

  it('ellipse: id novo + cx/cy deslocados', () => {
    const base: Drawing = { id: 'd1', kind: 'ellipse', cx: 0, cy: 0, rx: 40, ry: 20, color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    expect(clone).toMatchObject({ kind: 'ellipse', cx: 10, cy: 20, rx: 40, ry: 20 })
  })

  it('polygon: id novo + pontos deslocados + array novo', () => {
    const base: Drawing = { id: 'd1', kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const clone = cloneDrawing(base, OFFSET)
    expect(clone.id).not.toBe(base.id)
    if (clone.kind !== 'polygon' || base.kind !== 'polygon') throw new Error('kind incorreto')
    expect(clone.points).not.toBe(base.points)
    clone.points[0].x = 9999
    expect(base.points[0].x).toBe(0)
  })
})

describe('cloneEntity — dispatcher por SelectionKind', () => {
  it('wall: delega para cloneWall e preserva o kind', () => {
    const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 10, y2: 0, blocksLight: true, blocksMove: true, door: null }
    const result = cloneEntity({ kind: 'wall', entity: wall }, OFFSET)
    expect(result.kind).toBe('wall')
    expect(result.entity.id).not.toBe(wall.id)
    expect(result.entity).toMatchObject({ x1: 10, y1: 20 })
  })

  it('drawing: delega para cloneDrawing e preserva o kind', () => {
    const drawing: Drawing = { id: 'd1', kind: 'text', x: 0, y: 0, text: 'x', color: '#fff', fontSize: 12 }
    const result = cloneEntity({ kind: 'drawing', entity: drawing }, OFFSET)
    expect(result.kind).toBe('drawing')
    expect(result.entity.id).not.toBe(drawing.id)
  })

  it('token: delega para cloneToken e preserva o kind', () => {
    const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null }
    const result = cloneEntity({ kind: 'token', entity: token }, OFFSET)
    expect(result.kind).toBe('token')
    expect(result.entity.id).not.toBe(token.id)
  })
})
