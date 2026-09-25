/**
 * CENAS EM PASTAS no editor do mestre (`stores/adventureStore.ts`): pôr uma
 * cena dentro de outra muda só a lista de cenas (e pede Salvar), nunca a põe
 * dentro dela mesma, chega ao disco no `adventure.json` — e o jogador não
 * recebe nada: o mundo que o host serve é o mesmo com ou sem pasta.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'
import { travelSceneLabel } from '../lib/pinTravel'

const arquivos = new Map<string, string>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    arquivos.set(path, data)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
    arquivos.delete(from)
  }),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async (path: string) => arquivos.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
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

const { useAdventureStore, sceneList, hasUnsavedWork, hostWorldOf, travelSceneOptions } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')

subscribeToDirtyFlag()

const PASTA = 'C:/appdata/maps/map_costa'

function mapa(id: string, name: string): MapData {
  return createEmptyMap(`map_${id}`, name, 20, 16, 64)
}

/** Costa Norte (aberta), Porto Cinza, Mercado e Vila do Vau, todas no primeiro nível. */
function abrirViagem(): void {
  const cenas = [
    { id: 'costa', name: 'Costa Norte', file: 'map.json' },
    { id: 'porto', name: 'Porto Cinza', file: 'scenes/porto/map.json' },
    { id: 'mercado', name: 'Mercado', file: 'scenes/mercado/map.json' },
    { id: 'vila', name: 'Vila do Vau', file: 'scenes/vila/map.json' },
  ]
  const costa = mapa('costa', 'Costa Norte')
  useAdventureStore.getState().open({
    path: `${PASTA}/map.json`,
    map: costa,
    adventure: { version: 1, id: 'adv_viagem', name: 'Viagem', startSceneId: 'costa', scenes: cenas },
    adventureDir: PASTA,
    activeSceneId: 'costa',
    scenes: cenas.map((entry) => ({ entry, status: 'ok' as const, map: entry.id === 'costa' ? costa : mapa(entry.id, entry.name) })),
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 20, 16, 64))
  useSessionStore.getState().markSaved()
  abrirViagem()
})

describe('moveScene', () => {
  it('Mercado dentro de Porto Cinza: a lista de Cenas recua o Mercado e pede Salvar', () => {
    expect(hasUnsavedWork()).toBe(false)

    expect(useAdventureStore.getState().moveScene('mercado', 'porto')).toBe(true)

    const state = useAdventureStore.getState()
    expect(state.adventure?.scenes.find((s) => s.id === 'mercado')?.parentId).toBe('porto')
    expect(sceneList(state, useMapStore.getState().map).map((item) => [item.name, item.parentId ?? null])).toEqual([
      ['Costa Norte', null],
      ['Porto Cinza', null],
      ['Vila do Vau', null],
      ['Mercado', 'porto'],
    ])
    expect(state.structureDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
    // Só a lista mudou: a cena aberta e o desfazer dela ficam como estavam.
    expect(state.activeSceneId).toBe('costa')
    expect(useMapStore.getState().past).toEqual([])
  })

  it('primeiro nível de volta (null)', () => {
    useAdventureStore.getState().moveScene('mercado', 'porto')
    expect(useAdventureStore.getState().moveScene('mercado', null)).toBe(true)
    expect(useAdventureStore.getState().adventure?.scenes.find((s) => s.id === 'mercado')?.parentId).toBeUndefined()
  })

  it('recusa pôr Porto Cinza dentro do Mercado que está dentro dele, e não marca nada para salvar', () => {
    useAdventureStore.getState().moveScene('mercado', 'porto')
    useAdventureStore.setState({ structureDirty: false })
    const antes = useAdventureStore.getState().adventure

    expect(useAdventureStore.getState().moveScene('porto', 'mercado')).toBe(false)
    expect(useAdventureStore.getState().moveScene('porto', 'porto')).toBe(false)
    // Já está lá: nada a fazer.
    expect(useAdventureStore.getState().moveScene('mercado', 'porto')).toBe(false)
    expect(useAdventureStore.getState().moveScene('mercado', 'sumiu')).toBe(false)

    expect(useAdventureStore.getState().adventure).toBe(antes)
    expect(useAdventureStore.getState().structureDirty).toBe(false)
  })

  it('mapa solto não tem cenas para arrumar', () => {
    useAdventureStore.getState().reset()
    expect(useAdventureStore.getState().moveScene('mercado', 'porto')).toBe(false)
    expect(useAdventureStore.getState().adventure).toBeNull()
  })

  it('Salvar grava a pasta no adventure.json', async () => {
    useAdventureStore.getState().moveScene('mercado', 'porto')
    useAdventureStore.getState().moveScene('porto', 'costa')

    await useAdventureStore.getState().flush()

    const noDisco = parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '')
    expect(noDisco.scenes.map((s) => [s.id, s.parentId ?? null])).toEqual([
      ['costa', null],
      ['vila', null],
      ['mercado', 'porto'],
      ['porto', 'costa'],
    ])
    expect(hasUnsavedWork()).toBe(false)
  })
})

describe('o dado nas outras telas', () => {
  it('o "Leva a…" do pino de viagem diz o caminho da cena de dentro: duas Tavernas não se confundem', () => {
    useAdventureStore.getState().moveScene('mercado', 'porto')
    const opcoes = travelSceneOptions(useAdventureStore.getState())
    expect(opcoes.map((o) => [o.id, travelSceneLabel(o)])).toEqual([
      ['porto', 'Porto Cinza'],
      ['vila', 'Vila do Vau'],
      ['mercado', 'Porto Cinza › Mercado'],
    ])
  })

  it('o jogador não recebe nada: o mundo que o host serve é o mesmo com ou sem pasta', () => {
    const antes = JSON.stringify(hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map))
    useAdventureStore.getState().moveScene('mercado', 'porto')
    useAdventureStore.getState().moveScene('porto', 'vila')
    const depois = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    // Mesmas cenas, mesmos nomes (sem caminho), mesmos mapas; só a ordem da lista de fundo pode mudar.
    const porId = (mundo: ReturnType<typeof hostWorldOf>) =>
      [mundo.open, ...mundo.background].map((cena) => JSON.stringify(cena)).sort()
    expect(porId(depois)).toEqual(porId(JSON.parse(antes) as ReturnType<typeof hostWorldOf>))
    expect(JSON.stringify(depois)).not.toContain('parentId')
    expect(JSON.stringify(depois)).not.toContain('›')
  })
})
