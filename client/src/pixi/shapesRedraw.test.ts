import { describe, expect, it, vi, type MockInstance } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import type { Drawing, Light, MapData } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { createEmptyMap, moveRegion } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { buildFloorPiece } from '../lib/floorTool'
import { EMPTY_SELECTION, selectionOfItem, type SelectionSet } from '../lib/selectionModel'
import { createFloorRenderer } from './drawFloor'
import { createRegionsRenderer } from './drawRegions'
import { createTextLabelsRenderer } from './drawTextLabels'
import { createChangeGate, createShapesRedrawer, type ShapesTargets } from './shapesRedraw'

/** Camadas de Graphics simples: a prova de "redesenhou" é o `clear()` que todo draw* faz no topo. */
type GraphicsLayer = Exclude<keyof ShapesTargets, 'regions' | 'textLabels'>
const GRAPHICS_LAYERS: GraphicsLayer[] = [
  'floor', 'floorSelection', 'mapLines', 'walls', 'doors', 'stairs', 'lights', 'drawings', 'handles', 'areaOutline',
]

function buildMap(): MapData {
  const room1 = buildRoomFromDraft('r1', ['r1-top', 'r1-right', 'r1-bottom', 'r1-left'], { x: 0, y: 0 }, { x: 100, y: 100 })
  const room2 = buildRoomFromDraft('r2', ['r2-top', 'r2-right', 'r2-bottom', 'r2-left'], { x: 200, y: 0 }, { x: 300, y: 100 })
  const light: Light = { id: 'l1', x: 50, y: 50, radius: 80, color: '#ffcc66', intensity: 1 }
  const line: Drawing = { id: 'd1', kind: 'line', x1: 0, y1: 200, x2: 100, y2: 200, color: '#ffffff', width: 2 }
  const label: Drawing = { id: 't1', kind: 'text', x: 10, y: 220, text: 'Cozinha', color: '#ffffff', fontSize: 14 }
  return {
    ...createEmptyMap('m1', 'Mapa', 20, 20, 50),
    floor: [buildFloorPiece('f1', { kind: 'rect', cx: 150, cy: 150, w: 400, h: 300 }, 'add')],
    regions: [room1.region, room2.region],
    walls: [...room1.walls, ...room2.walls],
    lights: [light],
    drawings: [line, label],
  }
}

function setup() {
  const targets: ShapesTargets = {
    floor: new Graphics(),
    floorSelection: new Graphics(),
    mapLines: new Graphics(),
    regions: new Container(),
    walls: new Graphics(),
    doors: new Graphics(),
    stairs: new Graphics(),
    lights: new Graphics(),
    drawings: new Graphics(),
    textLabels: new Container(),
    handles: new Graphics(),
    areaOutline: new Graphics(),
  }
  const textLabels = createTextLabelsRenderer()
  const textLabelsDraw = vi.fn(textLabels.draw)
  const redraw = createShapesRedrawer(targets, {
    floor: createFloorRenderer(),
    regions: createRegionsRenderer(),
    textLabels: { draw: textLabelsDraw },
    redrawMapRaster: vi.fn(),
    clearMapRaster: vi.fn(),
    redrawMapFrame: vi.fn(),
  })
  const spies = new Map<GraphicsLayer, MockInstance>()
  for (const layer of GRAPHICS_LAYERS) spies.set(layer, vi.spyOn(targets[layer], 'clear'))

  /** Zera a contagem e passa a vigiar também o Graphics de cada sala já criado. */
  const regionSpies = new Map<string, MockInstance>()
  const resetCounts = () => {
    for (const spy of spies.values()) spy.mockClear()
    textLabelsDraw.mockClear()
    for (const child of targets.regions.children) {
      if (child instanceof Graphics && !regionSpies.has(child.label)) regionSpies.set(child.label, vi.spyOn(child, 'clear'))
    }
    for (const spy of regionSpies.values()) spy.mockClear()
  }

  /** Camadas redesenhadas desde o último `resetCounts()`, em ordem estável. */
  const redrawnLayers = (): string[] => {
    const layers: string[] = GRAPHICS_LAYERS.filter((layer) => (spies.get(layer)?.mock.calls.length ?? 0) > 0)
    if (textLabelsDraw.mock.calls.length > 0) layers.push('textLabels')
    return layers
  }
  const redrawnRooms = (): string[] =>
    [...regionSpies.entries()].filter(([, spy]) => spy.mock.calls.length > 0).map(([id]) => id).sort()

  return { redraw, resetCounts, redrawnLayers, redrawnRooms }
}

function snapshot(map: MapData, selection: SelectionSet = EMPTY_SELECTION, activeTool: DrawingTool = 'select') {
  return { map, selection, activeTool }
}

describe('createShapesRedrawer — redesenho parcial', () => {
  it('primeira pintura desenha todas as camadas e todas as salas', () => {
    const { redraw, resetCounts, redrawnLayers, redrawnRooms } = setup()
    resetCounts()
    redraw(snapshot(buildMap()))
    expect(redrawnLayers()).toEqual([...GRAPHICS_LAYERS, 'textLabels'])
    // Os Graphics das salas nascem nesta chamada; a próxima confirma que existem 2.
    resetCounts()
    expect(redrawnRooms()).toEqual([])
  })

  it('arrastar sala: redesenha só a sala arrastada e as paredes/portas dela; chão, luzes, desenhos, textos e a outra sala ficam', () => {
    const { redraw, resetCounts, redrawnLayers, redrawnRooms } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    resetCounts()

    let current = map
    for (let step = 1; step <= 3; step++) {
      current = moveRegion(current, 'r1', 10, 0)
      redraw(snapshot(current))
    }

    expect(redrawnLayers()).toEqual(['walls', 'doors'])
    expect(redrawnRooms()).toEqual(['r1'])
  })

  it('selecionar uma luz: redesenha só a camada de luzes e as alças', () => {
    const { redraw, resetCounts, redrawnLayers, redrawnRooms } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    resetCounts()

    redraw(snapshot(map, selectionOfItem({ kind: 'light', id: 'l1' })))

    expect(redrawnLayers()).toEqual(['lights', 'handles'])
    expect(redrawnRooms()).toEqual([])
  })

  it('selecionar a parede-dona de uma sala: repinta só essa sala (destaque), paredes, portas e alças', () => {
    const { redraw, resetCounts, redrawnLayers, redrawnRooms } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    resetCounts()

    redraw(snapshot(map, selectionOfItem({ kind: 'wall', id: 'r2-top' })))

    expect(redrawnLayers()).toEqual(['walls', 'doors', 'handles'])
    expect(redrawnRooms()).toEqual(['r2'])
  })

  it('clique que refaz a MESMA seleção (conjunto novo, mesmo item) não redesenha nada', () => {
    const { redraw, resetCounts, redrawnLayers, redrawnRooms } = setup()
    const map = buildMap()
    redraw(snapshot(map, selectionOfItem({ kind: 'light', id: 'l1' })))
    resetCounts()

    redraw(snapshot(map, selectionOfItem({ kind: 'light', id: 'l1' })))

    expect(redrawnLayers()).toEqual([])
    expect(redrawnRooms()).toEqual([])
  })

  it('desfazer um arrasto (volta ao mapa anterior): só as camadas cujas listas mudaram', () => {
    const { redraw, resetCounts, redrawnLayers, redrawnRooms } = setup()
    const before = buildMap()
    redraw(snapshot(before))
    redraw(snapshot(moveRegion(before, 'r2', 0, 20)))
    resetCounts()

    redraw(snapshot(before))

    expect(redrawnLayers()).toEqual(['walls', 'doors'])
    expect(redrawnRooms()).toEqual(['r2'])
  })

  it('trocar de ferramenta: só as alças', () => {
    const { redraw, resetCounts, redrawnLayers } = setup()
    const map = buildMap()
    const selection = selectionOfItem({ kind: 'wall', id: 'r1-top' })
    redraw(snapshot(map, selection, 'select'))
    resetCounts()

    redraw(snapshot(map, selection, 'wall'))

    expect(redrawnLayers()).toEqual(['handles'])
  })

  it('ocultar a camada de paredes ainda redesenha paredes e portas (vazias)', () => {
    const { redraw, resetCounts, redrawnLayers } = setup()
    const map = buildMap()
    redraw(snapshot(map))
    resetCounts()

    redraw(snapshot({ ...map, hiddenLayers: ['paredes'] }))

    expect(redrawnLayers()).toContain('walls')
    expect(redrawnLayers()).toContain('doors')
  })
})

describe('createChangeGate', () => {
  it('abre na primeira chamada, fecha com as mesmas referências e reabre quando uma muda', () => {
    const gate = createChangeGate()
    const walls: unknown[] = []
    expect(gate([walls, 'a'])).toBe(true)
    expect(gate([walls, 'a'])).toBe(false)
    expect(gate([[], 'a'])).toBe(true)
    expect(gate([[], 'a'])).toBe(true)
  })

  it('reabre quando o número de dependências muda', () => {
    const gate = createChangeGate()
    expect(gate([1])).toBe(true)
    expect(gate([1, 2])).toBe(true)
    expect(gate([1, 2])).toBe(false)
  })
})
