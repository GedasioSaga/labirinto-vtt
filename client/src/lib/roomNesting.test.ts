import { describe, expect, it } from 'vitest'
import type { Region, RegionPoint, Wall } from '../types/map'
import {
  ancestorsOf,
  descendantsOf,
  edgesOnParentWalls,
  findContainingRoom,
  insertIndexAfterSubtree,
  placeNewRoom,
  pointInPolygonInclusive,
} from './roomNesting'
import { buildRoomFromDraft } from './drawingFactory'

function rect(x: number, y: number, w: number, h: number): RegionPoint[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
}

function room(id: string, points: RegionPoint[], extra: Partial<Region> = {}): Region {
  return { id, points, tag: 'region', fillColor: '#a8776a', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: id }, ...extra }
}

function wall(x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id: crypto.randomUUID(), x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

describe('pointInPolygonInclusive', () => {
  it('dentro, fora e na borda (borda conta como dentro)', () => {
    const square = rect(0, 0, 100, 100)
    expect(pointInPolygonInclusive({ x: 50, y: 50 }, square)).toBe(true)
    expect(pointInPolygonInclusive({ x: 150, y: 50 }, square)).toBe(false)
    expect(pointInPolygonInclusive({ x: 100, y: 50 }, square)).toBe(true)
    expect(pointInPolygonInclusive({ x: 0, y: 0 }, square)).toBe(true)
    expect(pointInPolygonInclusive({ x: 101, y: 50 }, square)).toBe(false)
  })
})

describe('findContainingRoom', () => {
  const casa = room('casa', rect(0, 0, 640, 640))
  const quarto = room('quarto', rect(64, 64, 320, 320), { parentId: 'casa' })
  const outra = room('outra', rect(1000, 0, 200, 200))

  it('sala totalmente dentro acha a mãe; parcialmente fora não acha', () => {
    expect(findContainingRoom([casa, outra], rect(100, 100, 64, 64))?.id).toBe('casa')
    expect(findContainingRoom([casa, outra], rect(600, 100, 128, 64))).toBeNull()
  })

  it('escolhe a mais funda, mesmo com a mãe depois no array', () => {
    expect(findContainingRoom([quarto, casa], rect(128, 128, 64, 64))?.id).toBe('quarto')
  })

  it('aresta encostada na borda da mãe conta como dentro', () => {
    expect(findContainingRoom([casa], rect(0, 0, 128, 128))?.id).toBe('casa')
  })

  it('região comum (sem room) não vira mãe', () => {
    const area: Region = { ...casa, id: 'area', room: undefined }
    expect(findContainingRoom([area], rect(100, 100, 64, 64))).toBeNull()
  })
})

describe('hierarquia', () => {
  const regions = [
    room('casa', rect(0, 0, 640, 640)),
    room('quarto', rect(64, 64, 320, 320), { parentId: 'casa' }),
    room('outra', rect(1000, 0, 200, 200)),
    room('armario', rect(96, 96, 64, 64), { parentId: 'quarto' }),
    room('orfa', rect(2000, 0, 64, 64), { parentId: 'nao-existe' }),
  ]

  it('descendentes incluem netas, na ordem do array', () => {
    expect(descendantsOf(regions, 'casa').map((r) => r.id)).toEqual(['quarto', 'armario'])
    expect(descendantsOf(regions, 'outra')).toEqual([])
  })

  it('ancestrais do mais perto ao mais longe; órfã é de topo', () => {
    expect(ancestorsOf(regions, 'armario').map((r) => r.id)).toEqual(['quarto', 'casa'])
    expect(ancestorsOf(regions, 'orfa')).toEqual([])
  })

  it('ciclo corrompido não trava', () => {
    const ciclo = [room('a', rect(0, 0, 10, 10), { parentId: 'b' }), room('b', rect(0, 0, 10, 10), { parentId: 'a' })]
    expect(ancestorsOf(ciclo, 'a').map((r) => r.id)).toEqual(['b'])
    expect(descendantsOf(ciclo, 'a').map((r) => r.id)).toEqual(['b'])
  })

  it('índice de inserção fica depois da subárvore da mãe', () => {
    expect(insertIndexAfterSubtree(regions, 'casa')).toBe(4)
    expect(insertIndexAfterSubtree(regions, 'outra')).toBe(3)
    expect(insertIndexAfterSubtree(regions, 'nao-existe')).toBe(regions.length)
  })
})

describe('edgesOnParentWalls', () => {
  const parentWalls = [wall(0, 0, 640, 0), wall(640, 0, 640, 640), wall(640, 640, 0, 640), wall(0, 640, 0, 0)]

  it('aresta sobre a parede da mãe (colinear e contida) não gera parede', () => {
    // Quarto no canto de cima-esquerda: topo (0) e esquerda (3) ficam sobre a mãe.
    expect([...edgesOnParentWalls(rect(0, 0, 128, 128), parentWalls)].sort()).toEqual([0, 3])
  })

  it('aresta que não encosta, ou só colinear fora do trecho, gera parede', () => {
    expect(edgesOnParentWalls(rect(64, 64, 128, 128), parentWalls).size).toBe(0)
    expect(edgesOnParentWalls(rect(600, 0, 128, 64), [wall(0, 0, 640, 0)]).has(0)).toBe(false)
  })

  it('parede da mãe partida em dois trechos (porta) ainda cobre a aresta', () => {
    const split = [wall(0, 0, 100, 0), wall(100, 0, 132, 0, { door: { open: false, locked: false, kind: 'normal' } }), wall(132, 0, 640, 0)]
    expect(edgesOnParentWalls(rect(0, 0, 200, 100), split).has(0)).toBe(true)
  })

  it('tolerância pequena absorve arredondamento de meio pixel', () => {
    expect(edgesOnParentWalls(rect(10, 0.3, 100, 100), parentWalls).has(0)).toBe(true)
  })
})

describe('placeNewRoom', () => {
  const casaDraft = buildRoomFromDraft('casa', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 640, y: 640 }, '#123456')

  it('sala dentro vira filha com a cor da mãe e sem as paredes sobre a mãe', () => {
    const draft = buildRoomFromDraft('quarto', ['q0', 'q1', 'q2', 'q3'], { x: 0, y: 0 }, { x: 128, y: 128 }, '#a8776a')
    const placed = placeNewRoom([casaDraft.region], casaDraft.walls, draft, null)
    expect(placed.region.parentId).toBe('casa')
    expect(placed.region.fillColor).toBe('#123456')
    expect(placed.walls.map((w) => w.regionEdgeIndex)).toEqual([1, 2])
    expect(placed.missedParent).toBeNull()
  })

  it('parede da mãe com porta (partida e sem vínculo) também evita parede duplicada', () => {
    const door = { open: false, locked: false, kind: 'normal' as const }
    const topPieces = [wall(0, 0, 300, 0), wall(300, 0, 332, 0, { door }), wall(332, 0, 640, 0)]
    const walls = [...casaDraft.walls.filter((w) => w.regionEdgeIndex !== 0), ...topPieces, wall(0, 0, 640, 0, { regionId: 'outra-sala' })]
    const draft = buildRoomFromDraft('quarto', ['q0', 'q1', 'q2', 'q3'], { x: 128, y: 0 }, { x: 512, y: 128 })
    const placed = placeNewRoom([casaDraft.region], walls, draft, null)
    expect(placed.walls.map((w) => w.regionEdgeIndex)).toEqual([1, 2, 3])
    // Parede solta longe da borda da mãe não conta.
    const loose = [...casaDraft.walls.filter((w) => w.regionEdgeIndex !== 0), wall(0, 64, 640, 64)]
    expect(placeNewRoom([casaDraft.region], loose, draft, null).walls).toHaveLength(4)
  })

  it('pendente armado e sala fora: sala normal e avisa a mãe perdida', () => {
    const draft = buildRoomFromDraft('fora', ['f0', 'f1', 'f2', 'f3'], { x: 700, y: 0 }, { x: 800, y: 100 })
    const placed = placeNewRoom([casaDraft.region], casaDraft.walls, draft, 'casa')
    expect(placed.region.parentId).toBeUndefined()
    expect(placed.walls).toHaveLength(4)
    expect(placed.missedParent?.id).toBe('casa')
  })

  it('pendente armado ganha da contenção automática mais funda', () => {
    const quarto = room('quarto', rect(0, 0, 320, 320), { parentId: 'casa' })
    const draft = buildRoomFromDraft('x', ['a', 'b', 'c', 'd'], { x: 64, y: 64 }, { x: 128, y: 128 })
    expect(placeNewRoom([casaDraft.region, quarto], [], draft, null).region.parentId).toBe('quarto')
    expect(placeNewRoom([casaDraft.region, quarto], [], draft, 'casa').region.parentId).toBe('casa')
  })
})
