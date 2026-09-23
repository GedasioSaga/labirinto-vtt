/**
 * CENAS EM PASTAS no disco (`lib/mapFileIO.ts` + `lib/adventure.ts`): a cena
 * de fora de cada cena vai no `adventure.json` e volta igual ao reabrir; a
 * aventura gravada antes das pastas abre com tudo no primeiro nível.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData } from '../types/map'

const arquivos = new Map<string, string>()
const pastas = new Set<string>()

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
  mkdir: vi.fn(async (path: string) => {
    pastas.add(path)
  }),
  exists: vi.fn(async (path: string) => arquivos.has(path) || pastas.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
  }),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/Users/test/AppData/Roaming/labirinto'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { openMapFile, saveAdventureToDisk } = await import('./mapFileIO')
const { serializeMap } = await import('./mapFile')
const { createEmptyMap } = await import('./mapFactory')
const { nestScene, sceneTree, serializeAdventure } = await import('./adventure')

const PASTA = 'C:/Users/test/AppData/Roaming/labirinto/maps/map_viagem'

function mapa(id: string, name: string): MapData {
  return createEmptyMap(id, name, 20, 16, 64)
}

/** Grava a aventura da viagem no disco de mentira: Costa Norte > Porto Cinza, e Mercado ainda solto. */
function gravarViagem(comPastas: boolean): void {
  const cenas = [
    { id: 'costa', name: 'Costa Norte', file: 'map.json' },
    { id: 'porto', name: 'Porto Cinza', file: 'scenes/porto/map.json', ...(comPastas ? { parentId: 'costa' } : {}) },
    { id: 'mercado', name: 'Mercado', file: 'scenes/mercado/map.json' },
  ]
  for (const c of cenas) arquivos.set(`${PASTA}/${c.file}`, serializeMap(mapa(`map_${c.id}`, c.name)))
  arquivos.set(`${PASTA}/adventure.json`, serializeAdventure({ version: 1, id: 'adv_viagem', name: 'Viagem', startSceneId: 'costa', scenes: cenas }))
}

beforeEach(() => {
  arquivos.clear()
  pastas.clear()
})

describe('cenas em pastas no disco', () => {
  it('Mercado posto dentro de Porto Cinza: salva e reabre igual, pelo arquivo de qualquer cena', async () => {
    gravarViagem(true)
    const aberta = await openMapFile(`${PASTA}/map.json`)
    const aventura = aberta.adventure
    if (aventura === null || aberta.adventureDir === null) throw new Error('a viagem deveria abrir como aventura')
    expect(aventura.scenes.find((s) => s.id === 'porto')?.parentId).toBe('costa')

    const cenas = nestScene(aventura.scenes, 'mercado', 'porto')
    if (cenas === null) throw new Error('Mercado deveria caber dentro de Porto Cinza')
    await saveAdventureToDisk(aberta.adventureDir, { ...aventura, scenes: cenas }, [])

    expect(JSON.parse(arquivos.get(`${PASTA}/adventure.json`) ?? '{}').scenes).toEqual([
      { id: 'costa', name: 'Costa Norte', file: 'map.json' },
      { id: 'porto', name: 'Porto Cinza', file: 'scenes/porto/map.json', parentId: 'costa' },
      { id: 'mercado', name: 'Mercado', file: 'scenes/mercado/map.json', parentId: 'porto' },
    ])
    for (const caminho of [`${PASTA}/map.json`, `${PASTA}/scenes/mercado/map.json`]) {
      const reaberta = await openMapFile(caminho)
      expect(sceneTree(reaberta.adventure?.scenes ?? []).map((row) => [row.entry.name, row.depth])).toEqual([
        ['Costa Norte', 0],
        ['Porto Cinza', 1],
        ['Mercado', 2],
      ])
      // Abrir não regrava nada: a aventura veio igual ao disco.
      expect(reaberta.adventureChanged).toBe(false)
    }
  })

  it('aventura gravada antes das pastas abre com tudo no primeiro nível', async () => {
    gravarViagem(false)
    const aberta = await openMapFile(`${PASTA}/scenes/porto/map.json`)
    expect(aberta.activeSceneId).toBe('porto')
    expect(aberta.adventure?.scenes.map((s) => s.parentId ?? null)).toEqual([null, null, null])
    expect(sceneTree(aberta.adventure?.scenes ?? []).map((row) => row.depth)).toEqual([0, 0, 0])
  })
})
