/**
 * HOJE NA SESSÃO na store: "Fixar no topo" grava na aventura (pede Salvar,
 * como mover uma cena) e a sexta não entra — a store diz `cheia` e não muda nada.
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

const { useAdventureStore } = await import('./adventureStore')
const { parseAdventure } = await import('../lib/adventure')

const IDS = ['vila', 'praca', 'forja', 'taverna', 'adega', 'bosque', 'mina']

function aventura() {
  return parseAdventure(
    JSON.stringify({
      version: 1,
      id: 'adv_vila',
      name: 'Vila Pedra-Lume',
      startSceneId: 'vila',
      scenes: IDS.map((id) => ({ id, name: `Cena ${id}`, file: `scenes/${id}/map.json` })),
    }),
  )
}

describe('alternarFixada (store)', () => {
  beforeEach(() => {
    useAdventureStore.setState({ adventure: aventura(), structureDirty: false })
  })

  it('fixa no fim, tira de volta, pede Salvar; cena que não existe ou mapa solto não muda nada', () => {
    const store = () => useAdventureStore.getState()
    expect(store().alternarFixada('bosque')).toBe('fixou')
    expect(store().alternarFixada('praca')).toBe('fixou')
    expect(store().adventure?.fixadas).toEqual(['bosque', 'praca'])
    expect(store().structureDirty).toBe(true)
    expect(store().alternarFixada('bosque')).toBe('tirou')
    expect(store().adventure?.fixadas).toEqual(['praca'])
    expect(store().alternarFixada('sumiu')).toBe('nada')
    expect(store().adventure?.fixadas).toEqual(['praca'])
    useAdventureStore.setState({ adventure: null })
    expect(store().alternarFixada('praca')).toBe('nada')
  })

  it('a sexta fixada é recusada: a lista e o "não salvo" ficam como estavam', () => {
    const store = () => useAdventureStore.getState()
    for (const id of IDS.slice(0, 5)) expect(store().alternarFixada(id)).toBe('fixou')
    useAdventureStore.setState({ structureDirty: false })
    expect(store().alternarFixada('bosque')).toBe('cheia')
    expect(store().adventure?.fixadas).toEqual(IDS.slice(0, 5))
    expect(store().structureDirty).toBe(false)
    // Tirar uma abre lugar.
    expect(store().alternarFixada('vila')).toBe('tirou')
    expect(store().alternarFixada('bosque')).toBe('fixou')
    expect(store().adventure?.fixadas).toEqual(['praca', 'forja', 'taverna', 'adega', 'bosque'])
  })
})
