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
    faccoes: spy('faccoes'),
    roomNames: spy('roomNames'),
    walls: spy('walls'),
    stairs: spy('stairs'),
    lights: spy('lights'),
    watchCones: spy('watchCones'),
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

  it('filtro "Quem manda aqui": desligado nunca repinta; ligar pinta, e com ele ligado a sala movida repinta a facção', () => {
    const { redraw, take } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    take()
    // Ligar o filtro pinta só a camada de facções.
    expect(redraw(snapshot(map, { filtroFaccoes: true }))).toEqual(['faccoes'])
    expect(redraw(snapshot(map, { filtroFaccoes: true }))).toEqual([])
    // Com o filtro ligado, a sala que anda leva a cor junto.
    const movido = moveRegion(map, 'r1', 10, 0)
    expect(redraw(snapshot(movido, { filtroFaccoes: true }))).toContain('faccoes')
    // Desligar apaga (uma pintura), e depois a sala anda sem repintar a facção.
    expect(redraw(snapshot(movido))).toEqual(['faccoes'])
    expect(redraw(snapshot(moveRegion(movido, 'r1', 10, 0)))).not.toContain('faccoes')
  })

  it('camada de texto pintada pede a sincronização da resolução dos Text', () => {
    expect(paintedTextLayer(['walls', 'roomNames'])).toBe(true)
    expect(paintedTextLayer(['walls', 'regions', 'lights'])).toBe(false)
  })
})
