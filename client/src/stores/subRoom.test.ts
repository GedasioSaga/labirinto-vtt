import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import type { MapData } from '../types/map'
import * as mapFactory from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { moveAreaSelection } from '../lib/areaSelection'
import { placeNewRoom } from '../lib/roomNesting'
import { EMPTY_SELECTION, selectionOfItem } from '../lib/selectionModel'

/** Casa 0..640 com quarto no canto (topo e esquerda sobre a casa) e armário dentro do quarto, com porta no quarto. */
function houseMap(): MapData {
  let map = mapFactory.createEmptyMap('m', 'M', 30, 20, 64)
  const casa = buildRoomFromDraft('casa', ['c0', 'c1', 'c2', 'c3'], { x: 0, y: 0 }, { x: 640, y: 640 }, '#445566')
  map = mapFactory.addRoom(map, casa.region, casa.walls)
  const outra = buildRoomFromDraft('outra', ['o0', 'o1', 'o2', 'o3'], { x: 1000, y: 0 }, { x: 1200, y: 200 })
  map = mapFactory.addRoom(map, outra.region, outra.walls)
  const quartoDraft = buildRoomFromDraft('quarto', ['q0', 'q1', 'q2', 'q3'], { x: 0, y: 0 }, { x: 320, y: 320 })
  const quarto = placeNewRoom(map.regions, map.walls, quartoDraft, null)
  map = mapFactory.addRoom(map, quarto.region, quarto.walls)
  map = { ...map, walls: map.walls.map((w) => (w.id === 'q1' ? { ...w, door: { open: false, locked: false, kind: 'normal' } } : w)) }
  const armarioDraft = buildRoomFromDraft('armario', ['a0', 'a1', 'a2', 'a3'], { x: 64, y: 64 }, { x: 128, y: 128 })
  const armario = placeNewRoom(map.regions, map.walls, armarioDraft, null)
  return mapFactory.addRoom(map, armario.region, armario.walls)
}

describe('mapFactory com sub-salas', () => {
  it('addRoom põe a filha logo depois da subárvore da mãe, e ela herda a cor', () => {
    const map = houseMap()
    expect(map.regions.map((r) => r.id)).toEqual(['casa', 'quarto', 'armario', 'outra'])
    expect(map.regions.find((r) => r.id === 'quarto')?.fillColor).toBe('#445566')
    // Topo e esquerda do quarto estão sobre a casa: só 2 paredes próprias.
    expect(map.walls.filter((w) => w.regionId === 'quarto').map((w) => w.id)).toEqual(['q1', 'q2'])
  })

  it('moveRegion da casa move quarto, armário e as paredes (com a porta); não mexe na outra', () => {
    const map = houseMap()
    const moved = mapFactory.moveRegion(map, 'casa', 64, 32)
    for (const id of ['casa', 'quarto', 'armario']) {
      const before = map.regions.find((r) => r.id === id)?.points[0]
      expect(moved.regions.find((r) => r.id === id)?.points[0]).toEqual({ x: (before?.x ?? 0) + 64, y: (before?.y ?? 0) + 32 })
    }
    expect(moved.walls.find((w) => w.id === 'q1')).toMatchObject({ x1: 320 + 64, y1: 32, door: { kind: 'normal' } })
    expect(moved.regions.find((r) => r.id === 'outra')).toBe(map.regions.find((r) => r.id === 'outra'))
  })

  it('moveRegion do quarto não move a casa', () => {
    const moved = mapFactory.moveRegion(houseMap(), 'quarto', 10, 0)
    expect(moved.regions.find((r) => r.id === 'casa')?.points[0]).toEqual({ x: 0, y: 0 })
    expect(moved.regions.find((r) => r.id === 'armario')?.points[0]).toEqual({ x: 74, y: 64 })
  })

  it('removeRegion da casa apaga a subárvore e as paredes vinculadas', () => {
    const removed = mapFactory.removeRegion(houseMap(), 'casa')
    expect(removed.regions.map((r) => r.id)).toEqual(['outra'])
    expect(removed.walls.every((w) => w.regionId === 'outra')).toBe(true)
  })

  it('mover por área com casa e quarto selecionados não move o quarto duas vezes', () => {
    const map = houseMap()
    const moved = moveAreaSelection(
      map,
      { tokens: [], walls: ['q1', 'c0'], lights: [], regions: ['quarto', 'casa'], stairs: [], props: [], drawings: [], floor: [] } as never,
      8,
      0,
    )
    expect(moved.regions.find((r) => r.id === 'quarto')?.points[0]).toEqual({ x: 8, y: 0 })
    expect(moved.regions.find((r) => r.id === 'armario')?.points[0]).toEqual({ x: 72, y: 64 })
    expect(moved.walls.find((w) => w.id === 'q1')?.x1).toBe(328)
    expect(moved.walls.find((w) => w.id === 'c0')?.x1).toBe(8)
  })
})

describe('mapStore com sub-salas', () => {
  beforeEach(() => {
    useMapStore.setState({ map: houseMap(), past: [], future: [], selection: EMPTY_SELECTION, activeTool: 'select', pendingParentRoomId: null })
  })

  it('apagar a casa selecionada apaga tudo e um Ctrl+Z traz tudo de volta', () => {
    const before = useMapStore.getState().map
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: 'casa' }))
    useMapStore.getState().removeSelected()
    expect(useMapStore.getState().map.regions.map((r) => r.id)).toEqual(['outra'])
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(before)
  })

  it('mover a casa é uma entrada de histórico e Ctrl+Z volta as filhas', () => {
    const before = useMapStore.getState().map
    useMapStore.getState().moveRegion('casa', 64, 0)
    expect(useMapStore.getState().map.regions.find((r) => r.id === 'armario')?.points[0]).toEqual({ x: 128, y: 64 })
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(before)
  })

  it('Ctrl+D na casa copia casa, quarto e armário com paredes, porta e hierarquia nova', () => {
    const before = useMapStore.getState().map
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: 'casa' }))
    useMapStore.getState().duplicateSelected()
    const { map, selection } = useMapStore.getState()
    // casa, quarto, armário, outra + cópia de casa, quarto e armário.
    expect(map.regions).toHaveLength(7)
    const copyId = selection[0]?.id
    const copies = map.regions.slice(4)
    const copyCasa = copies.find((r) => r.id === copyId)
    const copyQuarto = copies.find((r) => r.parentId === copyId)
    const copyArmario = copies.find((r) => r.parentId === copyQuarto?.id)
    // Sala na seleção: a cópia vai para a direita pela largura (640) + 1 célula, sem descer.
    expect(copyCasa?.points[0]).toEqual({ x: 704, y: 0 })
    expect(copyQuarto?.room?.name).toBe(before.regions[1].room?.name)
    expect(copyArmario?.points[0]).toEqual({ x: 768, y: 64 })
    expect(map.walls.filter((w) => w.regionId === copyQuarto?.id)).toHaveLength(2)
    expect(map.walls.find((w) => w.regionId === copyQuarto?.id && w.regionEdgeIndex === 1)?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(before)
  })

  it('Ctrl+D com casa e quarto selecionados não copia o quarto duas vezes', () => {
    useMapStore.getState().setSelection([{ kind: 'region', id: 'casa' }, { kind: 'region', id: 'quarto' }])
    useMapStore.getState().duplicateSelected()
    expect(useMapStore.getState().map.regions).toHaveLength(7)
  })

  it('Alt+arrastar (insertClonedEntityLive) leva as filhas', () => {
    const casa = useMapStore.getState().map.regions[0]
    useMapStore.getState().insertClonedEntityLive({ kind: 'region', entity: { ...casa, id: 'casa-copia' } }, 'casa')
    const { map } = useMapStore.getState()
    expect(map.regions.filter((r) => r.parentId === 'casa-copia')).toHaveLength(1)
    expect(map.walls.filter((w) => w.regionId === 'casa-copia')).toHaveLength(4)
  })

  it('Ctrl+D de algo que não é Sala continua deslocando 1 célula nos dois eixos', () => {
    useMapStore.getState().addLight({ id: 'luz', x: 100, y: 100, radius: 50, color: '#fff', intensity: 1 })
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'light', id: 'luz' }))
    useMapStore.getState().duplicateSelected()
    const copy = useMapStore.getState().map.lights.find((l) => l.id !== 'luz')
    expect(copy).toMatchObject({ x: 164, y: 164 })
  })

  it('porta na parede da Casa: mover leva a porta, Ctrl+D copia a porta e apagar não deixa pedaço solto', () => {
    useMapStore.getState().addDoorOnWall('c2', { x: 320, y: 640 }, 'normal')
    const doorOf = (regionId: string | undefined) =>
      useMapStore.getState().map.walls.find((w) => w.regionId === regionId && w.door !== null && w.regionEdgeIndex === 2)
    const door = doorOf('casa')
    expect(door).toMatchObject({ x1: 336, x2: 304, y1: 640 })

    useMapStore.getState().moveRegion('casa', 0, 64)
    expect(useMapStore.getState().map.walls.filter((w) => w.y1 === 640 && w.y2 === 640)).toHaveLength(0)
    expect(doorOf('casa')).toMatchObject({ x1: 336, x2: 304, y1: 704, y2: 704 })

    useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: 'casa' }))
    useMapStore.getState().duplicateSelected()
    const copyId = useMapStore.getState().selection[0]?.id
    expect(doorOf(copyId)).toMatchObject({ x1: 336 + 704, y1: 704 })

    useMapStore.getState().removeRegion('casa')
    expect(useMapStore.getState().map.walls.filter((w) => w.regionId === undefined)).toHaveLength(0)
  })

  it('largura no painel mantém a porta na mesma posição proporcional da parede', () => {
    useMapStore.getState().addDoorOnWall('c2', { x: 160, y: 640 }, 'normal')
    useMapStore.getState().resizeRoomDimensions('casa', 1280, 640)
    const door = useMapStore.getState().map.walls.find((w) => w.regionId === 'casa' && w.door !== null)
    // Centro a 1/4 da aresta de baixo (que corre da direita para a esquerda) e porta com o dobro do tamanho.
    expect(door).toMatchObject({ y1: 640, y2: 640 })
    expect(((door?.x1 ?? 0) + (door?.x2 ?? 0)) / 2).toBeCloseTo(320)
    expect(Math.abs((door?.x1 ?? 0) - (door?.x2 ?? 0))).toBeCloseTo(64)
  })

  it('mover o quarto para fora da casa vira sala de topo; mover a outra para dentro vira filha, sem trocar a cor', () => {
    useMapStore.getState().moveRegion('quarto', 1400, 0)
    let regions = useMapStore.getState().map.regions
    expect(regions.find((r) => r.id === 'quarto')?.parentId).toBeUndefined()
    // O armário andou junto e continua filho do quarto.
    expect(regions.find((r) => r.id === 'armario')?.parentId).toBe('quarto')
    // Topo e esquerda do quarto não tinham parede (estavam sobre a casa): fora dela, ganham.
    const quartoEdges = useMapStore.getState().map.walls.filter((w) => w.regionId === 'quarto').map((w) => w.regionEdgeIndex)
    expect([...new Set(quartoEdges)].sort()).toEqual([0, 1, 2, 3])
    expect(useMapStore.getState().map.walls.find((w) => w.regionId === 'quarto' && w.regionEdgeIndex === 0)).toMatchObject({ x1: 1400, y1: 0, x2: 1720, y2: 0 })
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().moveRegion('outra', -800, 300)
    regions = useMapStore.getState().map.regions
    const outra = regions.find((r) => r.id === 'outra')
    expect(outra?.parentId).toBe('casa')
    // A cor com que ela nasceu (padrão de buildRoomFromDraft), não a da mãe.
    expect(outra?.fillColor).toBe('#3a7ad0')
    expect(regions.map((r) => r.id)).toEqual(['casa', 'outra', 'quarto', 'armario'])
  })

  it('seta do teclado (moveSelectionBy) também recalcula a mãe', () => {
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: 'quarto' }))
    useMapStore.getState().moveSelectionBy(1400, 0)
    expect(useMapStore.getState().map.regions.find((r) => r.id === 'quarto')?.parentId).toBeUndefined()
  })

  it('reparentAfterMoveLive sem mudança não troca o mapa (commitDragHistory não grava entrada vazia)', () => {
    const before = useMapStore.getState().map
    useMapStore.getState().reparentAfterMoveLive(before, ['quarto', 'casa'])
    expect(useMapStore.getState().map).toBe(before)
    expect(mapFactory.reparentRoom(before, 'nao-existe')).toBe(before)
  })

  it('pendente de "Criar sala dentro" some ao trocar para ferramenta que não cria Sala', () => {
    useMapStore.getState().setActiveTool('room')
    useMapStore.getState().setPendingParentRoom('casa')
    useMapStore.getState().setActiveTool('roomCircle')
    expect(useMapStore.getState().pendingParentRoomId).toBe('casa')
    useMapStore.getState().setActiveTool('wall')
    expect(useMapStore.getState().pendingParentRoomId).toBeNull()
  })
})
