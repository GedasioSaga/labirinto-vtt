/**
 * A AVENTURA LEVA A MÍDIA (`lib/midiaDaPasta.ts` ligado em `flush` e em
 * `openMapFileFirst`): salva no computador A, a pasta copiada para o B (sem
 * nada em `<appData>/midia`) abre com o retrato e a imagem do item — a
 * garantia que o retrato embutido no `adventure.json` dava antes da mídia.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from '../types/map'

const APPDATA = 'C:/appdata'
const MIDIA_DO_APP = `${APPDATA}/midia`
const PASTA_A = 'C:/appdata/maps/adv_navio'
const PASTA_B = 'E:/pendrive/navio'

/** O disco dos dois computadores: texto (JSON) e binário (imagem) no mesmo lugar. */
const arquivos = new Map<string, string | Uint8Array>()
const pastas = new Set<string>()

function pai(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf('/'))
}

function criarPastasAte(caminho: string): void {
  for (let pasta = caminho; pasta.includes('/'); pasta = pai(pasta)) pastas.add(pasta)
}

function bytesDe(caminho: string): Uint8Array {
  const conteudo = arquivos.get(caminho)
  if (!(conteudo instanceof Uint8Array)) throw new Error(`arquivo não existe: ${caminho}`)
  return conteudo
}

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (caminho: string, data: string) => {
    criarPastasAte(pai(caminho))
    arquivos.set(caminho, data)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const conteudo = arquivos.get(de)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${de}`)
    arquivos.set(para, conteudo)
    arquivos.delete(de)
  }),
  mkdir: vi.fn(async (caminho: string) => criarPastasAte(caminho)),
  exists: vi.fn(async (caminho: string) => arquivos.has(caminho) || pastas.has(caminho)),
  readTextFile: vi.fn(async (caminho: string) => {
    const conteudo = arquivos.get(caminho)
    if (typeof conteudo !== 'string') throw new Error(`arquivo não existe: ${caminho}`)
    return conteudo
  }),
  readDir: vi.fn(async (caminho: string) => {
    if (!pastas.has(caminho)) throw new Error(`pasta não existe: ${caminho}`)
    return [...arquivos.keys()].filter((c) => pai(c) === caminho).map((c) => ({ name: c.slice(caminho.length + 1), isFile: true, isDirectory: false, isSymlink: false }))
  }),
  readFile: vi.fn(async (caminho: string) => bytesDe(caminho).slice()),
  writeFile: vi.fn(async (caminho: string, bytes: Uint8Array) => {
    arquivos.set(caminho, bytes.slice())
  }),
  copyFile: vi.fn(async (de: string, para: string) => {
    arquivos.set(para, bytesDe(de).slice())
  }),
  stat: vi.fn(async (caminho: string) => {
    const conteudo = arquivos.get(caminho)
    if (conteudo !== undefined) return { size: conteudo.length, isFile: true, isDirectory: false, isSymlink: false, mtime: null }
    if (pastas.has(caminho)) return { size: 0, isFile: false, isDirectory: true, isSymlink: false, mtime: null }
    throw new Error(`não existe: ${caminho}`)
  }),
  remove: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (caminho: string) => pai(caminho)),
}))

const fs = await import('@tauri-apps/plugin-fs')
const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { openMapFileFirst } = await import('../lib/mapFileIO')
const { novoPersonagem } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
const { idDosBytes, idDaRef, refDoId, resolverComBase } = await import('../lib/midia')
const { guardarDataUrl } = await import('../lib/midiaNoDisco')
const { iniciarMidiaDosPersonagens } = await import('./midiaDosPersonagens')

function png(marca: number): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, marca])
}

/** Grava a imagem na mídia do app (o que `guardarMidia` faz) e devolve a referência. */
async function noApp(bytes: Uint8Array): Promise<string> {
  const id = await idDosBytes(bytes)
  if (id === null) throw new Error('o teste montou bytes que não são imagem')
  criarPastasAte(MIDIA_DO_APP)
  arquivos.set(`${MIDIA_DO_APP}/${id}`, bytes)
  return refDoId(id)
}

function idDe(ref: string): string {
  const id = idDaRef(ref)
  if (id === null) throw new Error(`não é referência de mídia: ${ref}`)
  return id
}

/** Ficha com um item na mochila; sem `imagemDoItem`, o item do pino, só com nome. */
function token(id: string, imagemDoItem?: string): Token {
  const item = imagemDoItem === undefined ? { id: `item-${id}`, nome: 'Item' } : { id: `item-${id}`, nome: 'Item', imagem: imagemDoItem }
  return { id, characterId: null, name: id, x: 64, y: 64, size: 1, image: null, mochila: [item] }
}

function mapa(id: string, name: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(`map_${id}`, name, 20, 16, 64), tokens }
}

/** Abre a aventura no computador A com as duas cenas já lidas: o convés no editor, o porão de fundo. */
function abrirNoComputadorA(itemDoConves?: string, itemDoPorao?: string): void {
  const cenas = [
    { id: 'conves', name: 'Convés', file: 'map.json' },
    { id: 'porao', name: 'Porão', file: 'scenes/porao/map.json' },
  ]
  const conves = mapa('conves', 'Convés', [token('ana', itemDoConves)])
  const porao = mapa('porao', 'Porão', [token('bruno', itemDoPorao)])
  useAdventureStore.getState().open({
    path: `${PASTA_A}/map.json`,
    map: conves,
    adventure: { version: 1, id: 'adv_navio', name: 'Navio', startSceneId: 'conves', scenes: cenas },
    adventureDir: PASTA_A,
    activeSceneId: 'conves',
    scenes: [
      { entry: cenas[0], status: 'ok', map: conves },
      { entry: cenas[1], status: 'ok', map: porao },
    ],
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  })
}

/** A pasta da aventura copiada inteira para outro lugar (pendrive, outro computador). */
function copiarPasta(de: string, para: string): void {
  for (const [caminho, conteudo] of [...arquivos]) {
    if (!caminho.startsWith(`${de}/`)) continue
    const destino = `${para}${caminho.slice(de.length)}`
    criarPastasAte(pai(destino))
    arquivos.set(destino, conteudo)
  }
}

beforeEach(() => {
  arquivos.clear()
  pastas.clear()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_raiz', 'Vale', 20, 16, 64))
  useSessionStore.getState().markSaved()
  vi.mocked(fs.remove).mockClear()
})

describe('mídia da aventura entre computadores', () => {
  it('salvar leva retrato e imagens de item (cena aberta e de fundo) para <pasta>/midia, e só elas', async () => {
    const retrato = await noApp(png(1))
    const itemConves = await noApp(png(2))
    const itemPorao = await noApp(png(3))
    const naoUsada = await noApp(png(4))
    abrirNoComputadorA(itemConves, itemPorao)
    useAdventureStore.getState().salvarPersonagem({ ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn'), retrato })

    await useAdventureStore.getState().flush()

    for (const ref of [retrato, itemConves, itemPorao]) expect(arquivos.get(`${PASTA_A}/midia/${idDe(ref)}`)).toEqual(arquivos.get(`${MIDIA_DO_APP}/${idDe(ref)}`))
    expect(arquivos.has(`${PASTA_A}/midia/${idDe(naoUsada)}`)).toBe(false)
    expect(fs.remove).not.toHaveBeenCalled()
  })

  it('ida e volta: salva no A, a mídia do app some, abre no B com o retrato e o item', async () => {
    const retrato = await noApp(png(1))
    const item = await noApp(png(2))
    abrirNoComputadorA(item, item)
    useAdventureStore.getState().salvarPersonagem({ ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn'), retrato })
    await useAdventureStore.getState().flush()

    // O computador B: a pasta veio no pendrive, e a mídia do app não tem nada.
    copiarPasta(PASTA_A, PASTA_B)
    for (const caminho of [...arquivos.keys()]) if (caminho.startsWith(`${MIDIA_DO_APP}/`)) arquivos.delete(caminho)
    useAdventureStore.getState().reset()

    const aberto = await openMapFileFirst(`${PASTA_B}/map.json`)
    const retratoAberto = aberto.adventure?.personagens?.[0]?.retrato
    expect(retratoAberto).toBe(retrato)
    // O resolvedor do mestre aponta para `<appData>/midia/<id>` — e o arquivo está lá, com o conteúdo certo.
    const base = `${MIDIA_DO_APP}/`
    expect(resolverComBase(base)(retratoAberto)).toBe(`${MIDIA_DO_APP}/${idDe(retrato)}`)
    expect(arquivos.get(`${MIDIA_DO_APP}/${idDe(retrato)}`)).toEqual(png(1))
    expect(arquivos.get(`${MIDIA_DO_APP}/${idDe(item)}`)).toEqual(png(2))
  })

  it('aventura de antes, com o retrato embutido: convertido em mídia e salvo, a pasta passa a levá-lo', async () => {
    const embutido = `data:image/png;base64,${btoa(String.fromCharCode(...png(6)))}`
    abrirNoComputadorA()
    useAdventureStore.getState().salvarPersonagem({ ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn'), retrato: embutido })
    // O observador que o editor liga (`MidiaDoMestre`), com o disco de mídia de verdade.
    const parar = iniciarMidiaDosPersonagens(guardarDataUrl)
    try {
      await vi.waitFor(() => expect(useAdventureStore.getState().adventure?.personagens?.[0]?.retrato).toMatch(/^midia:/))
    } finally {
      parar()
    }
    const ref = useAdventureStore.getState().adventure?.personagens?.[0]?.retrato ?? ''

    await useAdventureStore.getState().flush()

    expect(arquivos.get(`${PASTA_A}/midia/${idDe(ref)}`)).toEqual(png(6))
  })

  it('aventura sem imagem nenhuma: salvar não cria a pasta de mídia', async () => {
    abrirNoComputadorA()
    useAdventureStore.getState().salvarPersonagem(novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn'))
    await useAdventureStore.getState().flush()
    expect(arquivos.has(`${PASTA_A}/adventure.json`)).toBe(true)
    expect(pastas.has(`${PASTA_A}/midia`)).toBe(false)
  })
})
