import { describe, expect, it } from 'vitest'
import type { Drawing, Light, MapData, Token } from '../types/map'
import { createEmptyMap, moveRegion } from '../lib/mapFactory'
import { setRoomHazard } from '../lib/hazards'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { EMPTY_SELECTION, selectionOfItem } from '../lib/selectionModel'
import {
  SHAPES_LAYERS,
  createChangeGate,
  createShapesRedrawer,
  paintedTextLayer,
  type ShapesLayer,
  type ShapesSnapshot,
} from './shapesRedraw'

function buildMap(): MapData {
  const room1 = buildRoomFromDraft('r1', ['r1-top', 'r1-right', 'r1-bottom', 'r1-left'], { x: 0, y: 0 }, { x: 100, y: 100 }, undefined, undefined, 'Cozinha')
  const room2 = buildRoomFromDraft('r2', ['r2-top', 'r2-right', 'r2-bottom', 'r2-left'], { x: 200, y: 0 }, { x: 300, y: 100 }, undefined, undefined, 'Sala')
  const light: Light = { id: 'l1', x: 50, y: 50, radius: 80, color: '#ffcc66', intensity: 1 }
  const line: Drawing = { id: 'd1', kind: 'line', x1: 0, y1: 200, x2: 100, y2: 200, color: '#ffffff', width: 2 }
  return {
    ...createEmptyMap('m1', 'Mapa', 20, 20, 50),
    regions: [room1.region, room2.region],
    walls: [...room1.walls, ...room2.walls],
    lights: [light],
    drawings: [line],
  }
}

function snapshot(map: MapData, overrides: Partial<ShapesSnapshot> = {}): ShapesSnapshot {
  return {
    map,
    selection: EMPTY_SELECTION,
    activeTool: 'select',
    selectedConcealZoneId: null,
    selectedPinId: null,
    travel: [null, null, null],
    cameraScale: 1,
    rendererResolution: 1,
    rotatingRoom: false,
    ...overrides,
  }
}

/** Um espião por camada, na ordem em que o redesenho as chama. */
function setup() {
  const calls: ShapesLayer[] = []
  const spy = (layer: ShapesLayer) => () => {
    calls.push(layer)
  }
  const paint: Record<ShapesLayer, () => void> = {
    floor: spy('floor'),
    gridMask: spy('gridMask'),
    floorSelection: spy('floorSelection'),
    mapLines: spy('mapLines'),
    mapFrame: spy('mapFrame'),
    regions: spy('regions'),
    drawings: spy('drawings'),
    hazards: spy('hazards'),
    areaTriggers: spy('areaTriggers'),
    roomNames: spy('roomNames'),
    walls: spy('walls'),
    stairs: spy('stairs'),
    lights: spy('lights'),
    watchCones: spy('watchCones'),
    patrolRoutes: spy('patrolRoutes'),
    concealZones: spy('concealZones'),
    pins: spy('pins'),
    textLabels: spy('textLabels'),
    handles: spy('handles'),
    areaOutline: spy('areaOutline'),
  }
  const redraw = createShapesRedrawer(paint)
  const take = () => calls.splice(0, calls.length)
  return { redraw, take }
}

const selectRegion = (id: string) => selectionOfItem({ kind: 'region', id })

describe('createChangeGate', () => {
  it('abre na primeira chamada, fecha com as mesmas referências e reabre quando uma muda', () => {
    const gate = createChangeGate()
    const a = [1]
    expect(gate([a, 'x'])).toBe(true)
    expect(gate([a, 'x'])).toBe(false)
    expect(gate([[1], 'x'])).toBe(true)
    expect(gate([[1], 'x', 3])).toBe(true)
  })
})

describe('createShapesRedrawer', () => {
  it('a primeira chamada pinta todas as camadas de auto/acervo, na ordem de pintura', () => {
    const { redraw, take } = setup()
    const painted = redraw(snapshot(buildMap()))
    expect(painted).toEqual([...SHAPES_LAYERS])
    expect(take()).toEqual([...SHAPES_LAYERS])
    // As camadas que existem hoje no PixiCanvas precisam estar na lista.
    for (const layer of ['roomNames', 'concealZones', 'pins', 'gridMask', 'mapFrame', 'textLabels'] as const) {
      expect(SHAPES_LAYERS).toContain(layer)
    }
  })

  it('chamar de novo sem mudança nenhuma não pinta nada', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    expect(redraw(snapshot(map))).toEqual([])
    expect(take()).toEqual([])
  })

  it('arrastar uma sala repinta só o que depende de salas e paredes (não chão, traços, escadas, desenhos, zonas, pinos)', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    const moved = moveRegion(map, 'r1', 10, 0)
    redraw(snapshot(moved))
    // Luz entra porque a parede da sala barra a luz: o recorte muda de verdade.
    expect(take()).toEqual(['gridMask', 'regions', 'roomNames', 'walls', 'lights'])
  })

  it('arrastar a sala selecionada acrescenta só as alças', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    const selection = selectRegion('r1')
    redraw(snapshot(map, { selection }))
    take()
    redraw(snapshot(moveRegion(map, 'r1', 10, 0), { selection }))
    expect(take()).toEqual(['gridMask', 'regions', 'roomNames', 'walls', 'lights', 'handles'])
  })

  it('selecionar uma sala repinta o destaque (sala, contorno nas paredes, alças) e nada mais', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    redraw(snapshot(map, { selection: selectRegion('r1') }))
    expect(take()).toEqual(['regions', 'walls', 'handles'])
    // Clicar de novo no mesmo item cria um conjunto novo: nada muda na tela.
    redraw(snapshot(map, { selection: selectRegion('r1') }))
    expect(take()).toEqual([])
  })

  it('desfazer um arrasto (volta a referência antiga do mapa) repinta só as camadas afetadas', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    redraw(snapshot(moveRegion(map, 'r1', 10, 0)))
    take()
    redraw(snapshot(map))
    expect(take()).toEqual(['gridMask', 'regions', 'roomNames', 'walls', 'lights'])
  })

  it('zoom sem seleção repinta só paredes, escadas e luzes (espessura e marcador em px de tela)', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    const painted = redraw(snapshot(map, { cameraScale: 2 }))
    expect(painted).toEqual(['walls', 'stairs', 'lights'])
    // Nenhuma camada com texto: o zoom não força sincronizar a resolução dos Text.
    expect(paintedTextLayer(painted)).toBe(false)
  })

  it('zoom com sala selecionada acrescenta o contorno da sala e as alças; nomes e chão continuam parados', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    const selection = selectRegion('r1')
    redraw(snapshot(map, { selection }))
    take()
    redraw(snapshot(map, { selection, cameraScale: 0.5 }))
    expect(take()).toEqual(['regions', 'walls', 'stairs', 'lights', 'handles'])
  })

  it('zoom com desenho selecionado repinta o desenho (contorno de seleção), não os rótulos', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    const selection = selectionOfItem({ kind: 'drawing', id: 'd1' })
    redraw(snapshot(map, { selection }))
    take()
    redraw(snapshot(map, { selection, cameraScale: 3 }))
    expect(take()).toEqual(['drawings', 'walls', 'stairs', 'lights', 'handles'])
  })

  it('trocar a resolução do monitor repinta o que alinha ao pixel físico', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    redraw(snapshot(map, { rendererResolution: 1.5 }))
    expect(take()).toEqual(['walls', 'stairs'])
  })

  it('zona oculta aberta no painel e pino aberto repintam só a própria camada', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    redraw(snapshot(map, { selectedConcealZoneId: 'z1' }))
    expect(take()).toEqual(['concealZones'])
    redraw(snapshot(map, { selectedConcealZoneId: 'z1', selectedPinId: 'p1' }))
    expect(take()).toEqual(['pins'])
  })

  it('a aventura mudando (par de pino de viagem em outra cena) repinta só os pinos', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    redraw(snapshot(map, { travel: [{}, null, null] }))
    expect(take()).toEqual(['pins'])
  })

  it('pedido de UMA camada divide o mesmo portão com o redesenho inteiro', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    const selection = selectRegion('r1')
    expect(redraw(snapshot(map, { selection }), ['handles'])).toEqual(['handles'])
    // As alças já estão no estado novo: o redesenho inteiro não as pinta de novo.
    redraw(snapshot(map, { selection }))
    expect(take()).toEqual(['handles', 'regions', 'walls'])
  })

  it('trocar de ferramenta apaga as alças; o giro da sala acende a alça de girar', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    const selection = selectRegion('r1')
    redraw(snapshot(map, { selection }))
    take()
    redraw(snapshot(map, { selection, rotatingRoom: true }))
    expect(take()).toEqual(['handles'])
    redraw(snapshot(map, { selection, activeTool: 'wall' }))
    expect(take()).toEqual(['handles'])
  })

  it('mapa sem nenhum campo opcional (sem frame, sem gridOffset, sem salas) pinta e depois fica parado', () => {
    const { redraw, take } = setup()
    const map = createEmptyMap('vazio', 'Vazio', 5, 5, 50)
    expect(redraw(snapshot(map))).toEqual([...SHAPES_LAYERS])
    take()
    expect(redraw(snapshot(map, { cameraScale: 2 }))).toEqual(['walls', 'stairs', 'lights'])
  })

  it('perigo e cone do guarda (grupo mundo) entram no redesenho parcial: repintam só quando o que é deles muda', () => {
    const { redraw, take } = setup()
    const guarda: Token = { id: 'g1', characterId: null, name: 'Guarda', x: 50, y: 50, size: 1, image: null, vigia: { direcao: 0, abertura: 90, alcance: 4 } }
    const map: MapData = { ...setRoomHazard(buildMap(), 'r1', 'fogo', () => 'h1'), tokens: [guarda] }
    expect(map.hazards?.length).toBe(1)
    redraw(snapshot(map))
    take()
    // Sem mudança: nenhum dos dois repinta.
    expect(redraw(snapshot(map))).toEqual([])
    // O guarda anda: só o cone (fichas não são camada vetorial).
    const andou = { ...map, tokens: [{ ...guarda, x: 60 }] }
    expect(redraw(snapshot(andou))).toEqual(['watchCones'])
    // A sala do fogo se move: o perigo segue a sala, e a parede nova corta o cone.
    expect(redraw(snapshot(moveRegion(andou, 'r1', 10, 0)))).toEqual(['gridMask', 'regions', 'hazards', 'roomNames', 'walls', 'lights', 'watchCones'])
  })

  it('gatilho de área e rota de patrulha (grupo mundo, onda 3) entram no redesenho parcial: repintam só quando o que é deles muda', () => {
    const { redraw, take } = setup()
    const npc: Token = {
      id: 'n1',
      characterId: null,
      name: 'Sentinela',
      x: 50,
      y: 50,
      size: 1,
      image: null,
      patrulha: { pontos: [{ x: 50, y: 50 }, { x: 250, y: 50 }], atual: 0 },
    }
    const map: MapData = { ...buildMap(), tokens: [npc], gatilhos: [{ id: 'g1', kind: 'armadilha', regionId: 'r1', revealed: false }] }
    // Primeira pintura: as duas camadas novas pintam junto com as outras.
    expect(redraw(snapshot(map))).toEqual([...SHAPES_LAYERS])
    take()
    expect(redraw(snapshot(map))).toEqual([])
    // Mudou a rota da ficha: só a rota (fichas não são camada vetorial).
    const rotaNova = { ...map, tokens: [{ ...npc, patrulha: { pontos: npc.patrulha?.pontos ?? [], atual: 1 } }] }
    expect(redraw(snapshot(rotaNova))).toEqual(['patrolRoutes'])
    // A sala do gatilho se move: o gatilho segue a sala.
    expect(redraw(snapshot(moveRegion(rotaNova, 'r1', 10, 0)))).toEqual(['gridMask', 'regions', 'areaTriggers', 'roomNames', 'walls', 'lights'])
  })

  it('sem gatilho nem patrulha no mapa, mexer em sala e ficha não repinta as camadas deles', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    const painted = redraw(snapshot(moveRegion(map, 'r1', 10, 0)))
    expect(painted).not.toContain('areaTriggers')
    expect(painted).not.toContain('patrolRoutes')
    expect(painted).toContain('regions')
  })

  it('pino com tamanho mínimo: zoom afastado repinta os pinos a cada degrau; perto, o zoom não os toca', () => {
    const { redraw, take } = setup()
    const map = { ...buildMap(), pins: [{ id: 'p1', x: 50, y: 50, kind: 'exclamacao' as const, description: '', image: null }] }
    redraw(snapshot(map, { cameraScale: 2 }))
    take()
    // Perto o pino tem o tamanho de mundo: 2 → 1 não repinta.
    redraw(snapshot(map, { cameraScale: 1 }))
    expect(take()).toEqual(['walls', 'stairs', 'lights'])
    // Longe, o pino cresce no mundo para manter a altura de tela: cada degrau repinta.
    redraw(snapshot(map, { cameraScale: 0.1 }))
    expect(take()).toEqual(['walls', 'stairs', 'lights', 'pins'])
    redraw(snapshot(map, { cameraScale: 0.05 }))
    expect(take()).toEqual(['walls', 'stairs', 'lights', 'pins'])
  })

  it('camada de texto pintada pede a sincronização da resolução dos Text', () => {
    expect(paintedTextLayer(['walls', 'roomNames'])).toBe(true)
    expect(paintedTextLayer(['walls', 'regions', 'lights'])).toBe(false)
  })
})
