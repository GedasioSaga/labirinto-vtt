/**
 * NOME PARA OS JOGADORES no editor do mestre: `setScenePublicName` grava o
 * nome público na entrada da cena, a lista o mostra ao mestre, o mundo que o
 * host serve o carrega (é de lá que o recorte do jogador lê) e o
 * `adventure.json` o guarda. Vazio apaga.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const { useAdventureStore, sceneList, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Terreo do cofre', 30, 20, 64))
  useSessionStore.getState().markSaved()
})

describe('nome da cena para os jogadores', () => {
  it('grava limpo, aparece na lista do mestre e no mundo que o host serve', () => {
    const andar = useAdventureStore.getState().createScene('Andar do vilao', null)
    useAdventureStore.setState({ structureDirty: false })
    useAdventureStore.getState().setScenePublicName(andar, '  1º andar ')

    const state = useAdventureStore.getState()
    expect(state.structureDirty).toBe(true)
    expect(state.adventure?.scenes.map((c) => [c.name, c.publicName])).toEqual([
      ['Terreo do cofre', undefined],
      ['Andar do vilao', '1º andar'],
    ])
    const lista = sceneList(state, useMapStore.getState().map)
    expect(lista.map((c) => c.publicName)).toEqual([undefined, '1º andar'])

    // A cena do andar é a aberta: o host a serve com o nome público junto.
    const mundo = hostWorldOf(state, useMapStore.getState().map)
    expect(mundo.open.sceneId).toBe(andar)
    expect(mundo.open.publicName).toBe('1º andar')
    expect(mundo.background.map((c) => c.publicName)).toEqual([undefined])
  })

  it('a cena de fundo leva o nome público dela ao host', () => {
    const andar = useAdventureStore.getState().createScene('Andar do vilao', null)
    const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().setScenePublicName(terreo, 'Térreo')
    useAdventureStore.getState().setScenePublicName(andar, '1º andar')
    expect(useAdventureStore.getState().switchScene(terreo)).toBe(true)

    const mundo = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    expect(mundo.open.publicName).toBe('Térreo')
    expect(mundo.background.map((c) => [c.sceneId, c.publicName])).toEqual([[andar, '1º andar']])
  })

  it('vazio apaga o nome público, e o adventure.json guarda o que ficou', async () => {
    const andar = useAdventureStore.getState().createScene('Andar do vilao', null)
    const terreo = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().setScenePublicName(terreo, 'Térreo')
    useAdventureStore.getState().setScenePublicName(andar, '1º andar')
    useAdventureStore.getState().setScenePublicName(andar, '   ')
    expect(useAdventureStore.getState().adventure?.scenes.map((c) => 'publicName' in c)).toEqual([true, false])

    await useAdventureStore.getState().flush()
    const gravada = parseAdventure(arquivos.get('C:/appdata/maps/map_raiz/adventure.json') ?? '')
    expect(gravada.scenes.map((c) => [c.name, c.publicName])).toEqual([
      ['Terreo do cofre', 'Térreo'],
      ['Andar do vilao', undefined],
    ])
  })
})
