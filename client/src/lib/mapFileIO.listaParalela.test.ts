import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `listSavedMaps` alimenta a tela "Carregar mapa" (e renomear, duplicar e
 * importar, que pegam os nomes por ela). Cada pasta custa de 4 a 10 idas e
 * voltas pela ponte do Tauri — join, exists, stat, readTextFile —, e em série
 * as ~15 pastas de um usuário somavam ~75 esperas uma atrás da outra. Estes
 * testes prendem as duas metades da troca: as pastas andam ao mesmo tempo, e a
 * lista sai igual à da leitura em série (mesmas entradas, mesma ordem, empates
 * na ordem do `readDir`).
 */

interface FakeDirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

const MTIME_PADRAO = new Date('2026-01-01T00:00:00.000Z')

const existsMock = vi.fn(async (_path: string) => false)
const readTextFileMock = vi.fn(async (_path: string) => '')
const readDirMock = vi.fn(async (_path: string): Promise<FakeDirEntry[]> => [])
const statMock = vi.fn(async (_path: string): Promise<{ mtime: Date | null }> => ({ mtime: MTIME_PADRAO }))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  exists: existsMock,
  readTextFile: readTextFileMock,
  readDir: readDirMock,
  stat: statMock,
  remove: vi.fn(),
  copyFile: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(), open: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:\\Users\\test\\AppData\\Roaming\\labirinto'),
  join: vi.fn(async (...parts: string[]) => parts.join('\\')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('\\'))),
}))

const { listSavedMaps } = await import('./mapFileIO')

const MAPS_DIR = 'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps'

function dirEntry(name: string, isDirectory = true): FakeDirEntry {
  return { name, isDirectory, isFile: !isDirectory, isSymlink: false }
}

function mapJson(pasta: string): string {
  return `${MAPS_DIR}\\${pasta}\\map.json`
}

function mapaSalvo(id: string, name: string, width = 30, height = 20, grid = 64): string {
  return JSON.stringify({ id, name, width, height, grid })
}

/** Dá uma volta no laço de eventos: tudo o que só espera microtarefa anda. */
function proximaVolta(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  existsMock.mockImplementation(async () => false)
  readTextFileMock.mockImplementation(async () => '')
  readDirMock.mockImplementation(async () => [])
  statMock.mockImplementation(async () => ({ mtime: MTIME_PADRAO }))
})

describe('listSavedMaps lê as pastas ao mesmo tempo', () => {
  it('pede o map.json de todas as pastas antes de a primeira leitura voltar', async () => {
    const pastas = ['map_a', 'map_b', 'map_c']
    existsMock.mockImplementation(async (path: string) => path === MAPS_DIR || pastas.some((pasta) => path === mapJson(pasta)))
    readDirMock.mockImplementation(async () => pastas.map((pasta) => dirEntry(pasta)))
    const pedidos: string[] = []
    const soltar: (() => void)[] = []
    readTextFileMock.mockImplementation((path: string) => {
      pedidos.push(path)
      const pasta = pastas.find((p) => path === mapJson(p)) ?? 'desconhecida'
      return new Promise<string>((resolve) => soltar.push(() => resolve(mapaSalvo(pasta, pasta.toUpperCase()))))
    })

    const lista = listSavedMaps()
    await proximaVolta()

    // Em série, aqui só o map.json da primeira pasta teria sido pedido: a
    // segunda esperava a leitura da primeira voltar.
    expect(pedidos).toEqual(pastas.map(mapJson))

    for (const libera of soltar) libera()
    expect((await lista).map((entry) => [entry.id, entry.name])).toEqual([
      ['map_a', 'MAP_A'],
      ['map_b', 'MAP_B'],
      ['map_c', 'MAP_C'],
    ])
  })

  it('a lista sai igual à da leitura em série, mesmo com as pastas terminando fora de ordem', async () => {
    const TORRE = `${MAPS_DIR}\\cidade-torre`
    const TORRE_ADVENTURE = `${TORRE}\\adventure.json`
    const ESGOTO = `${TORRE}\\scenes\\scene_esgoto\\map.json`
    const MAIO = new Date('2026-05-01T12:00:00.000Z')
    const SETEMBRO = new Date('2026-09-22T09:00:00.000Z')
    const VELHO = new Date('2020-01-01T00:00:00.000Z')

    // Ordem crua do readDir. Empate de mtime (as três de maio) tem de sair
    // nesta ordem, como saía em série: o sort é estável.
    readDirMock.mockImplementation(async () => [
      dirEntry('leia-me.txt', false),
      dirEntry('map_velho'),
      dirEntry('map_empate_1'),
      dirEntry('pasta_so_de_fotos'),
      dirEntry('cidade-torre'),
      dirEntry('map_empate_2'),
      dirEntry('map_ruim'),
      dirEntry('map_sem_mtime'),
    ])
    const existentes = new Set([
      MAPS_DIR,
      mapJson('map_velho'),
      mapJson('map_empate_1'),
      TORRE_ADVENTURE,
      ESGOTO,
      mapJson('map_empate_2'),
      mapJson('map_ruim'),
      mapJson('map_sem_mtime'),
    ])
    existsMock.mockImplementation(async (path: string) => existentes.has(path))
    const mtimes = new Map<string, Date | null>([
      [mapJson('map_velho'), VELHO],
      [mapJson('map_empate_1'), MAIO],
      [TORRE_ADVENTURE, SETEMBRO],
      [mapJson('map_empate_2'), MAIO],
      [mapJson('map_ruim'), MAIO],
      [mapJson('map_sem_mtime'), null],
    ])
    statMock.mockImplementation(async (path: string) => {
      const mtime = mtimes.get(path)
      return { mtime: mtime === undefined ? MTIME_PADRAO : mtime }
    })
    const conteudos = new Map<string, string>([
      [mapJson('map_velho'), mapaSalvo('map_velho', 'Velho')],
      [mapJson('map_empate_1'), mapaSalvo('map_empate_1', 'Empate 1')],
      [
        TORRE_ADVENTURE,
        JSON.stringify({
          version: 1,
          id: 'adv_torre',
          name: 'Cidade-Torre',
          startSceneId: 'scene_esgoto',
          scenes: [{ id: 'scene_esgoto', name: 'Esgoto', file: 'scenes/scene_esgoto/map.json' }],
        }),
      ],
      [ESGOTO, mapaSalvo('map_esgoto', 'Esgoto', 120, 80, 32)],
      [mapJson('map_empate_2'), mapaSalvo('map_empate_2', 'Empate 2')],
      [mapJson('map_ruim'), '{ isso não é json'],
      [mapJson('map_sem_mtime'), mapaSalvo('map_sem_mtime', 'Sem mtime')],
    ])
    // Quem vem antes no readDir demora mais para ler: em paralelo, as pastas
    // terminam na ordem INVERSA da do readDir.
    const demora = new Map<string, number>([
      [mapJson('map_velho'), 30],
      [mapJson('map_empate_1'), 24],
      [TORRE_ADVENTURE, 18],
      [ESGOTO, 1],
      [mapJson('map_empate_2'), 12],
      [mapJson('map_ruim'), 6],
      [mapJson('map_sem_mtime'), 0],
    ])
    readTextFileMock.mockImplementation(async (path: string) => {
      await new Promise((resolve) => setTimeout(resolve, demora.get(path) ?? 0))
      const conteudo = conteudos.get(path)
      if (conteudo === undefined) throw new Error(`leitura inesperada: ${path}`)
      return conteudo
    })

    const maps = await listSavedMaps()

    expect(maps).toEqual([
      { path: ESGOTO, id: 'cidade-torre', name: 'Cidade-Torre', width: 120, height: 80, grid: 32, mtimeMs: SETEMBRO.getTime() },
      { path: mapJson('map_empate_1'), id: 'map_empate_1', name: 'Empate 1', width: 30, height: 20, grid: 64, mtimeMs: MAIO.getTime() },
      { path: mapJson('map_empate_2'), id: 'map_empate_2', name: 'Empate 2', width: 30, height: 20, grid: 64, mtimeMs: MAIO.getTime() },
      {
        path: mapJson('map_ruim'),
        id: 'map_ruim',
        name: 'map_ruim (arquivo danificado)',
        width: 0,
        height: 0,
        grid: 0,
        mtimeMs: MAIO.getTime(),
        damaged: true,
      },
      { path: mapJson('map_velho'), id: 'map_velho', name: 'Velho', width: 30, height: 20, grid: 64, mtimeMs: VELHO.getTime() },
      { path: mapJson('map_sem_mtime'), id: 'map_sem_mtime', name: 'Sem mtime', width: 30, height: 20, grid: 64, mtimeMs: 0 },
    ])
    // Cada arquivo lido uma vez só, como em série: paralelo não é ler de novo.
    expect(readTextFileMock.mock.calls.map(([path]) => path).sort()).toEqual([...conteudos.keys()].sort())
    // A pasta só de fotos e o arquivo solto não viram leitura de mapa.
    expect(readTextFileMock).not.toHaveBeenCalledWith(mapJson('pasta_so_de_fotos'))
  })

  it('pasta que escapa da pasta de mapas derruba a listagem inteira, como em série', async () => {
    existsMock.mockImplementation(async (path: string) => path === MAPS_DIR)
    readDirMock.mockImplementation(async () => [dirEntry('map_bom'), dirEntry('..')])

    await expect(listSavedMaps()).rejects.toThrow('Caminho de mapa inválido')
    // As outras pastas seguem andando depois da recusa: deixa terminarem aqui,
    // e não nas chamadas do próximo teste.
    await proximaVolta()
  })
})
