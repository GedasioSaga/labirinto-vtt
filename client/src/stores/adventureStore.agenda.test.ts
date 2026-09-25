/**
 * AGENDA DA CAMPANHA no editor do mestre (`stores/adventureStore.ts`): trocar
 * a agenda pede Salvar como renomear cena, chega ao `adventure.json` — e o
 * jogador não recebe nada: o mundo que o host serve não carrega a agenda.
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

const { useAdventureStore, hasUnsavedWork, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')
const { adicionarEvento, novaAgenda } = await import('../lib/agendaDaCampanha')

subscribeToDirtyFlag()

const PASTA = 'C:/appdata/maps/map_torre'

function mapa(id: string, name: string): MapData {
  return createEmptyMap(`map_${id}`, name, 20, 16, 64)
}

function abrirTorre(): void {
  const cenas = [
    { id: 'salao', name: 'Salão', file: 'map.json' },
    { id: 'cripta', name: 'Cripta', file: 'scenes/cripta/map.json' },
  ]
  const salao = mapa('salao', 'Salão')
  useAdventureStore.getState().open({
    path: `${PASTA}/map.json`,
    map: salao,
    adventure: { version: 1, id: 'adv_torre', name: 'Torre', startSceneId: 'salao', scenes: cenas },
    adventureDir: PASTA,
    activeSceneId: 'salao',
    scenes: cenas.map((entry) => ({ entry, status: 'ok' as const, map: entry.id === 'salao' ? salao : mapa(entry.id, entry.name) })),
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

function agendaDosGemeos() {
  const agenda = adicionarEvento(novaAgenda(), 'Disparo dos Gêmeos', { dia: 7, apito: 'meio' })
  if (agenda === null) throw new Error('não marcou o evento')
  return agenda
}

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 20, 16, 64))
  useSessionStore.getState().markSaved()
  abrirTorre()
})

describe('setAgenda', () => {
  it('troca a agenda da aventura e pede Salvar, sem entrar no desfazer da cena aberta', () => {
    expect(hasUnsavedWork()).toBe(false)
    const agenda = agendaDosGemeos()

    expect(useAdventureStore.getState().setAgenda(agenda)).toBe(true)

    const state = useAdventureStore.getState()
    expect(state.adventure?.agenda).toEqual(agenda)
    expect(state.structureDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
    expect(useMapStore.getState().past).toEqual([])
  })

  it('mapa solto não tem agenda', () => {
    useAdventureStore.getState().reset()
    expect(useAdventureStore.getState().setAgenda(agendaDosGemeos())).toBe(false)
    expect(useAdventureStore.getState().adventure).toBeNull()
  })

  it('Salvar grava a agenda no adventure.json', async () => {
    const agenda = agendaDosGemeos()
    useAdventureStore.getState().setAgenda(agenda)

    await useAdventureStore.getState().flush()

    expect(parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '').agenda).toEqual(agenda)
    expect(useAdventureStore.getState().structureDirty).toBe(false)
  })

  it('o mundo que o host serve ao jogador não leva nada da agenda', () => {
    useAdventureStore.getState().setAgenda(agendaDosGemeos())
    const mundo = JSON.stringify(hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map))
    expect(mundo).toContain('Cripta')
    expect(mundo).not.toContain('Gêmeos')
    expect(mundo).not.toContain('agenda')
  })
})
