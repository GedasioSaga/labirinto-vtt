import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData } from '../types/map'

const openMock = vi.fn(async () => null as string | string[] | null)
const invokeMock = vi.fn(async () => undefined)
const copyFileMock = vi.fn(async () => undefined)
const mkdirMock = vi.fn(async () => undefined)
const existsMock = vi.fn(async () => false)
const readDirMock = vi.fn(async () => [] as { name?: string }[])
const writeTextFileMock = vi.fn(async () => undefined)
const readTextFileMock = vi.fn(async () => '')

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: copyFileMock,
  mkdir: mkdirMock,
  exists: existsMock,
  readDir: readDirMock,
  writeTextFile: writeTextFileMock,
  readTextFile: readTextFileMock,
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(async (...parts: string[]) => parts.join('\\')),
}))

const { pickExportFolder, pickImportFolder, exportMapFolder, importMapFolder } = await import('./mapExport')

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

beforeEach(() => {
  vi.clearAllMocks()
  openMock.mockResolvedValue(null)
  existsMock.mockResolvedValue(false)
  readDirMock.mockResolvedValue([])
})

describe('pickExportFolder', () => {
  it('retorna o caminho selecionado quando o usuário escolhe uma pasta', async () => {
    openMock.mockResolvedValue('C:\\destino')

    const path = await pickExportFolder()

    expect(path).toBe('C:\\destino')
    expect(openMock).toHaveBeenCalledWith({ directory: true, multiple: false, title: 'Escolher pasta de destino' })
  })

  it('retorna null quando o usuário cancela a seleção', async () => {
    openMock.mockResolvedValue(null)

    const path = await pickExportFolder()

    expect(path).toBeNull()
  })

  it('retorna null quando a seleção retorna um array (multiple desativado, defensivo)', async () => {
    openMock.mockResolvedValue(['C:\\a', 'C:\\b'])

    const path = await pickExportFolder()

    expect(path).toBeNull()
  })
})

describe('pickImportFolder', () => {
  it('retorna o caminho selecionado quando o usuário escolhe uma pasta', async () => {
    openMock.mockResolvedValue('C:\\origem')

    const path = await pickImportFolder()

    expect(path).toBe('C:\\origem')
    expect(openMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: 'Escolher pasta do mapa a importar',
    })
  })

  it('retorna null quando o usuário cancela a seleção', async () => {
    openMock.mockResolvedValue(null)

    const path = await pickImportFolder()

    expect(path).toBeNull()
  })
})

describe('exportMapFolder', () => {
  it('concede acesso ao diretório de destino e ao diretório de origem do mapa', async () => {
    const map = makeMap()

    await exportMapFolder(map, 'C:\\maps\\map_1', 'C:\\destino')

    expect(invokeMock).toHaveBeenCalledWith('grant_fs_access', { path: 'C:\\destino' })
    expect(invokeMock).toHaveBeenCalledWith('grant_fs_access', { path: 'C:\\maps\\map_1' })
  })

  it('cria o diretório de destino quando ele ainda não existe', async () => {
    existsMock.mockResolvedValue(false)
    const map = makeMap()

    await exportMapFolder(map, 'C:\\maps\\map_1', 'C:\\destino')

    expect(mkdirMock).toHaveBeenCalledWith('C:\\destino', { recursive: true })
  })

  it('não cria o diretório de destino quando ele já existe', async () => {
    existsMock.mockResolvedValue(true)
    const map = makeMap()

    await exportMapFolder(map, 'C:\\maps\\map_1', 'C:\\destino')

    expect(mkdirMock).not.toHaveBeenCalled()
  })

  it('escreve o map.json serializado no destino', async () => {
    const map = makeMap()

    await exportMapFolder(map, 'C:\\maps\\map_1', 'C:\\destino')

    expect(writeTextFileMock).toHaveBeenCalledWith('C:\\destino\\map.json', JSON.stringify(map, null, 2))
  })

  it('quando o diretório de origem do mapa não existe, não tenta listar nem copiar arquivos', async () => {
    existsMock.mockResolvedValue(false)
    const map = makeMap()

    await exportMapFolder(map, 'C:\\maps\\map_inexistente', 'C:\\destino')

    expect(readDirMock).not.toHaveBeenCalled()
    expect(copyFileMock).not.toHaveBeenCalled()
  })

  it('copia as entradas do diretório de origem, exceto o próprio map.json', async () => {
    existsMock.mockResolvedValue(true)
    readDirMock.mockResolvedValue([{ name: 'map.json' }, { name: 'background.webp' }, { name: 'background_original.png' }])
    const map = makeMap()

    await exportMapFolder(map, 'C:\\maps\\map_1', 'C:\\destino')

    expect(copyFileMock).toHaveBeenCalledTimes(2)
    expect(copyFileMock).toHaveBeenCalledWith('C:\\maps\\map_1\\background.webp', 'C:\\destino\\background.webp')
    expect(copyFileMock).toHaveBeenCalledWith(
      'C:\\maps\\map_1\\background_original.png',
      'C:\\destino\\background_original.png',
    )
  })

  it('ignora entradas sem nome', async () => {
    existsMock.mockResolvedValue(true)
    readDirMock.mockResolvedValue([{ name: undefined }, { name: 'background.webp' }])
    const map = makeMap()

    await exportMapFolder(map, 'C:\\maps\\map_1', 'C:\\destino')

    expect(copyFileMock).toHaveBeenCalledTimes(1)
    expect(copyFileMock).toHaveBeenCalledWith('C:\\maps\\map_1\\background.webp', 'C:\\destino\\background.webp')
  })
})

describe('importMapFolder', () => {
  it('concede acesso ao diretório de origem', async () => {
    const map = makeMap({ id: 'map_importado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))

    await importMapFolder('C:\\origem', 'C:\\appdata\\maps')

    expect(invokeMock).toHaveBeenCalledWith('grant_fs_access', { path: 'C:\\origem' })
  })

  it('lê e desserializa o map.json da pasta de origem', async () => {
    const map = makeMap({ id: 'map_importado', name: 'Importado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))

    await importMapFolder('C:\\origem', 'C:\\appdata\\maps')

    expect(readTextFileMock).toHaveBeenCalledWith('C:\\origem\\map.json')
  })

  it('resolve o diretório de destino a partir do id do mapa lido', async () => {
    const map = makeMap({ id: 'map_importado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))

    const returnedId = await importMapFolder('C:\\origem', 'C:\\appdata\\maps')

    expect(returnedId).toBe('map_importado')
    expect(invokeMock).toHaveBeenCalledWith('grant_fs_access', { path: 'C:\\appdata\\maps\\map_importado' })
  })

  it('cria o diretório de destino quando ele ainda não existe', async () => {
    existsMock.mockResolvedValue(false)
    const map = makeMap({ id: 'map_importado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))

    await importMapFolder('C:\\origem', 'C:\\appdata\\maps')

    expect(mkdirMock).toHaveBeenCalledWith('C:\\appdata\\maps\\map_importado', { recursive: true })
  })

  it('não cria o diretório de destino quando ele já existe', async () => {
    existsMock.mockResolvedValue(true)
    const map = makeMap({ id: 'map_importado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))

    await importMapFolder('C:\\origem', 'C:\\appdata\\maps')

    expect(mkdirMock).not.toHaveBeenCalled()
  })

  it('copia todas as entradas da pasta de origem (incluindo map.json) para o destino', async () => {
    const map = makeMap({ id: 'map_importado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))
    readDirMock.mockResolvedValue([{ name: 'map.json' }, { name: 'background.webp' }])

    await importMapFolder('C:\\origem', 'C:\\appdata\\maps')

    expect(copyFileMock).toHaveBeenCalledTimes(2)
    expect(copyFileMock).toHaveBeenCalledWith('C:\\origem\\map.json', 'C:\\appdata\\maps\\map_importado\\map.json')
    expect(copyFileMock).toHaveBeenCalledWith(
      'C:\\origem\\background.webp',
      'C:\\appdata\\maps\\map_importado\\background.webp',
    )
  })

  it('ignora entradas sem nome ao copiar', async () => {
    const map = makeMap({ id: 'map_importado' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))
    readDirMock.mockResolvedValue([{ name: undefined }, { name: 'map.json' }])

    await importMapFolder('C:\\origem', 'C:\\appdata\\maps')

    expect(copyFileMock).toHaveBeenCalledTimes(1)
  })

  it('propaga o erro quando o map.json de origem está malformado', async () => {
    readTextFileMock.mockResolvedValue('{ inválido')

    await expect(importMapFolder('C:\\origem', 'C:\\appdata\\maps')).rejects.toThrow('map.json inválido')
  })

  it('lança erro e não toca no disco quando o id do map.json tenta escapar da pasta de mapas via ..', async () => {
    const map = makeMap({ id: '..\\..\\..\\Windows\\System32' })
    readTextFileMock.mockResolvedValue(JSON.stringify(map))

    await expect(importMapFolder('C:\\origem', 'C:\\appdata\\maps')).rejects.toThrow(
      'fora da pasta de mapas esperada',
    )

    expect(mkdirMock).not.toHaveBeenCalled()
    expect(copyFileMock).not.toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalledWith(
      'grant_fs_access',
      expect.objectContaining({ path: expect.stringContaining('System32') }),
    )
  })
})
