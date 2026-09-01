import { describe, expect, it } from 'vitest'
import {
  LAYER_LABELS,
  PROP_LAYER_OPTIONS,
  wallLayer,
  regionLayer,
  stairLayer,
  lightLayer,
  tokenLayer,
  drawingLayer,
  propLayer,
  isLayerVisible,
  isLayerLocked,
  canInteractInLayer,
  visibleWalls,
  visibleRegions,
  visibleStairs,
  visibleLights,
  visibleTokens,
  visibleDrawings,
  visibleProps,
  countEntitiesByLayer,
} from './layers'
import type { Drawing, Light, MapData, Prop, Region, Stair, Token, Wall } from '../types/map'
import { LAYER_IDS } from '../types/map'
import { createEmptyMap } from './mapFactory'

const wallNoDoor: Wall = { id: 'w1', x1: 0, y1: 0, x2: 10, y2: 0, blocksLight: true, blocksMove: true, door: null }
const wallWithDoor: Wall = {
  id: 'w2',
  x1: 0,
  y1: 0,
  x2: 10,
  y2: 0,
  blocksLight: true,
  blocksMove: true,
  door: { open: false, locked: false, kind: 'normal' },
}
const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }
const roomRegion: Region = { ...region, id: 'r2', room: { shape: 'rect', name: 'Sala do trono' } }
const stair: Stair = { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 10, y2: 10 }], stepWidth: 32 }
const light: Light = { id: 'l1', x: 0, y: 0, radius: 100, color: '#fff', intensity: 1 }
const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null }
const drawing: Drawing = { id: 'd1', kind: 'freehand', points: [{ x: 0, y: 0 }], color: '#fff', width: 4 }
const propObjeto: Prop = { id: 'p1', src: '/a.png', x: 0, y: 0, width: 10, height: 10, linkedMapPath: null }
const propDecoracao: Prop = { ...propObjeto, id: 'p2', layer: 'decoracao' }

describe('LAYER_LABELS', () => {
  it('tem um rótulo não vazio pra cada LayerId do schema', () => {
    for (const id of LAYER_IDS) {
      expect(LAYER_LABELS[id]).toBeTruthy()
    }
  })
})

describe('derivação de camada por tipo', () => {
  it('wallLayer: sem porta vai pra paredes, com porta vai pra portas', () => {
    expect(wallLayer(wallNoDoor)).toBe('paredes')
    expect(wallLayer(wallWithDoor)).toBe('portas')
  })

  it('regionLayer: sempre salas, com ou sem RoomMeta', () => {
    expect(regionLayer(region)).toBe('salas')
    expect(regionLayer(roomRegion)).toBe('salas')
  })

  it('stairLayer: sempre escadas', () => {
    expect(stairLayer(stair)).toBe('escadas')
  })

  it('lightLayer: sempre iluminacao', () => {
    expect(lightLayer(light)).toBe('iluminacao')
  })

  it('tokenLayer: sempre tokens', () => {
    expect(tokenLayer(token)).toBe('tokens')
  })

  it('drawingLayer: sempre anotacoes, qualquer kind', () => {
    expect(drawingLayer(drawing)).toBe('anotacoes')
    expect(drawingLayer({ id: 'd2', kind: 'text', x: 0, y: 0, text: 'x', color: '#fff', fontSize: 16 })).toBe('anotacoes')
  })

  it('propLayer: layer ausente é objetos (default); explícito respeita o valor', () => {
    expect(propLayer(propObjeto)).toBe('objetos')
    expect(propLayer(propDecoracao)).toBe('decoracao')
  })
})

describe('isLayerVisible', () => {
  it('camada não listada em hiddenLayers está visível', () => {
    expect(isLayerVisible([], 'paredes')).toBe(true)
    expect(isLayerVisible(['portas'], 'paredes')).toBe(true)
  })

  it('camada listada em hiddenLayers não está visível', () => {
    expect(isLayerVisible(['paredes'], 'paredes')).toBe(false)
  })
})

describe('PROP_LAYER_OPTIONS', () => {
  it('tem exatamente os dois valores explícitos de Prop.layer', () => {
    expect(PROP_LAYER_OPTIONS).toEqual(['objetos', 'decoracao'])
  })
})

describe('isLayerLocked', () => {
  it('camada não listada em lockedLayers não está travada', () => {
    expect(isLayerLocked([], 'paredes')).toBe(false)
    expect(isLayerLocked(['portas'], 'paredes')).toBe(false)
  })

  it('camada listada em lockedLayers está travada', () => {
    expect(isLayerLocked(['paredes'], 'paredes')).toBe(true)
  })
})

describe('canInteractInLayer', () => {
  it('item destravado numa camada destravada pode interagir', () => {
    expect(canInteractInLayer({ locked: false }, 'paredes', [])).toBe(true)
    expect(canInteractInLayer({}, 'paredes', [])).toBe(true)
  })

  it('item travado (por si só) não pode interagir, mesmo com a camada destravada', () => {
    expect(canInteractInLayer({ locked: true }, 'paredes', [])).toBe(false)
  })

  it('item destravado numa camada travada não pode interagir', () => {
    expect(canInteractInLayer({ locked: false }, 'paredes', ['paredes'])).toBe(false)
    expect(canInteractInLayer({}, 'paredes', ['paredes'])).toBe(false)
  })

  it('camada travada não afeta item de OUTRA camada', () => {
    expect(canInteractInLayer({}, 'portas', ['paredes'])).toBe(true)
  })

  it('item travado E camada travada continua não podendo interagir (composição, não XOR)', () => {
    expect(canInteractInLayer({ locked: true }, 'paredes', ['paredes'])).toBe(false)
  })
})

describe('visible* — filtro por camada oculta', () => {
  it('sem camada oculta, devolve a MESMA referência de array (fast path sem alocação)', () => {
    const walls = [wallNoDoor, wallWithDoor]
    expect(visibleWalls(walls, [])).toBe(walls)
  })

  it('visibleWalls: oculta só as paredes cuja camada derivada está em hiddenLayers', () => {
    const walls = [wallNoDoor, wallWithDoor]
    expect(visibleWalls(walls, ['portas']).map((w) => w.id)).toEqual(['w1'])
    expect(visibleWalls(walls, ['paredes']).map((w) => w.id)).toEqual(['w2'])
    expect(visibleWalls(walls, ['paredes', 'portas'])).toEqual([])
  })

  it('visibleRegions: region.room não muda a camada — ocultar salas some com as duas', () => {
    const regions = [region, roomRegion]
    expect(visibleRegions(regions, ['salas'])).toEqual([])
    expect(visibleRegions(regions, [])).toBe(regions)
  })

  it('visibleStairs', () => {
    expect(visibleStairs([stair], ['escadas'])).toEqual([])
    expect(visibleStairs([stair], [])).toEqual([stair])
  })

  it('visibleLights', () => {
    expect(visibleLights([light], ['iluminacao'])).toEqual([])
  })

  it('visibleTokens', () => {
    expect(visibleTokens([token], ['tokens'])).toEqual([])
  })

  it('visibleDrawings', () => {
    expect(visibleDrawings([drawing], ['anotacoes'])).toEqual([])
  })

  it('visibleProps: objetos e decoracao são camadas independentes', () => {
    const props = [propObjeto, propDecoracao]
    expect(visibleProps(props, ['objetos']).map((p) => p.id)).toEqual(['p2'])
    expect(visibleProps(props, ['decoracao']).map((p) => p.id)).toEqual(['p1'])
  })
})

describe('countEntitiesByLayer', () => {
  it('conta cada entidade na camada derivada, independente de estar oculta', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = {
      ...map,
      walls: [wallNoDoor, wallWithDoor],
      regions: [region],
      stairs: [stair],
      lights: [light],
      tokens: [token],
      drawings: [drawing],
      props: [propObjeto, propDecoracao],
      hiddenLayers: ['paredes'], // oculta, mas a contagem não muda
    }

    const counts = countEntitiesByLayer(map)
    expect(counts.paredes).toBe(1)
    expect(counts.portas).toBe(1)
    expect(counts.salas).toBe(1)
    expect(counts.escadas).toBe(1)
    expect(counts.iluminacao).toBe(1)
    expect(counts.tokens).toBe(1)
    expect(counts.anotacoes).toBe(1)
    expect(counts.objetos).toBe(1)
    expect(counts.decoracao).toBe(1)
  })

  it('mapa vazio: toda camada zerada', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const counts = countEntitiesByLayer(map)
    for (const id of LAYER_IDS) {
      expect(counts[id]).toBe(0)
    }
  })
})
