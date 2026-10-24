/**
 * DIA/TARDE/NOITE no editor do mestre (Luz L1, decisão D6): o período da
 * sessão mora na aventura (`Adventure.periodo`). Trocar pede Salvar, fora do
 * desfazer da cena aberta; Dia tira o campo (ausente = dia), então a aventura
 * que termina de dia grava igual à de antes. Aventura antiga (sem o campo, ou
 * com o 'manha' do relógio antigo) abre de dia. Mapa solto (sem
 * `adventure.json`) guarda o período só na sessão e o passa à aventura que
 * nasce dele.
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

const { useAdventureStore, hasUnsavedWork, periodoDaSessao } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure, serializeAdventure } = await import('../lib/adventure')

subscribeToDirtyFlag()

const PASTA = 'C:/appdata/maps/map_torre'

/** `adventure.json` de antes da Luz, como estava no disco (sem `periodo`). */
const AVENTURA_ANTIGA = JSON.stringify(
  {
    version: 1,
    id: 'adv_torre',
    name: 'Torre',
    startSceneId: 'salao',
    scenes: [
      { id: 'salao', name: 'Salão', file: 'map.json' },
      { id: 'cripta', name: 'Cripta', file: 'scenes/cripta/map.json' },
    ],
  },
  null,
  2,
)

function mapa(id: string, name: string): MapData {
  return createEmptyMap(`map_${id}`, name, 20, 16, 64)
}

function abrirTorre(json: string): void {
  const adventure = parseAdventure(json)
  const salao = mapa('salao', 'Salão')
  useAdventureStore.getState().open({
    path: `${PASTA}/map.json`,
    map: salao,
    adventure,
    adventureDir: PASTA,
    activeSceneId: 'salao',
    scenes: adventure.scenes.map((entry) => ({ entry, status: 'ok' as const, map: entry.id === 'salao' ? salao : mapa(entry.id, entry.name) })),
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

beforeEach(() => {
  arquivos.clear()
  useAdventureStore.getState().reset()
  useAdventureStore.getState().setPeriodo('dia')
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 20, 16, 64))
  useSessionStore.getState().markSaved()
})

describe('período da sessão na aventura', () => {
  it('aventura antiga abre de dia, sem pedir Salvar, e grava byte a byte igual', async () => {
    abrirTorre(AVENTURA_ANTIGA)
    expect(periodoDaSessao(useAdventureStore.getState())).toBe('dia')
    expect(hasUnsavedWork()).toBe(false)
    const adventure = useAdventureStore.getState().adventure
    if (adventure === null) throw new Error('a aventura não abriu')
    expect(serializeAdventure(adventure)).toBe(AVENTURA_ANTIGA)
  })

  it("aventura com o 'manha' do relógio antigo abre de dia", () => {
    abrirTorre(JSON.stringify({ ...JSON.parse(AVENTURA_ANTIGA), periodo: 'manha' }))
    expect(periodoDaSessao(useAdventureStore.getState())).toBe('dia')
  })

  it('trocar o período grava na aventura e pede Salvar, fora do desfazer da cena', async () => {
    abrirTorre(AVENTURA_ANTIGA)
    useAdventureStore.getState().setPeriodo('noite')
    expect(periodoDaSessao(useAdventureStore.getState())).toBe('noite')
    expect(useAdventureStore.getState().adventure?.periodo).toBe('noite')
    expect(hasUnsavedWork()).toBe(true)
    expect(useMapStore.getState().past).toEqual([])
    await useAdventureStore.getState().flush()
    expect(parseAdventure(arquivos.get(`${PASTA}/adventure.json`) ?? '').periodo).toBe('noite')
  })

  it('voltar para Dia tira o campo: a aventura grava igual à de antes', async () => {
    abrirTorre(AVENTURA_ANTIGA)
    useAdventureStore.getState().setPeriodo('tarde')
    useAdventureStore.getState().setPeriodo('dia')
    await useAdventureStore.getState().flush()
    expect(arquivos.get(`${PASTA}/adventure.json`)).toBe(AVENTURA_ANTIGA)
  })

  it('o mesmo período de novo não pede Salvar', () => {
    abrirTorre(AVENTURA_ANTIGA)
    useAdventureStore.getState().setPeriodo('dia')
    expect(hasUnsavedWork()).toBe(false)
  })
})

describe('período da sessão no mapa solto', () => {
  it('fica na sessão, sem pedir Salvar, e passa para a aventura que nasce do mapa', () => {
    useAdventureStore.getState().setPeriodo('tarde')
    expect(useAdventureStore.getState().adventure).toBeNull()
    expect(periodoDaSessao(useAdventureStore.getState())).toBe('tarde')
    expect(hasUnsavedWork()).toBe(false)
    expect(useAdventureStore.getState().virarAventura(null)).toBe(true)
    expect(useAdventureStore.getState().adventure?.periodo).toBe('tarde')
    expect(periodoDaSessao(useAdventureStore.getState())).toBe('tarde')
  })
})
