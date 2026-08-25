import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData } from '../types/map'

const writeTextFileMock = vi.fn(async () => undefined)
const mkdirMock = vi.fn(async () => undefined)
const existsMock = vi.fn(async () => false)
const readTextFileMock = vi.fn(async () => '')
const saveMock = vi.fn(async () => null as string | null)
const openMock = vi.fn(async () => null as string | string[] | null)
const invokeMock = vi.fn(async () => undefined)

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock,
  mkdir: mkdirMock,
  exists: existsMock,
  readTextFile: readTextFileMock,
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
} = await import('./mapFileIO')

function makeMap(overrides: Partial<MapData> = {}): MapData {
  return {
    id: 'map_1',
    name: 'Mapa de teste',
    width: 30,
    height: 20,
    grid: 64,
    showGrid: true,
    background: { type: 'color', src: '#2b2b2b' },
    walls: [],
    lights: [],
    regions: [],
    tokens: [],
    fog: { mode: 'none', revealed: [] },
    ownerId: null,
    scenarioLink: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  existsMock.mockResolvedValue(false)
  openMock.mockResolvedValue(null)
  saveMock.mockResolvedValue(null)
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
