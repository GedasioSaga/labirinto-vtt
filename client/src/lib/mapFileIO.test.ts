import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData } from '../types/map'

interface FakeDirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

interface FakeFileInfo {
  isFile: boolean
  isDirectory: boolean
  isSymlink: boolean
  size: number
  mtime: Date | null
  atime: Date | null
  birthtime: Date | null
  readonly: boolean
  fileAttributes: number | null
  dev: number | null
  ino: number | null
  mode: number | null
  nlink: number | null
  uid: number | null
  gid: number | null
  rdev: number | null
  blksize: number | null
  blocks: number | null
}

function fakeFileInfo(mtime: Date | null): FakeFileInfo {
  return {
    isFile: true,
    isDirectory: false,
    isSymlink: false,
    size: 0,
    mtime,
    atime: null,
    birthtime: null,
    readonly: false,
    fileAttributes: null,
    dev: null,
    ino: null,
    mode: null,
    nlink: null,
    uid: null,
    gid: null,
    rdev: null,
    blksize: null,
    blocks: null,
  }
}

// Tipado com `path: string` (em vez de sem parâmetro) porque os testes de
// `listSavedMaps`/`duplicateMap` precisam de `mockImplementation` que decide
// pelo caminho recebido — ex.: a pasta de mapas existe, mas um `map.json`
// específico não; ou o `readDir` da pasta-raiz de mapas devolve algo
// diferente do `readDir` da pasta de UM mapa (`copyDirRecursive`).
const writeTextFileMock = vi.fn(async (_path: string, _data: string) => undefined)
const mkdirMock = vi.fn(async () => undefined)
const existsMock = vi.fn(async (_path: string) => false)
const readTextFileMock = vi.fn(async (_path: string) => '')
const readDirMock = vi.fn(async (_path: string) => [] as FakeDirEntry[])
const statMock = vi.fn(async (_path: string) => fakeFileInfo(new Date('2026-01-01T00:00:00.000Z')))
const removeMock = vi.fn(async (_path: string) => undefined)
const copyFileMock = vi.fn(async (_from: string, _to: string) => undefined)
const saveMock = vi.fn(async () => null as string | null)
const openMock = vi.fn(async () => null as string | string[] | null)
const invokeMock = vi.fn(async () => undefined)

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock,
  mkdir: mkdirMock,
  exists: existsMock,
  readTextFile: readTextFileMock,
  readDir: readDirMock,
  stat: statMock,
  remove: removeMock,
  copyFile: copyFileMock,
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: saveMock,
  open: openMock,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:\\Users\\test\\AppData\\Roaming\\labirinto'),
  join: vi.fn(async (...parts: string[]) => parts.join('\\')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('\\'))),
}))

const {
  defaultMapsDir,
  mapDirFor,
  saveMapToAppData,
  pickMapJsonToOpen,
  pickExportDestination,
  loadMapFromDisk,
  assertPathWithinRoot,
  listSavedMaps,
  saveMapToPath,
  sanitizeMapName,
  uniqueMapName,
  renameMap,
  duplicateMap,
  deleteMap,
  openMapFileFirst,
} = await import('./mapFileIO')

function makeMap(overrides: Partial<MapData> = {}): MapData {
  return {
    id: 'map_1',
    name: 'Mapa de teste',
    width: 30,
    height: 20,
    grid: 64,
    gridShape: 'square',
    showGrid: true,
    gridSettings: { color: '#4a4a4a', opacity: 1, lineWidth: 1, lineStyle: 'solid' },
    background: { type: 'color', src: '#2b2b2b' },
    walls: [],
    lights: [],
    regions: [],
    tokens: [],
    props: [],
    stairs: [],
    drawings: [],
    floor: [],
    floorStyle: { fillColor: '#006b00', strokeColor: null, strokeWidth: 1 },
    lines: [],
    markers: [],
    concealZones: [],
    pins: [],
    frame: null,
    fog: { mode: 'none', revealed: [] },
    hiddenLayers: [],
    lockedLayers: [],
    scale: { unitsPerCell: 5, unit: 'ft', precision: 0 },
    measurementMode: 'chessboard',
    ownerId: null,
    scenarioLink: null,
    ...overrides,
  }
}

const MAPS_DIR = 'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps'

function dirEntry(name: string, isDirectory = true): FakeDirEntry {
  return { name, isDirectory, isFile: !isDirectory, isSymlink: false }
}

beforeEach(() => {
  vi.clearAllMocks()
  existsMock.mockResolvedValue(false)
  openMock.mockResolvedValue(null)
  saveMock.mockResolvedValue(null)
  readDirMock.mockResolvedValue([])
  statMock.mockResolvedValue(fakeFileInfo(new Date('2026-01-01T00:00:00.000Z')))
})

describe('defaultMapsDir', () => {
  it('junta o diretório de dados do app com "maps"', async () => {
    const dir = await defaultMapsDir()
    expect(dir).toBe('C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps')
  })
})

describe('mapDirFor', () => {
  it('junta o diretório de mapas com o id do mapa', async () => {
    const dir = await mapDirFor('map_1')
    expect(dir).toBe('C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps\\map_1')
  })

  it('usa ids diferentes para mapas diferentes', async () => {
    const dirA = await mapDirFor('map_a')
    const dirB = await mapDirFor('map_b')
    expect(dirA).not.toBe(dirB)
  })

  it('lança erro quando o id do mapa tenta escapar da pasta de mapas via ..', async () => {
    await expect(
      mapDirFor('..\\..\\..\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup'),
    ).rejects.toThrow('fora da pasta de mapas esperada')
  })
})

describe('assertPathWithinRoot', () => {
  it('não lança quando o caminho está dentro da raiz', () => {
    expect(() =>
      assertPathWithinRoot('C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps\\map_1', 'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps'),
    ).not.toThrow()
  })

  it('não lança quando o caminho é exatamente igual à raiz', () => {
    expect(() =>
      assertPathWithinRoot('C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps', 'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps'),
    ).not.toThrow()
  })

  it('lança quando o caminho usa .. para escapar da raiz', () => {
    expect(() =>
      assertPathWithinRoot(
        'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps\\..\\..\\..\\Windows\\System32',
        'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps',
      ),
    ).toThrow('fora da pasta de mapas esperada')
  })
})

describe('saveMapToAppData', () => {
  it('cria o diretório do mapa quando ele ainda não existe', async () => {
    existsMock.mockResolvedValue(false)
    const map = makeMap()

    await saveMapToAppData(map)

    expect(mkdirMock).toHaveBeenCalledWith(
      'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps\\map_1',
      { recursive: true },
    )
  })

  it('não cria o diretório quando ele já existe', async () => {
    existsMock.mockResolvedValue(true)
    const map = makeMap()

    await saveMapToAppData(map)

    expect(mkdirMock).not.toHaveBeenCalled()
  })

  it('escreve o map.json serializado no caminho esperado e retorna o caminho', async () => {
    existsMock.mockResolvedValue(true)
    const map = makeMap()

    const path = await saveMapToAppData(map)

    expect(path).toBe('C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps\\map_1\\map.json')
    expect(writeTextFileMock).toHaveBeenCalledWith(
      'C:\\Users\\test\\AppData\\Roaming\\labirinto\\maps\\map_1\\map.json',
      JSON.stringify(map, null, 2),
    )
  })
})

describe('pickMapJsonToOpen', () => {
  it('retorna o caminho selecionado quando o usuário escolhe um arquivo', async () => {
    openMock.mockResolvedValue('C:\\algum\\map.json')

    const path = await pickMapJsonToOpen()

    expect(path).toBe('C:\\algum\\map.json')
    expect(openMock).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: 'Mapa Labirinto', extensions: ['json'] }],
    })
  })

  it('retorna null quando o usuário cancela a seleção', async () => {
    openMock.mockResolvedValue(null)

    const path = await pickMapJsonToOpen()

    expect(path).toBeNull()
  })

  it('retorna null quando a seleção retorna um array (multiple desativado, defensivo)', async () => {
    openMock.mockResolvedValue(['C:\\a.json', 'C:\\b.json'])

    const path = await pickMapJsonToOpen()

    expect(path).toBeNull()
  })
})

describe('pickExportDestination', () => {
  it('retorna o caminho escolhido com o nome padrão sugerido', async () => {
    saveMock.mockResolvedValue('C:\\export\\meu-mapa.json')

    const path = await pickExportDestination('meu-mapa')

    expect(path).toBe('C:\\export\\meu-mapa.json')
    expect(saveMock).toHaveBeenCalledWith({ defaultPath: 'meu-mapa.json' })
  })

  it('retorna null quando o usuário cancela', async () => {
    saveMock.mockResolvedValue(null)

    const path = await pickExportDestination('meu-mapa')

    expect(path).toBeNull()
  })
})

describe('loadMapFromDisk', () => {
  it('concede acesso ao diretório do arquivo e lê/desserializa o map.json', async () => {
    const map = makeMap({ id: 'map_2', name: 'Carregado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))

    const result = await loadMapFromDisk('C:\\maps\\map_2\\map.json')

    expect(invokeMock).toHaveBeenCalledWith('grant_fs_access', { path: 'C:\\maps\\map_2' })
    expect(readTextFileMock).toHaveBeenCalledWith('C:\\maps\\map_2\\map.json')
    expect(result.id).toBe('map_2')
    expect(result.name).toBe('Carregado')
  })

  it('propaga o erro quando o map.json está malformado', async () => {
    readTextFileMock.mockResolvedValue('{ inválido')

    await expect(loadMapFromDisk('C:\\maps\\map_x\\map.json')).rejects.toThrow('map.json inválido')
  })
})

describe('listSavedMaps', () => {
  it('devolve lista vazia quando a pasta de mapas ainda não existe', async () => {
    existsMock.mockResolvedValue(false)

    const maps = await listSavedMaps()

    expect(maps).toEqual([])
    expect(readDirMock).not.toHaveBeenCalled()
  })

  it('lista os mapas cujos map.json existem, ignorando entrada que não é diretório', async () => {
    existsMock.mockImplementation(async (path: string) => path === MAPS_DIR || path === `${MAPS_DIR}\\map_1\\map.json`)
    readDirMock.mockResolvedValue([dirEntry('map_1'), dirEntry('leia-me.txt', false)])
    readTextFileMock.mockResolvedValue(JSON.stringify(makeMap({ id: 'map_1', name: 'Cripta', width: 20, height: 15, grid: 40 })))
    statMock.mockResolvedValue(fakeFileInfo(new Date('2026-01-01T00:00:00.000Z')))

    const maps = await listSavedMaps()

    expect(maps).toEqual([
      { path: `${MAPS_DIR}\\map_1\\map.json`, id: 'map_1', name: 'Cripta', width: 20, height: 15, grid: 40, mtimeMs: Date.parse('2026-01-01T00:00:00.000Z') },
    ])
    expect(readTextFileMock).toHaveBeenCalledTimes(1)
  })

  it('ordena por recência (mtime mais recente primeiro), não pela ordem crua do readDir', async () => {
    existsMock.mockImplementation(
      async (path: string) =>
        path === MAPS_DIR || path === `${MAPS_DIR}\\map_antigo\\map.json` || path === `${MAPS_DIR}\\map_novo\\map.json`,
    )
    // readDir devolve o mapa ANTIGO primeiro — se listSavedMaps não ordenasse,
    // o mapa antigo apareceria primeiro na lista.
    readDirMock.mockResolvedValue([dirEntry('map_antigo'), dirEntry('map_novo')])
    readTextFileMock.mockImplementation(async (path: string) => {
      if (path === `${MAPS_DIR}\\map_antigo\\map.json`) return JSON.stringify(makeMap({ id: 'map_antigo', name: 'Antigo' }))
      return JSON.stringify(makeMap({ id: 'map_novo', name: 'Novo' }))
    })
    statMock.mockImplementation(async (path: string) => {
      if (path === `${MAPS_DIR}\\map_antigo\\map.json`) return fakeFileInfo(new Date('2020-01-01T00:00:00.000Z'))
      return fakeFileInfo(new Date('2026-01-01T00:00:00.000Z'))
    })

    const maps = await listSavedMaps()

    expect(maps.map((m) => m.id)).toEqual(['map_novo', 'map_antigo'])
  })

  it('mapa sem mtime relatado pelo SO (mtime: null) cai pro fim da lista ordenada, sem quebrar', async () => {
    existsMock.mockImplementation(
      async (path: string) =>
        path === MAPS_DIR || path === `${MAPS_DIR}\\map_sem_mtime\\map.json` || path === `${MAPS_DIR}\\map_com_mtime\\map.json`,
    )
    readDirMock.mockResolvedValue([dirEntry('map_sem_mtime'), dirEntry('map_com_mtime')])
    readTextFileMock.mockImplementation(async (path: string) => {
      if (path === `${MAPS_DIR}\\map_sem_mtime\\map.json`) return JSON.stringify(makeMap({ id: 'map_sem_mtime', name: 'Sem mtime' }))
      return JSON.stringify(makeMap({ id: 'map_com_mtime', name: 'Com mtime' }))
    })
    statMock.mockImplementation(async (path: string) => {
      if (path === `${MAPS_DIR}\\map_sem_mtime\\map.json`) return fakeFileInfo(null)
      return fakeFileInfo(new Date('2020-01-01T00:00:00.000Z'))
    })

    const maps = await listSavedMaps()

    expect(maps.map((m) => m.id)).toEqual(['map_com_mtime', 'map_sem_mtime'])
    expect(maps.find((m) => m.id === 'map_sem_mtime')?.mtimeMs).toBe(0)
  })

  it('pula diretório cujo map.json não existe', async () => {
    existsMock.mockImplementation(async (path: string) => path === MAPS_DIR)
    readDirMock.mockResolvedValue([dirEntry('map_vazio')])

    const maps = await listSavedMaps()

    expect(maps).toEqual([])
    expect(readTextFileMock).not.toHaveBeenCalled()
  })

  it('map.json corrompido não derruba a lista inteira — a entrada aparece marcada como danificada', async () => {
    existsMock.mockImplementation(
      async (path: string) =>
        path === MAPS_DIR || path === `${MAPS_DIR}\\map_bom\\map.json` || path === `${MAPS_DIR}\\map_ruim\\map.json`,
    )
    readDirMock.mockResolvedValue([dirEntry('map_bom'), dirEntry('map_ruim')])
    readTextFileMock.mockImplementation(async (path: string) => {
      if (path === `${MAPS_DIR}\\map_ruim\\map.json`) return '{ isso não é json'
      return JSON.stringify(makeMap({ id: 'map_bom', name: 'Torre' }))
    })

    const maps = await listSavedMaps()

    // A entrada quebrada NÃO some da lista: sumir fazia o mapa parecer apagado
    // para quem abria a tela. Ela aparece por último, com o caminho e o nome
    // avisando, para a pessoa poder achar (ou apagar) o arquivo.
    expect(maps).toEqual([
      { path: `${MAPS_DIR}\\map_bom\\map.json`, id: 'map_bom', name: 'Torre', width: 30, height: 20, grid: 64, mtimeMs: Date.parse('2026-01-01T00:00:00.000Z') },
      {
        path: `${MAPS_DIR}\\map_ruim\\map.json`,
        id: 'map_ruim',
        name: 'map_ruim (arquivo danificado)',
        width: 0,
        height: 0,
        grid: 0,
        mtimeMs: Date.parse('2026-01-01T00:00:00.000Z'),
        damaged: true,
      },
    ])
  })

  describe('aventura sem map.json na raiz (como a cidade-torre gerada)', () => {
    const TORRE = `${MAPS_DIR}\\cidade-torre`
    const TORRE_ADVENTURE = `${TORRE}\\adventure.json`
    const ESGOTO = `${TORRE}\\scenes\\scene_esgoto\\map.json`
    const PICO = `${TORRE}\\scenes\\scene_pico\\map.json`
    const adventureJson = JSON.stringify({
      version: 1,
      id: 'adv_torre',
      name: 'Cidade-Torre',
      startSceneId: 'scene_esgoto',
      scenes: [
        { id: 'scene_pico', name: 'Pico', file: 'scenes/scene_pico/map.json' },
        { id: 'scene_esgoto', name: 'Esgoto', file: 'scenes/scene_esgoto/map.json' },
      ],
    })

    it('aparece na lista com o nome da aventura, abrindo pela cena inicial', async () => {
      existsMock.mockImplementation(async (path: string) => [MAPS_DIR, TORRE_ADVENTURE, ESGOTO, PICO].includes(path))
      readDirMock.mockResolvedValue([dirEntry('cidade-torre')])
      readTextFileMock.mockImplementation(async (path: string) => {
        if (path === TORRE_ADVENTURE) return adventureJson
        if (path === ESGOTO) return JSON.stringify(makeMap({ id: 'map_esgoto', name: 'Esgoto', width: 120, height: 80, grid: 32 }))
        return JSON.stringify(makeMap({ id: 'map_pico', name: 'Pico' }))
      })
      statMock.mockResolvedValue(fakeFileInfo(new Date('2026-09-22T09:00:00.000Z')))

      const maps = await listSavedMaps()

      // `id` é o nome da pasta: é o que `mapDirFor` resolve de volta para a
      // pasta da aventura (Excluir apaga a aventura inteira, não uma cena).
      expect(maps).toEqual([
        { path: ESGOTO, id: 'cidade-torre', name: 'Cidade-Torre', width: 120, height: 80, grid: 32, mtimeMs: Date.parse('2026-09-22T09:00:00.000Z') },
      ])
    })

    it('o caminho listado abre como a aventura inteira, na cena inicial', async () => {
      existsMock.mockImplementation(async (path: string) => [MAPS_DIR, TORRE_ADVENTURE, ESGOTO, PICO].includes(path))
      readDirMock.mockResolvedValue([dirEntry('cidade-torre')])
      readTextFileMock.mockImplementation(async (path: string) => {
        if (path === TORRE_ADVENTURE) return adventureJson
        if (path === ESGOTO) return JSON.stringify(makeMap({ id: 'map_esgoto', name: 'Esgoto' }))
        return JSON.stringify(makeMap({ id: 'map_pico', name: 'Pico' }))
      })

      const [entrada] = await listSavedMaps()
      expect(entrada).toBeDefined()
      const aberto = await openMapFileFirst(entrada.path)

      expect(aberto.adventureDir).toBe(TORRE)
      expect(aberto.activeSceneId).toBe('scene_esgoto')
      expect(aberto.map.id).toBe('map_esgoto')
      expect(aberto.scenes.map((load) => load.entry.id)).toEqual(['scene_pico', 'scene_esgoto'])
    })

    it('adventure.json mínimo (sem nome, sem startSceneId) entra pela primeira cena, com o nome dela', async () => {
      const minimo = JSON.stringify({ scenes: [{ id: 'scene_pico', name: 'Pico', file: 'scenes/scene_pico/map.json' }] })
      existsMock.mockImplementation(async (path: string) => [MAPS_DIR, TORRE_ADVENTURE, PICO].includes(path))
      readDirMock.mockResolvedValue([dirEntry('cidade-torre')])
      readTextFileMock.mockImplementation(async (path: string) => {
        if (path === TORRE_ADVENTURE) return minimo
        return JSON.stringify(makeMap({ id: 'map_pico', name: 'Pico', width: 10, height: 8, grid: 50 }))
      })
      statMock.mockResolvedValue(fakeFileInfo(null))

      const maps = await listSavedMaps()

      expect(maps).toEqual([{ path: PICO, id: 'cidade-torre', name: 'Pico', width: 10, height: 8, grid: 50, mtimeMs: 0 }])
    })

    it('adventure.json corrompido entra marcado como danificado, com o caminho dele', async () => {
      existsMock.mockImplementation(async (path: string) => path === MAPS_DIR || path === TORRE_ADVENTURE)
      readDirMock.mockResolvedValue([dirEntry('cidade-torre')])
      readTextFileMock.mockResolvedValue('{ isso não é json')

      const maps = await listSavedMaps()

      expect(maps).toEqual([
        {
          path: TORRE_ADVENTURE,
          id: 'cidade-torre',
          name: 'cidade-torre (arquivo danificado)',
          width: 0,
          height: 0,
          grid: 0,
          mtimeMs: Date.parse('2026-01-01T00:00:00.000Z'),
          damaged: true,
        },
      ])
    })

    it('cena inicial ausente no disco entra marcada como danificada, sem derrubar a lista', async () => {
      existsMock.mockImplementation(async (path: string) => [MAPS_DIR, TORRE_ADVENTURE, `${MAPS_DIR}\\map_bom\\map.json`].includes(path))
      readDirMock.mockResolvedValue([dirEntry('map_bom'), dirEntry('cidade-torre')])
      readTextFileMock.mockImplementation(async (path: string) => {
        if (path === TORRE_ADVENTURE) return adventureJson
        return JSON.stringify(makeMap({ id: 'map_bom', name: 'Torre' }))
      })

      const maps = await listSavedMaps()

      expect(maps.map((m) => [m.id, m.damaged ?? false])).toEqual([
        ['map_bom', false],
        ['cidade-torre', true],
      ])
      expect(maps[1].path).toBe(TORRE_ADVENTURE)
    })

    it('cena inicial com caminho fora da pasta da aventura não é lida: entra danificada', async () => {
      existsMock.mockImplementation(async (path: string) => path === MAPS_DIR || path === TORRE_ADVENTURE)
      readDirMock.mockResolvedValue([dirEntry('cidade-torre')])
      readTextFileMock.mockImplementation(async (path: string) => {
        if (path === TORRE_ADVENTURE) {
          return JSON.stringify({ version: 1, id: 'adv_x', name: 'X', startSceneId: 's1', scenes: [{ id: 's1', name: 'S', file: '../outra/map.json' }] })
        }
        throw new Error(`leitura inesperada: ${path}`)
      })

      const maps = await listSavedMaps()

      expect(maps).toHaveLength(1)
      expect(maps[0].damaged).toBe(true)
      expect(readTextFileMock).toHaveBeenCalledTimes(1)
    })
  })
})

describe('saveMapToPath', () => {
  it('escreve o map.json serializado direto no caminho recebido, sem passar por mapDirFor', async () => {
    const map = makeMap({ id: 'map_externo' })

    await saveMapToPath(map, 'C:\\Dev\\labirinto\\maps\\L1.json')

    expect(writeTextFileMock).toHaveBeenCalledWith('C:\\Dev\\labirinto\\maps\\L1.json', JSON.stringify(map, null, 2))
    expect(mkdirMock).not.toHaveBeenCalled()
  })
})

describe('sanitizeMapName', () => {
  it('mantém um nome válido inalterado', () => {
    expect(sanitizeMapName('Cripta Esquecida')).toBe('Cripta Esquecida')
  })

  it('remove todos os caracteres proibidos em nome de arquivo no Windows', () => {
    expect(sanitizeMapName('a<b>c:d"e/f\\g|h?i*j')).toBe('abcdefghij')
  })

  it('remove caractere de controle', () => {
    // String.fromCharCode em vez de um literal de escape — ver o comentário
    // de stripControlChars em mapFileIO.ts sobre por que esta função não usa
    // classe de regex com faixa de escape unicode.
    const withControlChar = `Mapa${String.fromCharCode(1)}Ruim`
    expect(sanitizeMapName(withControlChar)).toBe('MapaRuim')
  })

  it('remove ponto e espaço à direita', () => {
    expect(sanitizeMapName('Cripta...   ')).toBe('Cripta')
  })

  it('nome vazio ou só espaço vira "Mapa sem título"', () => {
    expect(sanitizeMapName('   ')).toBe('Mapa sem título')
    expect(sanitizeMapName('')).toBe('Mapa sem título')
  })

  it('nome que fica vazio depois de remover só caractere proibido também vira "Mapa sem título"', () => {
    expect(sanitizeMapName('///')).toBe('Mapa sem título')
  })
})

describe('uniqueMapName', () => {
  it('devolve baseName sem alteração quando não colide com nada', () => {
    expect(uniqueMapName('Cripta', ['Torre', 'Masmorra'])).toBe('Cripta')
  })

  it('anexa " (2)" quando baseName já existe', () => {
    expect(uniqueMapName('Cripta', ['Cripta'])).toBe('Cripta (2)')
  })

  it('incrementa até achar um número livre', () => {
    expect(uniqueMapName('Cripta', ['Cripta', 'Cripta (2)', 'Cripta (3)'])).toBe('Cripta (4)')
  })
})

describe('renameMap', () => {
  const MAP_JSON_PATH = `${MAPS_DIR}\\map_1\\map.json`

  beforeEach(() => {
    existsMock.mockImplementation(async (path: string) => path === MAPS_DIR || path === MAP_JSON_PATH)
    readTextFileMock.mockImplementation(async (path: string) => {
      if (path === MAP_JSON_PATH) return JSON.stringify(makeMap({ id: 'map_1', name: 'Cripta' }))
      return ''
    })
    readDirMock.mockResolvedValue([dirEntry('map_1')])
  })

  it('reescreve só o campo name no mesmo caminho e devolve o nome final', async () => {
    const finalName = await renameMap('map_1', 'Torre Negra')

    expect(finalName).toBe('Torre Negra')
    expect(writeTextFileMock).toHaveBeenCalledTimes(1)
    const [writtenPath, writtenBody] = writeTextFileMock.mock.calls[0] as [string, string]
    expect(writtenPath).toBe(MAP_JSON_PATH)
    const written = JSON.parse(writtenBody) as MapData
    expect(written.id).toBe('map_1')
    expect(written.name).toBe('Torre Negra')
    expect(written.width).toBe(30) // resto do mapa preservado
  })

  it('sanitiza caractere inválido em nome de arquivo no Windows', async () => {
    const finalName = await renameMap('map_1', 'Cripta: a "boa"?')

    expect(finalName).toBe('Cripta a boa')
  })

  it('desambigua contra o nome de OUTRO mapa existente', async () => {
    existsMock.mockImplementation(
      async (path: string) => path === MAPS_DIR || path === MAP_JSON_PATH || path === `${MAPS_DIR}\\map_2\\map.json`,
    )
    readDirMock.mockResolvedValue([dirEntry('map_1'), dirEntry('map_2')])
    readTextFileMock.mockImplementation(async (path: string) => {
      if (path === MAP_JSON_PATH) return JSON.stringify(makeMap({ id: 'map_1', name: 'Cripta' }))
      if (path === `${MAPS_DIR}\\map_2\\map.json`) return JSON.stringify(makeMap({ id: 'map_2', name: 'Torre' }))
      return ''
    })

    const finalName = await renameMap('map_1', 'Torre')

    expect(finalName).toBe('Torre (2)')
  })

  it('renomear para o PRÓPRIO nome atual não gera sufixo (não compara contra si mesmo)', async () => {
    const finalName = await renameMap('map_1', 'Cripta')
    expect(finalName).toBe('Cripta')
  })

  it('lança quando o mapa não existe', async () => {
    existsMock.mockResolvedValue(false)
    await expect(renameMap('map_fantasma', 'Novo nome')).rejects.toThrow('não encontrado')
    expect(writeTextFileMock).not.toHaveBeenCalled()
  })
})

describe('duplicateMap', () => {
  const SOURCE_ID = 'map_src'
  const SOURCE_DIR = `${MAPS_DIR}\\${SOURCE_ID}`
  const SOURCE_MAP_JSON = `${SOURCE_DIR}\\map.json`

  beforeEach(() => {
    existsMock.mockImplementation(async (path: string) => path === MAPS_DIR || path === SOURCE_MAP_JSON)
    readTextFileMock.mockImplementation(async (path: string) => {
      if (path === SOURCE_MAP_JSON) {
        return JSON.stringify(
          makeMap({
            id: SOURCE_ID,
            name: 'Cripta',
            tokens: [{ id: 't1', characterId: null, name: 'Goblin', x: 1, y: 2, size: 1, image: 'C:\\imgs\\goblin.png' }],
          }),
        )
      }
      return ''
    })
    readDirMock.mockImplementation(async (path: string) => {
      if (path === SOURCE_DIR) return [dirEntry('map.json', false)]
      if (path === MAPS_DIR) return [dirEntry(SOURCE_ID)]
      return []
    })
  })

  it('copia a pasta inteira (readDir + copyFile) para um id novo', async () => {
    const result = await duplicateMap(SOURCE_ID)

    expect(result.id).not.toBe(SOURCE_ID)
    expect(result.id.startsWith('map_')).toBe(true)
    const destDir = `${MAPS_DIR}\\${result.id}`
    expect(copyFileMock).toHaveBeenCalledWith(`${SOURCE_DIR}\\map.json`, `${destDir}\\map.json`)
    expect(result.path).toBe(`${destDir}\\map.json`)
  })

  it('nome final é "<original> (cópia)" e o map.json da cópia é reescrito com id e name novos', async () => {
    const result = await duplicateMap(SOURCE_ID)

    expect(result.name).toBe('Cripta (cópia)')
    // writeTextFile é chamado depois de copyDirRecursive — a cópia crua (com
    // o id antigo) é sobrescrita com o id/nome corretos.
    const lastCall = writeTextFileMock.mock.calls.at(-1) as [string, string]
    expect(lastCall[0]).toBe(result.path)
    const written = JSON.parse(lastCall[1]) as MapData
    expect(written.id).toBe(result.id)
    expect(written.name).toBe('Cripta (cópia)')
  })

  it('não quebra a referência de imagem: caminho absoluto do token continua o mesmo na cópia', async () => {
    await duplicateMap(SOURCE_ID)

    const lastCall = writeTextFileMock.mock.calls.at(-1) as [string, string]
    const written = JSON.parse(lastCall[1]) as MapData
    expect(written.tokens[0]?.image).toBe('C:\\imgs\\goblin.png')
  })

  it('desambigua contra um nome "<original> (cópia)" que já existe entre os mapas salvos', async () => {
    const OTHER_ID = 'map_other'
    existsMock.mockImplementation(
      async (path: string) => path === MAPS_DIR || path === SOURCE_MAP_JSON || path === `${MAPS_DIR}\\${OTHER_ID}\\map.json`,
    )
    readDirMock.mockImplementation(async (path: string) => {
      if (path === SOURCE_DIR) return [dirEntry('map.json', false)]
      if (path === MAPS_DIR) return [dirEntry(SOURCE_ID), dirEntry(OTHER_ID)]
      return []
    })
    readTextFileMock.mockImplementation(async (path: string) => {
      if (path === SOURCE_MAP_JSON) return JSON.stringify(makeMap({ id: SOURCE_ID, name: 'Cripta' }))
      if (path === `${MAPS_DIR}\\${OTHER_ID}\\map.json`) return JSON.stringify(makeMap({ id: OTHER_ID, name: 'Cripta (cópia)' }))
      return ''
    })

    const result = await duplicateMap(SOURCE_ID)

    expect(result.name).toBe('Cripta (cópia) (2)')
  })

  it('lança quando o mapa de origem não existe', async () => {
    existsMock.mockResolvedValue(false)
    await expect(duplicateMap('map_fantasma')).rejects.toThrow('não encontrado')
    expect(copyFileMock).not.toHaveBeenCalled()
  })
})

describe('deleteMap', () => {
  const MAP_DIR = `${MAPS_DIR}\\map_1`

  it('remove a pasta do mapa, recursivo', async () => {
    existsMock.mockImplementation(async (path: string) => path === MAP_DIR)

    await deleteMap('map_1')

    expect(removeMock).toHaveBeenCalledWith(MAP_DIR, { recursive: true })
  })

  it('lança quando o mapa não existe, e não chama remove', async () => {
    existsMock.mockResolvedValue(false)

    await expect(deleteMap('map_fantasma')).rejects.toThrow('não encontrado')
    expect(removeMock).not.toHaveBeenCalled()
  })
})
