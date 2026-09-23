/**
 * Plano B da gravação segura (`writeTextFileSafely`, lib/mapFileIO.ts).
 *
 * É o caminho de PRODUÇÃO hoje: a capability do app
 * (desktop/src-tauri/capabilities/default.json) não concede `fs:allow-rename`,
 * então o Tauri recusa o `rename` com a mensagem da ACL
 * ("fs.rename not allowed. Permissions associated with this command: ...") e
 * toda gravação cai no plano B — guardar o conteúdo anterior e devolvê-lo se a
 * escrita falhar. O dublê de `mapFileIO.persistencia.test.ts` tem um `rename`
 * que sempre funciona, então esse caminho nunca era exercitado.
 *
 * O disco de mentira imita a semântica real de `writeTextFile`: trunca e só
 * então escreve; falhar no meio deixa o PEDAÇO no caminho, não o anterior.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData } from '../types/map'

const arquivos = new Map<string, string>()
const pastas = new Set<string>()
/** Quantas das próximas escritas em cada caminho falham no meio. */
const falhasPorCaminho = new Map<string, number>()
/** Caminhos cuja leitura estoura (arquivo existe, mas não dá para ler). */
const leituraQuebrada = new Set<string>()
let escritasQueFalharam = 0

type ComportamentoRename = 'ok' | 'acl' | 'em-uso-uma-vez'
let comportamentoRename: ComportamentoRename = 'ok'

/** Texto exato que o Tauri 2 devolve quando a capability não tem a permissão. */
const RECUSA_ACL =
  'fs.rename not allowed. Permissions associated with this command: fs:allow-rename, fs:write-all'
/** Recusa passageira típica do Windows: antivírus/OneDrive segurando o arquivo. */
const RECUSA_EM_USO =
  'O arquivo já está sendo usado por outro processo. (os error 32)'

const writeTextFileMock = vi.fn(async (path: string, data: string) => {
  const falhas = falhasPorCaminho.get(path) ?? 0
  if (falhas > 0) {
    falhasPorCaminho.set(path, falhas - 1)
    escritasQueFalharam += 1
    arquivos.set(path, data.slice(0, Math.max(1, Math.floor(data.length / 3))))
    throw new Error(`escrita interrompida #${escritasQueFalharam}: disco cheio (simulado)`)
  }
  arquivos.set(path, data)
})

const renameMock = vi.fn(async (from: string, to: string) => {
  if (comportamentoRename === 'acl') throw RECUSA_ACL
  if (comportamentoRename === 'em-uso-uma-vez') {
    comportamentoRename = 'ok'
    throw RECUSA_EM_USO
  }
  const conteudo = arquivos.get(from)
  if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
  arquivos.set(to, conteudo)
  arquivos.delete(from)
})

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock,
  rename: renameMock,
  mkdir: vi.fn(async (path: string) => {
    pastas.add(path)
  }),
  exists: vi.fn(async (path: string) => arquivos.has(path) || pastas.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    if (leituraQuebrada.has(path)) throw new Error(`acesso negado: ${path}`)
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: new Date('2026-01-01T00:00:00.000Z') })),
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
    pastas.delete(path)
  }),
  copyFile: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
  }),
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

const { deserializeMap, serializeMap } = await import('./mapFile')

/**
 * Módulo novo a cada teste: `mapFileIO` lembra pela sessão se o `rename` é
 * usável, e essa memória não pode vazar de um teste para o outro.
 */
async function carregarMapFileIO() {
  vi.resetModules()
  return import('./mapFileIO')
}

const CAMINHO = 'D:/campanhas/cripta.json'
const RASCUNHO = `${CAMINHO}.tmp`

function makeMap(overrides: Partial<MapData> = {}): MapData {
  return {
    id: 'map_origem',
    name: 'Cripta',
    width: 30,
    height: 20,
    grid: 64,
    gridShape: 'square',
    showGrid: false,
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

function nomeNoDisco(caminho: string): string {
  const conteudo = arquivos.get(caminho) ?? ''
  return deserializeMap(conteudo).name
}

/** Quantas vezes o arquivo do usuário foi escrito diretamente (truncando-o). */
function escritasDiretasNo(caminho: string, aPartirDe: number): number {
  return writeTextFileMock.mock.calls.slice(aPartirDe).filter(([path]) => path === caminho).length
}

beforeEach(() => {
  vi.clearAllMocks()
  arquivos.clear()
  pastas.clear()
  falhasPorCaminho.clear()
  leituraQuebrada.clear()
  escritasQueFalharam = 0
  comportamentoRename = 'ok'
})

describe('plano B: rename recusado pela permissão do app (caminho de produção no Windows)', () => {
  it('salvar grava o mapa novo e não deixa rascunho .tmp esquecido na pasta', async () => {
    const { saveMapToPath } = await carregarMapFileIO()
    arquivos.set(CAMINHO, serializeMap(makeMap({ name: 'Cripta salva' })))
    comportamentoRename = 'acl'

    await saveMapToPath(makeMap({ name: 'Cripta v2' }), CAMINHO)

    expect(nomeNoDisco(CAMINHO)).toBe('Cripta v2')
    expect(arquivos.has(RASCUNHO), 'sobrou map.json.tmp ao lado do arquivo').toBe(false)
  })

  it('depois da recusa por permissão, os salvamentos seguintes não repetem a tentativa de rascunho', async () => {
    const { saveMapToPath } = await carregarMapFileIO()
    comportamentoRename = 'acl'
    await saveMapToPath(makeMap({ name: 'Cripta v1' }), CAMINHO)
    const chamadasAntes = writeTextFileMock.mock.calls.length

    await saveMapToPath(makeMap({ name: 'Cripta v2' }), CAMINHO)

    const rascunhos = writeTextFileMock.mock.calls.slice(chamadasAntes).filter(([path]) => path === RASCUNHO)
    expect(rascunhos).toHaveLength(0)
    expect(nomeNoDisco(CAMINHO)).toBe('Cripta v2')
  })

  it('escrita que falha no meio devolve o arquivo anterior intacto e o erro chega a quem salvou', async () => {
    const { saveMapToPath } = await carregarMapFileIO()
    arquivos.set(CAMINHO, serializeMap(makeMap({ name: 'Cripta salva' })))
    comportamentoRename = 'acl'
    falhasPorCaminho.set(CAMINHO, 1)

    await expect(saveMapToPath(makeMap({ name: 'Cripta v2' }), CAMINHO)).rejects.toThrow('disco cheio')

    expect(nomeNoDisco(CAMINHO)).toBe('Cripta salva')
  })

  it('escrita que falha no meio de um mapa NOVO não deixa arquivo pela metade (que apareceria como mapa danificado)', async () => {
    const { saveMapToAppData } = await carregarMapFileIO()
    comportamentoRename = 'acl'
    const caminhoNovo = 'C:/Users/test/AppData/Roaming/labirinto/maps/map_novo/map.json'
    falhasPorCaminho.set(caminhoNovo, 1)

    await expect(saveMapToAppData(makeMap({ id: 'map_novo', name: 'Cripta nova' }))).rejects.toThrow('disco cheio')

    expect(arquivos.get(caminhoNovo), 'ficou um map.json truncado no disco').toBeUndefined()
  })

  it('arquivo que existe mas não pôde ser lido não é apagado quando a escrita falha', async () => {
    const { saveMapToPath } = await carregarMapFileIO()
    arquivos.set(CAMINHO, serializeMap(makeMap({ name: 'Cripta salva' })))
    leituraQuebrada.add(CAMINHO)
    comportamentoRename = 'acl'
    falhasPorCaminho.set(CAMINHO, 1)

    await expect(saveMapToPath(makeMap({ name: 'Cripta v2' }), CAMINHO)).rejects.toThrow('disco cheio')

    expect(arquivos.has(CAMINHO), 'o arquivo do usuário foi apagado').toBe(true)
  })

  it('se até a restauração falha, o erro que sobe é o da gravação, não o da restauração', async () => {
    const { saveMapToPath } = await carregarMapFileIO()
    arquivos.set(CAMINHO, serializeMap(makeMap({ name: 'Cripta salva' })))
    comportamentoRename = 'acl'
    falhasPorCaminho.set(CAMINHO, 2)

    await expect(saveMapToPath(makeMap({ name: 'Cripta v2' }), CAMINHO)).rejects.toThrow('escrita interrompida #1')
  })
})

describe('recusa passageira do rename (arquivo em uso no Windows)', () => {
  it('ainda salva o mapa novo na hora, pelo plano B', async () => {
    const { saveMapToPath } = await carregarMapFileIO()
    arquivos.set(CAMINHO, serializeMap(makeMap({ name: 'Cripta salva' })))
    comportamentoRename = 'em-uso-uma-vez'

    await saveMapToPath(makeMap({ name: 'Cripta v2' }), CAMINHO)

    expect(nomeNoDisco(CAMINHO)).toBe('Cripta v2')
    expect(arquivos.has(RASCUNHO)).toBe(false)
  })

  it('não desliga a gravação atômica pelo resto da sessão: o salvamento seguinte não trunca o arquivo do usuário', async () => {
    const { saveMapToPath } = await carregarMapFileIO()
    arquivos.set(CAMINHO, serializeMap(makeMap({ name: 'Cripta salva' })))
    comportamentoRename = 'em-uso-uma-vez'
    await saveMapToPath(makeMap({ name: 'Cripta v2' }), CAMINHO)
    const chamadasAntes = writeTextFileMock.mock.calls.length

    await saveMapToPath(makeMap({ name: 'Cripta v3' }), CAMINHO)

    expect(escritasDiretasNo(CAMINHO, chamadasAntes), 'gravou direto no arquivo (plano B) em vez de rascunho + rename').toBe(0)
    expect(nomeNoDisco(CAMINHO)).toBe('Cripta v3')
  })
})
