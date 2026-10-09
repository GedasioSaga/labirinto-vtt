/**
 * CENA INICIAL: o mestre escolhe em que cena a aventura abre ("Definir como
 * cena inicial" no "…" da cena), e abrir pelo Carregar Mapa cai nela — e não
 * na cena do arquivo salvo por último (o Reino de Goa abria no Subterrâneo).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'

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

const { useAdventureStore, sceneList } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { openMapFileFirst } = await import('../lib/mapFileIO')
const { serializeMap } = await import('../lib/mapFile')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure, serializeAdventure } = await import('../lib/adventure')

const PASTA = 'C:/appdata/maps/adv_goa'
/** O Subterrâneo é a primeira cena (`map.json` da raiz): é o arquivo que o card da lista aponta. */
const SUBTERRANEO = `${PASTA}/map.json`
const REINO = `${PASTA}/scenes/s_goa/map.json`

function mapa(id: string, name: string): MapData {
  return createEmptyMap(id, name, 20, 16, 64)
}

function gravarAventura(startSceneId: string): void {
  arquivos.set(SUBTERRANEO, serializeMap(mapa('map_sub', 'Subterrâneo')))
  arquivos.set(REINO, serializeMap(mapa('map_goa', 'Reino de Goa')))
  arquivos.set(
    `${PASTA}/adventure.json`,
    serializeAdventure({
      version: 1,
      id: 'adv_goa',
      name: 'Reino de Goa',
      startSceneId,
      scenes: [
        { id: 's_sub', name: 'Subterrâneo', file: 'map.json' },
        { id: 's_goa', name: 'Reino de Goa', file: 'scenes/s_goa/map.json' },
      ],
    }),
  )
}

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
})

describe('abrir cai na cena inicial', () => {
  it('pelo Carregar Mapa: abre o Reino de Goa mesmo com o card apontando para o Subterrâneo', async () => {
    gravarAventura('s_goa')
    const aberto = await openMapFileFirst(SUBTERRANEO, true)
    expect(aberto.activeSceneId).toBe('s_goa')
    expect(aberto.path).toBe(REINO)
    expect(aberto.map.name).toBe('Reino de Goa')
    expect(aberto.scenes.map((load) => [load.entry.id, load.status])).toEqual([
      ['s_sub', 'pendente'],
      ['s_goa', 'ok'],
    ])
  })

  it('sem a opção (Recuperar) abre exatamente o arquivo pedido', async () => {
    gravarAventura('s_goa')
    const aberto = await openMapFileFirst(SUBTERRANEO)
    expect(aberto.activeSceneId).toBe('s_sub')
    expect(aberto.path).toBe(SUBTERRANEO)
  })

  it('cena inicial que não abre: fica a cena pedida, sem erro', async () => {
    gravarAventura('s_goa')
    arquivos.delete(REINO)
    const aberto = await openMapFileFirst(SUBTERRANEO, true)
    expect(aberto.activeSceneId).toBe('s_sub')
    expect(aberto.map.name).toBe('Subterrâneo')
  })
})

describe('"Definir como cena inicial"', () => {
  it('troca a cena inicial, marca a lista, pede Salvar; gravada, a próxima abertura cai nela', async () => {
    gravarAventura('s_sub')
    await useAdventureStore.getState().open(await openMapFileFirst(SUBTERRANEO, true))
    const lista = () => sceneList(useAdventureStore.getState(), useMapStore.getState().map).map((item) => [item.id, item.start === true])
    expect(lista()).toEqual([
      ['s_sub', true],
      ['s_goa', false],
    ])

    expect(useAdventureStore.getState().definirCenaInicial('s_sub')).toBe(false)
    expect(useAdventureStore.getState().definirCenaInicial('s_nao_existe')).toBe(false)
    expect(useAdventureStore.getState().structureDirty).toBe(false)

    expect(useAdventureStore.getState().definirCenaInicial('s_goa')).toBe(true)
    expect(useAdventureStore.getState().structureDirty).toBe(true)
    expect(lista()).toEqual([
      ['s_sub', false],
      ['s_goa', true],
    ])

    await useAdventureStore.getState().flush()
    expect(parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '').startSceneId).toBe('s_goa')
    expect((await openMapFileFirst(SUBTERRANEO, true)).activeSceneId).toBe('s_goa')
  })

  it('mapa solto não tem cena inicial para trocar', () => {
    useAdventureStore.getState().reset()
    expect(useAdventureStore.getState().definirCenaInicial('s_goa')).toBe(false)
  })
})
