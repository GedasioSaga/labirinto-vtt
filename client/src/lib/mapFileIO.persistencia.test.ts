/**
 * Perdas de trabalho no disco (`lib/mapFileIO.ts` + `lib/mapExport.ts`).
 *
 * Três buracos medidos, todos VERMELHOS ao escrever este arquivo:
 *
 *  1. Gravação NÃO atômica (mapFileIO.ts:60, :218, :273, :307):
 *     `writeTextFile` trunca o arquivo e só então escreve. Se a escrita falha
 *     no meio (disco cheio, app morto, pendrive removido), o `map.json` que
 *     estava salvo e válido vira um pedaço de JSON — o mapa antigo morre
 *     junto com a tentativa de salvar o novo. O disco de mentira daqui imita
 *     essa semântica: escrita que falha deixa conteúdo PARCIAL no caminho.
 *
 *  2. Cópia/exportação leva as imagens mas não os caminhos
 *     (mapFileIO.ts:271 `duplicateMap`, mapExport.ts:25 e :43): o `map.json`
 *     da cópia continua apontando para a pasta de ORIGEM. Na mesma máquina
 *     ninguém percebe; na outra, o mapa exportado abre sem fundo e sem token.
 *
 *  3. `listSavedMaps` (mapFileIO.ts:126) engole o mapa danificado com
 *     `catch { continue }`. Para o usuário, "meu `map.json` corrompeu" e "meu
 *     mapa foi apagado" são a MESMA tela — e ele não tem nem o caminho para
 *     tentar recuperar o arquivo.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData } from '../types/map'
import type { SavedMapEntry } from './mapFileIO'

/** Contrato pedido para o item 3: a entrada ruim continua na lista, marcada. */
type EntradaListada = SavedMapEntry & { damaged?: boolean }

interface FakeDirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

const arquivos = new Map<string, string>()
const pastas = new Set<string>()
/** Quando ligada, a PRÓXIMA escrita de texto falha no meio (item 1). */
let falharProximaEscrita = false

function fakeFileInfo() {
  return {
    isFile: true,
    isDirectory: false,
    isSymlink: false,
    size: 0,
    mtime: new Date('2026-01-01T00:00:00.000Z'),
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

const writeTextFileMock = vi.fn(async (path: string, data: string) => {
  if (falharProximaEscrita) {
    falharProximaEscrita = false
    // Semântica real de `writeTextFile`: trunca primeiro, escreve depois.
    // Falhar no meio deixa o pedaço, não o conteúdo anterior.
    arquivos.set(path, data.slice(0, Math.max(1, Math.floor(data.length / 3))))
    throw new Error('escrita interrompida: disco cheio (simulado)')
  }
  arquivos.set(path, data)
})

/** Só existe para o conserto: gravar em `.tmp` e renomear por cima. */
const renameMock = vi.fn(async (from: string, to: string) => {
  const conteudo = arquivos.get(from)
  if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
  arquivos.set(to, conteudo)
  arquivos.delete(from)
})

const mkdirMock = vi.fn(async (path: string) => {
  pastas.add(path)
})
const existsMock = vi.fn(async (path: string) => arquivos.has(path) || pastas.has(path))
const readTextFileMock = vi.fn(async (path: string) => {
  const conteudo = arquivos.get(path)
  if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
  return conteudo
})
const readDirMock = vi.fn(async (dir: string) => {
  const filhos = new Map<string, FakeDirEntry>()
  const registrar = (caminho: string, ehArquivo: boolean) => {
    if (!caminho.startsWith(`${dir}/`)) return
    const resto = caminho.slice(dir.length + 1)
    const [primeiro, ...profundidade] = resto.split('/')
    const ehPasta = profundidade.length > 0 || !ehArquivo
    filhos.set(primeiro, { name: primeiro, isDirectory: ehPasta, isFile: !ehPasta, isSymlink: false })
  }
  for (const caminho of arquivos.keys()) registrar(caminho, true)
  for (const caminho of pastas) registrar(caminho, false)
  return [...filhos.values()]
})
const statMock = vi.fn(async (_path: string) => fakeFileInfo())
const removeMock = vi.fn(async (path: string) => {
  arquivos.delete(path)
  pastas.delete(path)
})
const copyFileMock = vi.fn(async (from: string, to: string) => {
  const conteudo = arquivos.get(from)
  if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
  arquivos.set(to, conteudo)
})

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock,
  rename: renameMock,
  mkdir: mkdirMock,
  exists: existsMock,
  readTextFile: readTextFileMock,
  readDir: readDirMock,
  stat: statMock,
  remove: removeMock,
  copyFile: copyFileMock,
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(async () => null),
  open: vi.fn(async () => null),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/Users/test/AppData/Roaming/labirinto'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { saveMapToAppData, saveMapToPath, renameMap, duplicateMap, listSavedMaps } = await import('./mapFileIO')
const { exportMapFolder } = await import('./mapExport')
const { deserializeMap, serializeMap } = await import('./mapFile')

const MAPS_DIR = 'C:/Users/test/AppData/Roaming/labirinto/maps'

function makeMap(overrides: Partial<MapData> = {}): MapData {
  return {
    id: 'map_origem',
    name: 'Cripta',
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

/** Mapa com as três formas de imagem que moram na pasta do mapa. */
function mapaComImagens(pastaDoMapa: string): MapData {
  return makeMap({
    background: { type: 'image', src: `${pastaDoMapa}/fundo.png` },
    tokens: [
      { id: 't1', characterId: null, name: 'Herói', x: 64, y: 64, size: 1, image: `${pastaDoMapa}/heroi.png` },
    ],
    props: [
      { id: 'p1', src: `${pastaDoMapa}/mesa.png`, x: 128, y: 128, width: 64, height: 64, linkedMapPath: null },
    ],
  })
}

function caminhosDeImagem(map: MapData): string[] {
  const caminhos = [
    map.background.type === 'image' ? map.background.src : null,
    ...map.tokens.map((token) => token.image),
    ...map.props.map((prop) => prop.src),
  ]
  return caminhos.filter((caminho): caminho is string => typeof caminho === 'string' && caminho.length > 0)
}

/** Serve se for relativo (portátil) ou se já apontar para a pasta de destino. */
function apontaParaODestino(caminho: string, pastaDestino: string): boolean {
  const ehAbsoluto = /^[a-zA-Z]:[\\/]/.test(caminho) || caminho.startsWith('/') || caminho.startsWith('\\\\')
  return !ehAbsoluto || caminho.replace(/\\/g, '/').startsWith(`${pastaDestino}/`)
}

beforeEach(() => {
  vi.clearAllMocks()
  arquivos.clear()
  pastas.clear()
  falharProximaEscrita = false
  pastas.add(MAPS_DIR)
})

describe('gravação não pode destruir o que já estava salvo', () => {
  it('salvar de novo e falhar no meio deixa o map.json anterior intacto e legível', async () => {
    const salvo = makeMap({ name: 'Cripta salva' })
    await saveMapToAppData(salvo)
    const caminho = `${MAPS_DIR}/map_origem/map.json`
    expect(arquivos.has(caminho)).toBe(true)

    falharProximaEscrita = true
    await expect(saveMapToAppData({ ...salvo, name: 'Cripta com mais uma sala' })).rejects.toThrow()

    const noDisco = arquivos.get(caminho) ?? ''
    expect(() => deserializeMap(noDisco), `map.json no disco: ${noDisco.slice(0, 80)}`).not.toThrow()
    expect(deserializeMap(noDisco).name).toBe('Cripta salva')
  })

  it('saveMapToPath que falha no meio não deixa o arquivo escolhido pelo usuário truncado', async () => {
    const caminho = 'D:/campanhas/cripta.json'
    const salvo = makeMap({ name: 'Cripta salva' })
    await saveMapToPath(salvo, caminho)

    falharProximaEscrita = true
    await expect(saveMapToPath({ ...salvo, name: 'Cripta v2' }, caminho)).rejects.toThrow()

    const noDisco = arquivos.get(caminho) ?? ''
    expect(() => deserializeMap(noDisco), `arquivo no disco: ${noDisco.slice(0, 80)}`).not.toThrow()
    expect(deserializeMap(noDisco).name).toBe('Cripta salva')
  })

  it('renomear e falhar no meio não pode apagar o mapa inteiro para trocar uma palavra', async () => {
    const salvo = makeMap({ name: 'Cripta salva' })
    await saveMapToAppData(salvo)
    const caminho = `${MAPS_DIR}/map_origem/map.json`

    falharProximaEscrita = true
    await expect(renameMap('map_origem', 'Cripta do Rei')).rejects.toThrow()

    const noDisco = arquivos.get(caminho) ?? ''
    expect(() => deserializeMap(noDisco), `map.json no disco: ${noDisco.slice(0, 80)}`).not.toThrow()
    expect(deserializeMap(noDisco).name).toBe('Cripta salva')
  })
})

describe('cópia e exportação levam os caminhos de imagem junto', () => {
  it('duplicateMap grava caminhos que apontam para a pasta da CÓPIA, não para a do original', async () => {
    const origem = `${MAPS_DIR}/map_origem`
    await saveMapToAppData(mapaComImagens(origem))
    for (const imagem of ['fundo.png', 'heroi.png', 'mesa.png']) arquivos.set(`${origem}/${imagem}`, 'PNG')

    const copia = await duplicateMap('map_origem')

    const mapaCopiado = deserializeMap(arquivos.get(copia.path) ?? '')
    const pastaDaCopia = `${MAPS_DIR}/${copia.id}`
    for (const caminho of caminhosDeImagem(mapaCopiado)) {
      expect(apontaParaODestino(caminho, pastaDaCopia), `caminho da cópia ainda aponta para a origem: ${caminho}`).toBe(true)
    }
  })

  it('exportMapFolder grava caminhos que abrem na outra máquina, não na pasta de quem exportou', async () => {
    const origem = `${MAPS_DIR}/map_origem`
    const destino = 'E:/pendrive/Cripta'
    const mapa = mapaComImagens(origem)
    await saveMapToAppData(mapa)
    for (const imagem of ['fundo.png', 'heroi.png', 'mesa.png']) arquivos.set(`${origem}/${imagem}`, 'PNG')

    await exportMapFolder(mapa, origem, destino)

    const exportado = deserializeMap(arquivos.get(`${destino}/map.json`) ?? '')
    for (const caminho of caminhosDeImagem(exportado)) {
      expect(apontaParaODestino(caminho, destino), `mapa exportado ainda aponta para a máquina de origem: ${caminho}`).toBe(true)
    }
  })

  it('cada imagem citada pelo mapa exportado existe DENTRO da pasta exportada (é o que faz o mapa abrir na outra máquina)', async () => {
    const origem = `${MAPS_DIR}/map_origem`
    const destino = 'E:/pendrive/Cripta'
    const mapa = mapaComImagens(origem)
    await saveMapToAppData(mapa)
    for (const imagem of ['fundo.png', 'heroi.png', 'mesa.png']) arquivos.set(`${origem}/${imagem}`, 'PNG')

    await exportMapFolder(mapa, origem, destino)

    const exportado = deserializeMap(arquivos.get(`${destino}/map.json`) ?? '')
    for (const caminho of caminhosDeImagem(exportado)) {
      const ehAbsoluto = /^[a-zA-Z]:[\\/]/.test(caminho) || caminho.startsWith('/')
      const absoluto = (ehAbsoluto ? caminho : `${destino}/${caminho}`).replace(/\\/g, '/')
      expect(absoluto.startsWith(`${destino}/`), `imagem do mapa exportado mora fora da pasta exportada: ${absoluto}`).toBe(true)
      expect(arquivos.has(absoluto), `imagem apontada pelo map.json não existe no destino: ${absoluto}`).toBe(true)
    }
  })
})

describe('mapa danificado aparece na lista em vez de sumir', () => {
  it('map.json corrompido vira entrada marcada como danificada, com o caminho, ao lado dos mapas bons', async () => {
    await saveMapToAppData(makeMap({ id: 'map_bom', name: 'Cripta boa' }))
    const caminhoQuebrado = `${MAPS_DIR}/map_quebrado/map.json`
    arquivos.set(caminhoQuebrado, serializeMap(makeMap({ id: 'map_quebrado' })).slice(0, 60))

    const lista = (await listSavedMaps()) as EntradaListada[]

    const quebrado = lista.find((entrada) => entrada.path === caminhoQuebrado)
    expect(quebrado, `a lista escondeu o mapa danificado: ${JSON.stringify(lista.map((e) => e.path))}`).toBeDefined()
    expect(quebrado?.damaged).toBe(true)
  })

  it('a entrada danificada mostra um nome para o usuário achar a pasta, e o mapa bom continua sem marca', async () => {
    await saveMapToAppData(makeMap({ id: 'map_bom', name: 'Cripta boa' }))
    arquivos.set(`${MAPS_DIR}/map_quebrado/map.json`, '{ "id": "map_quebrado", "walls": [nu')

    const lista = (await listSavedMaps()) as EntradaListada[]

    const quebrado = lista.find((entrada) => entrada.path.includes('map_quebrado'))
    const bom = lista.find((entrada) => entrada.id === 'map_bom')
    expect(quebrado?.name ?? '', 'entrada danificada sem nenhum nome na tela').not.toBe('')
    expect(bom?.damaged ?? false).toBe(false)
  })
})
