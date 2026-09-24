/**
 * LISTA "PINOS" no editor do mestre: os pinos de TODAS as cenas (a aberta pelo
 * mapa vivo, as de fundo pelo cache) e o "ir ao pino", que abre a cena dele
 * com o pino selecionado — o aceite "busca 'fac' abre a cena com o pino
 * selecionado" do cenário do crime.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco no teste')
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

const { useAdventureStore, pinScenesOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { createEmptyMap } = await import('../lib/mapFactory')

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 300, y: 400, kind: 'interrogacao', description: '', image: null, ...extra }
}

function comPinos(map: MapData, pins: Pin[]): MapData {
  return { ...map, pins }
}

const SALA = comPinos(createEmptyMap('map_sala', 'Sala', 30, 20, 64), [pino('vaso', { nome: 'Vaso quebrado' })])
const PORAO = comPinos(createEmptyMap('map_porao', 'Porão', 30, 20, 64), [pino('faca', { nome: 'Faca', description: 'Lâmina suja.' })])

function abrirAventura(): void {
  useAdventureStore.getState().open({
    path: 'C:/appdata/maps/map_sala/map.json',
    map: SALA,
    adventure: {
      version: 1,
      id: 'adv',
      name: 'Crime',
      startSceneId: 's_sala',
      scenes: [
        { id: 's_sala', name: 'Sala', file: 'map.json' },
        { id: 's_porao', name: 'Porão', file: 'scenes/s_porao/map.json' },
      ],
    },
    adventureDir: 'C:/appdata/maps/map_sala',
    activeSceneId: 's_sala',
    scenes: [
      { entry: { id: 's_sala', name: 'Sala', file: 'map.json' }, status: 'ok', map: SALA },
      { entry: { id: 's_porao', name: 'Porão', file: 'scenes/s_porao/map.json' }, status: 'ok', map: PORAO },
    ],
    changedSceneIds: [],
    adventureChanged: false,
  })
}

describe('adventureStore: pinos de todas as cenas', () => {
  beforeEach(() => {
    useAdventureStore.getState().reset()
    useMapStore.getState().setSelectedPin(null)
  })

  it('a lista junta a cena aberta e as de fundo, com o nome de cada cena', () => {
    abrirAventura()
    const cenas = pinScenesOf(useAdventureStore.getState(), useMapStore.getState().map)
    expect(cenas.map((c) => [c.sceneId, c.sceneName, c.pins.map((p) => p.id)])).toEqual([
      ['s_sala', 'Sala', ['vaso']],
      ['s_porao', 'Porão', ['faca']],
    ])
  })

  it('mapa solto (sem aventura): uma cena só, sem id, com os pinos do mapa vivo', () => {
    useMapStore.getState().loadMap(SALA)
    const cenas = pinScenesOf(useAdventureStore.getState(), useMapStore.getState().map)
    expect(cenas).toEqual([{ sceneId: null, sceneName: 'Sala', pins: SALA.pins }])
  })

  it('ir ao pino da outra cena abre a cena com o pino selecionado', () => {
    abrirAventura()
    expect(useAdventureStore.getState().goToPin('s_porao', 'faca')).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe('s_porao')
    expect(useMapStore.getState().selectedPinId).toBe('faca')
    expect(useAdventureStore.getState().cameraRequest?.focus?.x).toBe(300)
  })

  it('ir ao pino da cena aberta só anda a câmera e seleciona', () => {
    abrirAventura()
    expect(useAdventureStore.getState().goToPin('s_sala', 'vaso')).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe('s_sala')
    expect(useMapStore.getState().selectedPinId).toBe('vaso')
  })

  it('pino que não existe mais não troca de cena nem seleciona', () => {
    abrirAventura()
    expect(useAdventureStore.getState().goToPin('s_porao', 'sumiu')).toBe(false)
    expect(useAdventureStore.getState().activeSceneId).toBe('s_sala')
    expect(useMapStore.getState().selectedPinId).toBeNull()
  })
})
