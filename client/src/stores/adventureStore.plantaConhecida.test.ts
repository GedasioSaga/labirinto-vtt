/**
 * "Planta conhecida por todos" é da CENA: fica no `adventure.json` (sobrevive
 * a fechar e abrir), aparece na lista Cenas e chega ao host pelo mundo que ele
 * serve (`hostWorldOf`) — nunca pelo mapa, que é o que vai ao jogador.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ''),
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

const { useAdventureStore, sceneList, hostWorldOf } = await import('./adventureStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure, serializeAdventure } = await import('../lib/adventure')

const capital = createEmptyMap('m-capital', 'Capital', 20, 10, 50)
const abadia = createEmptyMap('m-abadia', 'Abadia', 20, 10, 50)

beforeEach(() => {
  useAdventureStore.getState().reset()
  useAdventureStore.setState({
    adventure: {
      version: 1,
      id: 'adv',
      name: 'Aventura',
      startSceneId: 's-capital',
      scenes: [
        { id: 's-capital', name: 'Capital', file: 'scenes/s-capital/map.json' },
        { id: 's-abadia', name: 'Abadia', file: 'scenes/s-abadia/map.json' },
      ],
    },
    activeSceneId: 's-capital',
    cache: { 's-abadia': { status: 'ok', map: abadia, past: [], future: [], camera: null } },
    structureDirty: false,
  })
})

describe('Planta conhecida por todos', () => {
  it('ligar marca a cena, aparece na lista e no mundo do host; desligar volta', () => {
    useAdventureStore.getState().setScenePlanKnown('s-abadia', true)
    const state = useAdventureStore.getState()
    expect(state.structureDirty).toBe(true)
    expect(sceneList(state, capital).map((s) => [s.id, s.planKnownByAll === true])).toEqual([
      ['s-capital', false],
      ['s-abadia', true],
    ])
    const world = hostWorldOf(state, capital)
    expect(world.open.planKnownByAll === true).toBe(false)
    expect(world.background.map((s) => [s.sceneId, s.planKnownByAll === true])).toEqual([['s-abadia', true]])

    useAdventureStore.getState().setScenePlanKnown('s-abadia', false)
    expect(sceneList(useAdventureStore.getState(), capital)[1]?.planKnownByAll === true).toBe(false)
    // Desligada, a entrada não carrega o campo: o arquivo fica igual ao de antes.
    expect(useAdventureStore.getState().adventure?.scenes[1]).toEqual({ id: 's-abadia', name: 'Abadia', file: 'scenes/s-abadia/map.json' })
  })

  it('cena aberta ligada chega ao host pela cena aberta; cena que não existe não muda nada', () => {
    useAdventureStore.getState().setScenePlanKnown('s-capital', true)
    expect(hostWorldOf(useAdventureStore.getState(), capital).open.planKnownByAll).toBe(true)
    const antes = useAdventureStore.getState().adventure
    useAdventureStore.getState().setScenePlanKnown('s-nao-existe', true)
    expect(useAdventureStore.getState().adventure?.scenes).toEqual(antes?.scenes)
  })

  it('grava e relê no adventure.json; lixo no campo vira desligado', () => {
    useAdventureStore.getState().setScenePlanKnown('s-abadia', true)
    const adventure = useAdventureStore.getState().adventure
    if (adventure === null) throw new Error('sem aventura')
    const relida = parseAdventure(serializeAdventure(adventure))
    expect(relida.scenes.map((s) => s.planKnownByAll === true)).toEqual([false, true])

    const lixo = parseAdventure(JSON.stringify({ scenes: [{ id: 'a', name: 'A', file: 'a/map.json', planKnownByAll: 'sim' }] }))
    expect(lixo.scenes[0]).toEqual({ id: 'a', name: 'A', file: 'a/map.json' })
  })
})
