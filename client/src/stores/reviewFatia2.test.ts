// Revisão de correção da Fatia 2 (15/09/2026): cada describe reproduz um achado.
import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import type { MapData, Region, Wall } from '../types/map'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { placeNewRoom } from '../lib/roomNesting'
import { remapForRemove } from '../lib/roomLink'
import { EMPTY_SELECTION, selectionOfItem } from '../lib/selectionModel'

const DOOR = { open: false, locked: false, kind: 'normal' as const }

/** Mãe 640×640 (10×10 células de 64) e uma filha 192×192 desenhada em `from`. */
function motherWithChild(from: { x: number; y: number }): MapData {
  let map = mapFactory.createEmptyMap('m', 'M', 30, 20, 64)
  const mae = buildRoomFromDraft('mae', ['m0', 'm1', 'm2', 'm3'], { x: 0, y: 0 }, { x: 640, y: 640 })
  map = mapFactory.addRoom(map, mae.region, mae.walls)
  const draft = buildRoomFromDraft('filha', ['f0', 'f1', 'f2', 'f3'], from, { x: from.x + 192, y: from.y + 192 })
  const placed = placeNewRoom(map.regions, map.walls, draft, null)
  return mapFactory.addRoom(map, placed.region, placed.walls)
}

function edgesOf(regionId: string | undefined): number[] {
  return [...new Set(useMapStore.getState().map.walls.filter((w) => w.regionId === regionId).map((w) => w.regionEdgeIndex ?? -1))].sort()
}

function setMap(map: MapData) {
  useMapStore.setState({ map, past: [], future: [], selection: EMPTY_SELECTION, activeTool: 'select', pendingParentRoomId: null })
}

describe('1. aresta que deixou de estar sobre a parede da mãe ganha parede, mesmo sem trocar de mãe', () => {
  beforeEach(() => setMap(motherWithChild({ x: 448, y: 192 })))

  it('filha encostada na parede leste arrastada 2 células para oeste, dentro da mesma mãe', () => {
    expect(edgesOf('filha')).toEqual([0, 2, 3])
    useMapStore.getState().moveRegion('filha', -128, 0)
    expect(useMapStore.getState().map.regions.find((r) => r.id === 'filha')?.parentId).toBe('mae')
    expect(edgesOf('filha')).toEqual([0, 1, 2, 3])
    expect(useMapStore.getState().map.walls.find((w) => w.regionId === 'filha' && w.regionEdgeIndex === 1)).toMatchObject({ x1: 512, y1: 192, x2: 512, y2: 384 })
  })

  it('largura da filha pelo painel afasta a aresta leste da parede da mãe', () => {
    useMapStore.getState().resizeRoomDimensions('filha', 128, 192)
    expect(edgesOf('filha')).toEqual([0, 1, 2, 3])
  })

  it('Ctrl+D de sub-sala encostada na parede oeste: a cópia cai na mesma mãe e ganha a parede oeste', () => {
    setMap(motherWithChild({ x: 0, y: 192 }))
    expect(edgesOf('filha')).toEqual([0, 1, 2])
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: 'filha' }))
    useMapStore.getState().duplicateSelected()
    const copyId = useMapStore.getState().selection[0]?.id
    expect(useMapStore.getState().map.regions.find((r) => r.id === copyId)?.parentId).toBe('mae')
    expect(edgesOf(copyId)).toEqual([0, 1, 2, 3])
  })
})

describe('2. abertura feita pelo usuário continua aberta ao entrar numa sala', () => {
  it('sala de topo com o lado sul apagado arrastada para dentro da mãe não ganha parede no sul', () => {
    let map = mapFactory.createEmptyMap('m', 'M', 30, 20, 64)
    const mae = buildRoomFromDraft('mae', ['m0', 'm1', 'm2', 'm3'], { x: 0, y: 0 }, { x: 640, y: 640 })
    map = mapFactory.addRoom(map, mae.region, mae.walls)
    const patio = buildRoomFromDraft('patio', ['p0', 'p1', 'p2', 'p3'], { x: 1000, y: 64 }, { x: 1192, y: 256 })
    map = mapFactory.addRoom(map, patio.region, patio.walls.filter((w) => w.regionEdgeIndex !== 2))
    setMap(map)
    useMapStore.getState().moveRegion('patio', -872, 128)
    expect(useMapStore.getState().map.regions.find((r) => r.id === 'patio')?.parentId).toBe('mae')
    expect(edgesOf('patio')).toEqual([0, 1, 3])
  })
})

/** Sala quadrada 0..100 com a aresta de cima partida por porta: 0..40, porta 40..60, 60..100. */
function squareWithDoorOnTop(): MapData {
  const region: Region = {
    id: 'r1', tag: '', fillColor: '#000', fillPattern: 'solid', data: {},
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    room: { shape: 'polygon', name: '' },
  }
  const wall = (id: string, x1: number, y1: number, x2: number, y2: number, edge: number, door: Wall['door'] = null): Wall => ({
    id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door, regionId: 'r1', regionEdgeIndex: edge,
  })
  const walls = [
    wall('antes', 0, 0, 40, 0, 0), wall('porta', 40, 0, 60, 0, 0, DOOR), wall('depois', 60, 0, 100, 0, 0),
    wall('w1', 100, 0, 100, 100, 1), wall('w2', 100, 100, 0, 100, 2), wall('w3', 0, 100, 0, 0, 3),
  ]
  return mapFactory.addRoom(mapFactory.createEmptyMap('m', 'M', 10, 10, 64), region, walls)
}

describe('3. vértice arrastado por cima do vizinho e depois para longe', () => {
  it('a porta volta à posição proporcional, sem os pedaços cobrirem a aresta inteira sobrepostos', () => {
    let map = squareWithDoorOnTop()
    // Frames do arrasto ao vivo: B passa exatamente sobre A e depois vai para (200, 0).
    map = mapFactory.updateRegionPoint(map, 'r1', 1, 0, 0)
    map = mapFactory.updateRegionPoint(map, 'r1', 1, 200, 0)
    const byId = (id: string) => map.walls.find((w) => w.id === id)
    expect(byId('antes')).toMatchObject({ x1: 0, x2: 80 })
    expect(byId('porta')).toMatchObject({ x1: 80, x2: 120, door: DOOR })
    expect(byId('depois')).toMatchObject({ x1: 120, x2: 200 })
  })
})

describe('4. vértice novo inserido no meio da porta', () => {
  it('a porta não é partida: continua uma só, com o vão inteiro', () => {
    const map = mapFactory.insertRegionPoint(squareWithDoorOnTop(), 'r1', 0, 50, 0, 'wNovo')
    const doors = map.walls.filter((w) => w.door !== null)
    expect(doors).toHaveLength(1)
    expect(Math.hypot(doors[0].x2 - doors[0].x1, doors[0].y2 - doors[0].y1)).toBeCloseTo(20)
    // Nenhuma parede comum ocupa o vão 40..60 da linha de cima.
    const solidOnTop = map.walls.filter((w) => w.door === null && w.y1 === 0 && w.y2 === 0)
    for (const w of solidOnTop) {
      const lo = Math.min(w.x1, w.x2)
      const hi = Math.max(w.x1, w.x2)
      expect(hi <= 40 || lo >= 60).toBe(true)
    }
  })
})

describe('5. remover vértice com vão deixado de propósito', () => {
  it('parede que só cobria 0..40 da aresta não estica sobre a aresta fundida inteira', () => {
    const walls: Wall[] = [
      { id: 'w0', x1: 0, y1: 0, x2: 40, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 0 },
      { id: 'w1', x1: 100, y1: 0, x2: 100, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 1 },
      { id: 'w2', x1: 100, y1: 100, x2: 0, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 2 },
    ]
    const result = remapForRemove(walls, 'r1', 1, 4, { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 })
    expect(result.find((w) => w.id === 'w0')).toMatchObject({ x1: 0, y1: 0, x2: 20, y2: 20, regionEdgeIndex: 0 })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ x1: 50, y1: 50, x2: 100, y2: 100, regionEdgeIndex: 0 })
  })
})
