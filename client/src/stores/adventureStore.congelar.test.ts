/**
 * CONGELAR FICHA no editor do mestre. Uma ficha pela ficha técnica (o
 * interruptor "Congelado", ao lado do "Travado": passo do Ctrl+Z, como ele) e
 * todas de uma vez pelo Grupo ("Congelar todos" / "Descongelar todos"), em
 * toda cena carregada. O lote é mudança de MESA, como a troca do estado do
 * mundo: desfazer um traço não descongela ninguém, e a cena fica pendente de
 * Salvar. O campo grava e volta do disco como os outros da ficha.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
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

const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { deserializeMap, serializeMap } = await import('../lib/mapFile')

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y: 96, size: 1, image: null, ...extra }
}

const congeladas = (map: MapData): string[] => map.tokens.filter((t) => t.congelado === true).map((t) => t.id)

function fundo(sceneId: string): MapData {
  const slot = useAdventureStore.getState().cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`a cena ${sceneId} deveria estar carregada`)
  return slot.map
}

/**
 * Salão (de fundo) com a ficha da Ana e o NPC; Cripta (aberta) com a da Bia.
 * Ana e Bia jogam; o NPC é do mestre.
 */
function montar(): { salao: string; cripta: string } {
  const salao: MapData = { ...createEmptyMap('map_salao', 'Salão', 30, 20, 64), tokens: [ficha('ana', 96), ficha('npc', 224)] }
  useMapStore.getState().loadMap(salao)
  useSessionStore.getState().markSaved()
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const salaoId = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useMapStore.getState().addToken(ficha('bia', 160))
  return { salao: salaoId, cripta }
}

beforeEach(() => {
  useAdventureStore.getState().reset()
})

describe('uma ficha pela ficha técnica', () => {
  it('"Congelado" liga e desliga pela mesma ação do "Travado", e o Ctrl+Z desfaz como desfaz a trava', () => {
    useMapStore.getState().loadMap({ ...createEmptyMap('map_solto', 'Solto', 30, 20, 64), tokens: [ficha('ana', 96)] })
    useMapStore.getState().updateToken('ana', { congelado: true })
    expect(congeladas(useMapStore.getState().map)).toEqual(['ana'])
    useMapStore.getState().undo()
    expect(congeladas(useMapStore.getState().map)).toEqual([])
  })
})

describe('"Congelar todos" e "Descongelar todos" do Grupo', () => {
  it('congela as fichas pedidas na cena aberta E na de fundo, e deixa o resto', () => {
    const m = montar()
    useAdventureStore.getState().congelarFichas(new Set(['ana', 'bia']), true)
    expect(congeladas(useMapStore.getState().map)).toEqual(['bia'])
    expect(congeladas(fundo(m.salao))).toEqual(['ana'])
    // A cena de fundo que mudou fica pendente de gravação.
    expect(useAdventureStore.getState().dirty[m.salao]).toBe(true)
  })

  it('é mudança de mesa: desfazer o último traço do mestre não descongela ninguém', () => {
    montar()
    useMapStore.getState().addToken(ficha('bau', 288))
    useAdventureStore.getState().congelarFichas(new Set(['bia']), true)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens.some((t) => t.id === 'bau')).toBe(false)
    expect(congeladas(useMapStore.getState().map)).toEqual(['bia'])
  })

  it('"Descongelar todos" solta toda ficha congelada em toda cena carregada, e apaga o campo', () => {
    const m = montar()
    useAdventureStore.getState().congelarFichas(new Set(['ana', 'bia', 'npc']), true)
    useAdventureStore.getState().descongelarTodas()
    expect(congeladas(useMapStore.getState().map)).toEqual([])
    expect(congeladas(fundo(m.salao))).toEqual([])
    expect(fundo(m.salao).tokens.some((t) => 'congelado' in t)).toBe(false)
  })

  it('mapa solto (sem aventura): vale na cena aberta', () => {
    useMapStore.getState().loadMap({ ...createEmptyMap('map_solto', 'Solto', 30, 20, 64), tokens: [ficha('ana', 96), ficha('npc', 224)] })
    useAdventureStore.getState().congelarFichas(new Set(['ana']), true)
    expect(congeladas(useMapStore.getState().map)).toEqual(['ana'])
  })
})

describe('persiste com a cena', () => {
  it('o campo vai para o arquivo e volta dele como os outros da ficha', () => {
    const map: MapData = { ...createEmptyMap('map_x', 'X', 10, 10, 64), tokens: [ficha('ana', 96, { congelado: true }), ficha('bia', 160)] }
    const lido = deserializeMap(serializeMap(map))
    expect(congeladas(lido)).toEqual(['ana'])
    expect('congelado' in (lido.tokens[1] ?? {})).toBe(false)
  })
})
