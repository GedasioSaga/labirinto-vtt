/**
 * CRIAR ANDAR DE CIMA (ou de baixo) A PARTIR DO PRÉDIO: a escada da "Casa do
 * prefeito" no Térreo ganha, num clique, a cena "Casa do prefeito – andar de
 * cima" com o MESMO contorno (a Sala de fora e a parede externa dela, sem a
 * porta da rua e sem os cômodos de dentro), a escada par no MESMO ponto e as
 * duas ligadas em mão dupla. Quem sobe chega onde estava, só que um andar acima.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Pin, Stair, Wall } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore, subscribeToTravelLinks, stairTravelOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap, addDoorOnWall, addRoom, addWall } = await import('../lib/mapFactory')
const { buildRoomFromDraft } = await import('../lib/drawingFactory')
const { arrivalSpot } = await import('../lib/pinTravel')
const { pointInPolygonInclusive } = await import('../lib/roomNesting')
const { visiblePins } = await import('../lib/layers')

subscribeToTravelLinks()

/** A escada fica no quarto, dentro da casa: o prédio é a casa, não o quarto. */
const ESCADA: Stair = { id: 'escada-terreo', shape: 'straight', direction: 'up', segments: [{ x1: 400, y1: 300, x2: 400, y2: 180 }], stepWidth: 64 }

const CERCA: Wall = { id: 'cerca', x1: 0, y1: 600, x2: 640, y2: 600, blocksLight: false, blocksMove: true, door: null }

/** Térreo com a Casa do prefeito (porta da rua na parede de cima), um Quarto dentro e uma cerca solta lá fora. */
function terreoComACasa(): MapData {
  const casa = buildRoomFromDraft('casa', ['c1', 'c2', 'c3', 'c4'], { x: 192, y: 128 }, { x: 576, y: 448 }, undefined, undefined, 'Casa do prefeito')
  const quarto = buildRoomFromDraft('quarto', ['q1', 'q2', 'q3', 'q4'], { x: 320, y: 160 }, { x: 512, y: 320 }, undefined, undefined, 'Quarto')
  let map = createEmptyMap('map_raiz', 'Térreo', 30, 20, 64)
  map = addRoom(map, casa.region, casa.walls)
  map = addRoom(map, { ...quarto.region, parentId: 'casa' }, quarto.walls)
  map = addWall(map, CERCA)
  const paredeDeCima = map.walls.find((w) => w.regionId === 'casa' && w.y1 === 128 && w.y2 === 128)
  if (paredeDeCima === undefined) throw new Error('a casa não tem parede em cima')
  return addDoorOnWall(map, paredeDeCima.id, { x: 384, y: 128 }, 64, 'normal')
}

function montar(map: MapData): string {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(map)
  useSessionStore.getState().markSaved()
  // Uma aventura de verdade: o Térreo aberto e uma outra cena qualquer de fundo.
  useAdventureStore.getState().createScene('Praça', null)
  const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(terreo)
  useMapStore.getState().addStair(ESCADA)
  return terreo
}

function mapaDoFundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`cena ${sceneId} fora do cache`)
  return slot.map
}

function pinoDaEscada(map: MapData, stairId: string): Pin {
  const pin = map.pins.find((p) => p.escadaId === stairId)
  if (pin === undefined) throw new Error(`a escada ${stairId} não tem pino`)
  return pin
}

const traco = (w: Wall) => `${w.x1},${w.y1}-${w.x2},${w.y2}`

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('criar andar de cima a partir do prédio', () => {
  it('"Casa do prefeito – andar de cima" nasce com o mesmo contorno, sem a porta da rua e sem o quarto', () => {
    const terreoMap = terreoComACasa()
    const terreo = montar(terreoMap)
    const novo = useAdventureStore.getState().createFloorFromStair('escada-terreo', 'livre')
    if (novo === null) throw new Error('não criou o andar')

    const cena = useAdventureStore.getState().adventure?.scenes.find((s) => s.id === novo)
    expect(cena?.name).toBe('Casa do prefeito – andar de cima')
    // O mestre continua no Térreo, com a escada no painel.
    expect(useAdventureStore.getState().activeSceneId).toBe(terreo)

    const cima = mapaDoFundo(novo)
    expect(cima.width).toBe(terreoMap.width)
    expect(cima.grid).toBe(terreoMap.grid)
    // A Sala de fora, e só ela: o quarto é do Térreo.
    expect(cima.regions).toHaveLength(1)
    const casaDeCima = cima.regions[0]
    const casa = terreoMap.regions.find((r) => r.id === 'casa')
    expect(casaDeCima.room?.name).toBe('Casa do prefeito')
    expect(casaDeCima.points).toEqual(casa?.points)
    expect(casaDeCima.id).not.toBe('casa')
    expect(casaDeCima.parentId).toBeUndefined()

    // A parede externa, trecho por trecho, no mesmo lugar — a porta vira parede.
    const externaDeBaixo = terreoMap.walls.filter((w) => w.regionId === 'casa')
    expect(externaDeBaixo.some((w) => w.door !== null)).toBe(true)
    expect(cima.walls.map(traco).sort()).toEqual(externaDeBaixo.map(traco).sort())
    expect(cima.walls.every((w) => w.door === null && w.regionId === casaDeCima.id)).toBe(true)
    expect(cima.walls.some((w) => terreoMap.walls.some((antiga) => antiga.id === w.id))).toBe(false)
  })

  it('a escada par nasce no MESMO ponto, descendo, ligada em mão dupla e sem pino à vista', () => {
    const terreo = montar(terreoComACasa())
    const novo = useAdventureStore.getState().createFloorFromStair('escada-terreo', 'livre')
    if (novo === null) throw new Error('não criou o andar')

    const cima = mapaDoFundo(novo)
    expect(cima.stairs).toHaveLength(1)
    const par = cima.stairs[0]
    expect(par.direction).toBe('down')
    expect(par.segments).toEqual(ESCADA.segments)
    expect(par.stepWidth).toBe(ESCADA.stepWidth)

    const aberto = useMapStore.getState().map
    const daqui = pinoDaEscada(aberto, 'escada-terreo')
    const deLa = pinoDaEscada(cima, par.id)
    expect(daqui.destino).toEqual({ sceneId: novo, pinId: deLa.id })
    expect(deLa.destino).toEqual({ sceneId: terreo, pinId: daqui.id })
    expect(daqui.passagem).toBe('livre')
    expect(deLa.passagem).toBe('livre')
    expect(visiblePins(cima.pins, cima.hiddenLayers)).toEqual([])
    const travel = stairTravelOf(useAdventureStore.getState(), aberto, ESCADA)
    expect(travel.status === 'ligado' && travel.sceneName).toBe('Casa do prefeito – andar de cima')
  })

  it('Duda passa pela escada e chega no mesmo ponto do andar de cima, dentro da casa', () => {
    montar(terreoComACasa())
    const novo = useAdventureStore.getState().createFloorFromStair('escada-terreo', 'livre')
    if (novo === null) throw new Error('não criou o andar')
    const cima = mapaDoFundo(novo)
    const embaixo = useMapStore.getState().map
    const chegada = arrivalSpot(cima, pinoDaEscada(cima, cima.stairs[0].id), 1)
    expect(chegada).toEqual(arrivalSpot(embaixo, pinoDaEscada(embaixo, 'escada-terreo'), 1))
    expect(pointInPolygonInclusive(chegada, cima.regions[0].points)).toBe(true)
  })

  it('escada que desce cria o andar de baixo, com a escada par subindo', () => {
    montar(terreoComACasa())
    useMapStore.getState().setStairDirection('escada-terreo', 'down')
    const novo = useAdventureStore.getState().createFloorFromStair('escada-terreo', 'pede')
    if (novo === null) throw new Error('não criou o andar')
    expect(useAdventureStore.getState().adventure?.scenes.find((s) => s.id === novo)?.name).toBe('Casa do prefeito – andar de baixo')
    expect(mapaDoFundo(novo).stairs.map((s) => s.direction)).toEqual(['up'])
  })

  it('escada fora de prédio: o andar nasce vazio com o nome da cena, e a escada se liga igual', () => {
    montar(createEmptyMap('map_raiz', 'Térreo', 30, 20, 64))
    const novo = useAdventureStore.getState().createFloorFromStair('escada-terreo', 'livre')
    if (novo === null) throw new Error('não criou o andar')
    expect(useAdventureStore.getState().adventure?.scenes.find((s) => s.id === novo)?.name).toBe('Térreo – andar de cima')
    const cima = mapaDoFundo(novo)
    expect(cima.regions).toEqual([])
    expect(cima.walls).toEqual([])
    expect(cima.stairs).toHaveLength(1)
  })

  it('escada que não existe, ou fora de aventura: nada nasce', () => {
    montar(terreoComACasa())
    const cenas = useAdventureStore.getState().adventure?.scenes.length
    expect(useAdventureStore.getState().createFloorFromStair('nao-existe', 'livre')).toBeNull()
    expect(useAdventureStore.getState().adventure?.scenes.length).toBe(cenas)

    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(terreoComACasa())
    useMapStore.getState().addStair(ESCADA)
    expect(useAdventureStore.getState().createFloorFromStair('escada-terreo', 'livre')).toBeNull()
    expect(useAdventureStore.getState().adventure).toBeNull()
  })
})
