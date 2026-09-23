/**
 * ABRIR AVENTURA RÁPIDO (`lib/mapFileIO.ts`): a cena pedida aparece sem
 * esperar as outras. `openMapFileFirst` lê só o mapa pedido e o
 * `adventure.json`; as outras cenas voltam "pendente" e `loadPendingScenes`
 * as lê depois, várias de uma vez — não uma atrás da outra.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Prop } from '../types/map'

const arquivos = new Map<string, string>()
/** Quantas leituras de arquivo estão em andamento agora, e o pico delas. */
let lendoAgora = 0
let picoDeLeituras = 0
/** Caminhos lidos, na ordem em que a leitura começou. */
const lidos: string[] = []

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    arquivos.set(path, data)
  }),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async (path: string) => arquivos.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    lidos.push(path)
    lendoAgora += 1
    picoDeLeituras = Math.max(picoDeLeituras, lendoAgora)
    try {
      // Uma leitura de disco de verdade demora: sem esta espera, leitura em
      // série e em paralelo seriam indistinguíveis no teste.
      await new Promise((resolve) => setTimeout(resolve, 2))
      const conteudo = arquivos.get(path)
      if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
      return conteudo
    } finally {
      lendoAgora -= 1
    }
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

const mapFileIO = await import('./mapFileIO')
const { serializeMap } = await import('./mapFile')
const { createEmptyMap } = await import('./mapFactory')
const { serializeAdventure } = await import('./adventure')

const PASTA = 'C:/appdata/maps/map_torre'
const TOTAL_DE_CENAS = 30

function mapa(id: string, name: string, overrides: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, name, 30, 20, 64), ...overrides }
}

function portal(id: string, destino: string): Prop {
  return { id, src: 'C:/imgs/escada.png', x: 64, y: 64, width: 64, height: 64, linkedMapPath: destino }
}

/** Torre de `TOTAL_DE_CENAS` andares no disco; o térreo é `map.json`, os outros em `scenes/`. */
function gravarTorre(): string[] {
  const cenas = Array.from({ length: TOTAL_DE_CENAS }, (_, i) => ({
    id: `andar_${i}`,
    name: `Andar ${i}`,
    file: i === 0 ? 'map.json' : `scenes/andar_${i}/map.json`,
  }))
  for (const cena of cenas) arquivos.set(`${PASTA}/${cena.file}`, serializeMap(mapa(`map_${cena.id}`, cena.name)))
  arquivos.set(`${PASTA}/adventure.json`, serializeAdventure({ version: 1, id: 'adv_torre', name: 'Torre', startSceneId: 'andar_0', scenes: cenas }))
  return cenas.map((cena) => cena.id)
}

/** Leituras de arquivo de CENA (o `adventure.json` não conta). */
function cenasLidas(): string[] {
  return lidos.filter((path) => path.endsWith('map.json'))
}

beforeEach(() => {
  arquivos.clear()
  lidos.length = 0
  lendoAgora = 0
  picoDeLeituras = 0
})

describe('openMapFileFirst: a cena pedida sem esperar as outras', () => {
  it('lê só o mapa pedido; as outras cenas voltam pendentes, na ordem da aventura', async () => {
    const ids = gravarTorre()

    const aberto = await mapFileIO.openMapFileFirst(`${PASTA}/scenes/andar_7/map.json`)

    expect(cenasLidas()).toEqual([`${PASTA}/scenes/andar_7/map.json`])
    expect(aberto.activeSceneId).toBe('andar_7')
    expect(aberto.map.name).toBe('Andar 7')
    expect(aberto.adventure?.scenes.map((c) => c.id)).toEqual(ids)
    expect(aberto.scenes.map((s) => s.entry.id)).toEqual(ids)
    expect(aberto.scenes.filter((s) => s.status === 'ok').map((s) => s.entry.id)).toEqual(['andar_7'])
    expect(aberto.scenes.filter((s) => s.status === 'pendente')).toHaveLength(TOTAL_DE_CENAS - 1)
  })

  it('mapa solto continua solto, sem cena pendente', async () => {
    arquivos.set('C:/appdata/maps/map_x/map.json', serializeMap(mapa('map_x', 'Casebre')))

    const aberto = await mapFileIO.openMapFileFirst('C:/appdata/maps/map_x/map.json')

    expect(aberto.adventure).toBeNull()
    expect(aberto.scenes).toEqual([])
  })
})

describe('loadPendingScenes: as outras cenas, em segundo plano', () => {
  it('traz todas as cenas, e a que sumiu do disco volta indisponível', async () => {
    const ids = gravarTorre()
    arquivos.delete(`${PASTA}/scenes/andar_3/map.json`)
    const primeiro = await mapFileIO.openMapFileFirst(`${PASTA}/map.json`)

    const completo = await mapFileIO.loadPendingScenes(primeiro)

    expect(completo.scenes.map((s) => s.entry.id)).toEqual(ids)
    expect(completo.scenes.map((s) => s.status)).toEqual(ids.map((id) => (id === 'andar_3' ? 'indisponivel' : 'ok')))
    const andar5 = completo.scenes[5]
    expect(andar5.status === 'ok' ? andar5.map.name : null).toBe('Andar 5')
    // A cena aberta é a mesma que já estava no editor: não é lida de novo.
    expect(completo.map).toBe(primeiro.map)
    expect(cenasLidas().filter((path) => path === `${PASTA}/map.json`)).toHaveLength(1)
  })

  it('lê várias cenas ao mesmo tempo, com teto', async () => {
    gravarTorre()
    const primeiro = await mapFileIO.openMapFileFirst(`${PASTA}/map.json`)

    await mapFileIO.loadPendingScenes(primeiro)

    expect(picoDeLeituras).toBeGreaterThan(1)
    expect(picoDeLeituras).toBeLessThanOrEqual(mapFileIO.SCENE_READ_CONCURRENCY)
  })

  it('openMapFile (tudo de uma vez) também lê as cenas em paralelo, não uma por uma', async () => {
    gravarTorre()

    const aberto = await mapFileIO.openMapFile(`${PASTA}/map.json`)

    expect(aberto.scenes.every((s) => s.status === 'ok')).toBe(true)
    expect(picoDeLeituras).toBeGreaterThan(1)
  })

  it('portal antigo numa cena de fundo ainda vira cena, ao chegar essa cena', async () => {
    gravarTorre()
    const destino = 'C:/appdata/maps/map_poco/map.json'
    arquivos.set(destino, serializeMap(mapa('map_poco', 'Poço')))
    arquivos.set(`${PASTA}/scenes/andar_2/map.json`, serializeMap(mapa('map_andar_2', 'Andar 2', { props: [portal('alcapao', destino)] })))
    const primeiro = await mapFileIO.openMapFileFirst(`${PASTA}/map.json`)
    expect(primeiro.changedSceneIds).toEqual([])

    const completo = await mapFileIO.loadPendingScenes(primeiro)

    const poco = completo.scenes.find((s) => s.status === 'ok' && s.map.name === 'Poço')
    expect(poco).toBeDefined()
    expect(completo.adventure?.scenes.map((c) => c.id)).toContain(poco?.entry.id)
    const andar2 = completo.scenes.find((s) => s.entry.id === 'andar_2')
    expect(andar2?.status === 'ok' ? andar2.map.props[0].linkedMapPath : 'sem mapa').toBeNull()
    expect([...completo.changedSceneIds].sort()).toEqual(['andar_2', poco?.entry.id ?? ''].sort())
    expect(completo.adventureChanged).toBe(true)
    // A cena aberta não muda por causa do que chegou depois.
    expect(completo.activeSceneId).toBe('andar_0')
    expect(completo.map).toBe(primeiro.map)
  })

  it('sem cena pendente, devolve o mesmo objeto sem ler nada', async () => {
    arquivos.set('C:/appdata/maps/map_x/map.json', serializeMap(mapa('map_x', 'Casebre')))
    const primeiro = await mapFileIO.openMapFileFirst('C:/appdata/maps/map_x/map.json')
    lidos.length = 0

    expect(await mapFileIO.loadPendingScenes(primeiro)).toBe(primeiro)
    expect(lidos).toEqual([])
  })
})
