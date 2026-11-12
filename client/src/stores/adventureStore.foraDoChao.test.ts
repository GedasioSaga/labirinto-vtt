/**
 * "FORA DO CHÃO" (`MapData.offFloor`) nas stores: a cena nova nasce LIVRE, o
 * andar novo criado por escada herda o valor da cena de baixo quando ela tem o
 * campo, e a janela "Configurar cena" grava a opção na cena aberta (um Ctrl+Z)
 * e na cena fechada (pelo cache). Mapa de antes, sem o campo, continua sem ele.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Stair } from '../types/map'

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

const { useAdventureStore, subscribeToTravelLinks } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap, setSceneOffFloor } = await import('../lib/mapFactory')

subscribeToTravelLinks()

const ESCADA: Stair = { id: 'escada-terreo', shape: 'straight', direction: 'up', segments: [{ x1: 400, y1: 300, x2: 400, y2: 180 }], stepWidth: 64 }

/** Uma aventura com o Térreo aberto (o mapa dado) e a Praça, cena nova, de fundo. Devolve o id da Praça. */
function montar(terreo: MapData): string {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(terreo)
  useSessionStore.getState().markSaved()
  const praca = useAdventureStore.getState().createScene('Praça', null)
  useAdventureStore.getState().switchScene(useAdventureStore.getState().adventure?.scenes[0].id ?? '')
  return praca
}

function mapaDoFundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`cena ${sceneId} fora do cache`)
  return slot.map
}

const terreoDeAntes = (): MapData => createEmptyMap('map_raiz', 'Térreo', 30, 20, 64)

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('cena nova nasce com Fora do Chão LIVRE', () => {
  it('a cena nova da aventura nasce livre; a cena de antes, aberta, continua sem o campo', () => {
    const praca = montar(terreoDeAntes())
    expect(mapaDoFundo(praca).offFloor).toBe('free')
    expect('offFloor' in useMapStore.getState().map).toBe(false)
  })

  it('o andar criado por escada herda o valor da cena de baixo se ela tem o campo; senão nasce livre', () => {
    const andarDe = (terreo: MapData): MapData => {
      montar(terreo)
      useMapStore.getState().addStair(ESCADA)
      const novo = useAdventureStore.getState().createFloorFromStair('escada-terreo', 'livre')
      if (novo === null) throw new Error('não criou o andar')
      return mapaDoFundo(novo)
    }
    expect(andarDe({ ...terreoDeAntes(), offFloor: 'blocked' }).offFloor).toBe('blocked')
    expect(andarDe({ ...terreoDeAntes(), offFloor: 'free' }).offFloor).toBe('free')
    expect(andarDe(terreoDeAntes()).offFloor).toBe('free')
  })
})

describe('a janela "Configurar cena" grava o Fora do Chão', () => {
  it('cena ABERTA: a ação da store grava e um Ctrl+Z desfaz; escolher o que já vale não cria passo', () => {
    montar(terreoDeAntes())
    const store = useMapStore.getState()
    const passosAntes = useMapStore.getState().past.length
    store.setSceneOffFloor('blocked')
    expect(useMapStore.getState().past.length).toBe(passosAntes)
    store.setSceneOffFloor('free')
    expect(useMapStore.getState().map.offFloor).toBe('free')
    expect(useMapStore.getState().past.length).toBe(passosAntes + 1)
    useMapStore.getState().undo()
    expect('offFloor' in useMapStore.getState().map).toBe(false)
  })

  it('cena FECHADA: a mesma troca pelo cache da aventura, sem abrir a cena', () => {
    const praca = montar(terreoDeAntes())
    useAdventureStore.getState().updateBackgroundScene(praca, (m) => setSceneOffFloor(m, 'blocked'))
    expect(mapaDoFundo(praca).offFloor).toBe('blocked')
    expect(useAdventureStore.getState().dirty[praca]).toBe(true)
    expect('offFloor' in useMapStore.getState().map).toBe(false)
  })
})
