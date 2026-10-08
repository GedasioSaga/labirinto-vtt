/**
 * SISTEMA DE RPG e PERSONAGENS no editor do mestre (`stores/adventureStore.ts`):
 * escolher o sistema, criar, trocar, importar e apagar personagem pedem Salvar
 * como a agenda, chegam ao `adventure.json` — e o jogador não recebe nada: o
 * mundo que o host serve não carrega a aventura.
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
const { novoPersonagem } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')

subscribeToDirtyFlag()

const PASTA = 'C:/appdata/maps/map_navio'

function mapa(id: string, name: string): MapData {
  return createEmptyMap(`map_${id}`, name, 20, 16, 64)
}

function abrirNavio(): void {
  const cenas = [
    { id: 'convés', name: 'Convés', file: 'map.json' },
    { id: 'porao', name: 'Porão', file: 'scenes/porao/map.json' },
  ]
  const conves = mapa('conves', 'Convés')
  useAdventureStore.getState().open({
    path: `${PASTA}/map.json`,
    map: conves,
    adventure: { version: 1, id: 'adv_navio', name: 'Navio', startSceneId: 'convés', scenes: cenas },
    adventureDir: PASTA,
    activeSceneId: 'convés',
    scenes: cenas.map((entry) => ({ entry, status: 'ok' as const, map: entry.id === 'convés' ? conves : mapa(entry.id, entry.name) })),
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

const vagn = () => ({ ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn Kane'), descricao: 'Ferreiro lunariano' })

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 20, 16, 64))
  useSessionStore.getState().markSaved()
  abrirNavio()
})

describe('sistema de RPG da aventura', () => {
  it('escolher pede Salvar, sem entrar no desfazer da cena aberta; null tira', () => {
    expect(hasUnsavedWork()).toBe(false)
    expect(useAdventureStore.getState().setSistemaDeRpg('one-piece')).toBe(true)
    expect(useAdventureStore.getState().adventure?.sistemaDeRpg).toBe('one-piece')
    expect(useAdventureStore.getState().structureDirty).toBe(true)
    expect(hasUnsavedWork()).toBe(true)
    expect(useMapStore.getState().past).toEqual([])

    useAdventureStore.getState().setSistemaDeRpg(null)
    const semSistema = useAdventureStore.getState().adventure
    expect(semSistema).not.toBeNull()
    expect(Object.keys(semSistema ?? {})).not.toContain('sistemaDeRpg')
  })

  it('mapa solto não tem sistema nem personagens', () => {
    useAdventureStore.getState().reset()
    expect(useAdventureStore.getState().setSistemaDeRpg('one-piece')).toBe(false)
    expect(useAdventureStore.getState().salvarPersonagem(vagn())).toBe(false)
    expect(useAdventureStore.getState().adicionarPersonagens([vagn()])).toBe(false)
    expect(useAdventureStore.getState().apagarPersonagem('qualquer')).toBe(false)
  })
})

describe('personagens da aventura', () => {
  it('salvar cria no fim e, com o mesmo id, troca no lugar', () => {
    const primeiro = vagn()
    const segundo = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'npc', 'Smoker') }
    useAdventureStore.getState().salvarPersonagem(primeiro)
    useAdventureStore.getState().salvarPersonagem(segundo)
    useAdventureStore.getState().salvarPersonagem({ ...primeiro, nome: 'Vagn' })
    expect(useAdventureStore.getState().adventure?.personagens?.map((personagem) => personagem.nome)).toEqual(['Vagn', 'Smoker'])
    expect(useMapStore.getState().past).toEqual([])
  })

  it('importar acrescenta na ordem; lista vazia não pede Salvar', () => {
    useAdventureStore.getState().adicionarPersonagens([])
    expect(useAdventureStore.getState().structureDirty).toBe(false)
    useAdventureStore.getState().adicionarPersonagens([vagn(), novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira')])
    expect(useAdventureStore.getState().adventure?.personagens?.map((personagem) => personagem.nome)).toEqual(['Vagn Kane', 'Aira'])
    expect(useAdventureStore.getState().structureDirty).toBe(true)
  })

  it('apagar tira só ele; id que não existe não muda nada', () => {
    const primeiro = vagn()
    useAdventureStore.getState().adicionarPersonagens([primeiro, novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira')])
    expect(useAdventureStore.getState().apagarPersonagem('nao-existe')).toBe(false)
    expect(useAdventureStore.getState().apagarPersonagem(primeiro.id)).toBe(true)
    expect(useAdventureStore.getState().adventure?.personagens?.map((personagem) => personagem.nome)).toEqual(['Aira'])
  })

  it('Salvar grava sistema e personagens no adventure.json', async () => {
    const personagem = vagn()
    useAdventureStore.getState().setSistemaDeRpg('one-piece')
    useAdventureStore.getState().salvarPersonagem(personagem)

    await useAdventureStore.getState().flush()

    const gravada = parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '')
    expect(gravada.sistemaDeRpg).toBe('one-piece')
    expect(gravada.personagens).toEqual([personagem])
    expect(useAdventureStore.getState().structureDirty).toBe(false)
  })

  it('o mundo que o host serve ao jogador não leva nada dos personagens', () => {
    useAdventureStore.getState().setSistemaDeRpg('one-piece')
    useAdventureStore.getState().salvarPersonagem(vagn())
    const mundo = JSON.stringify(hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map))
    expect(mundo).toContain('Porão')
    expect(mundo).not.toContain('Vagn')
    expect(mundo).not.toContain('Ferreiro lunariano')
    expect(mundo).not.toContain('personagens')
    expect(mundo).not.toContain('one-piece')
  })
})
