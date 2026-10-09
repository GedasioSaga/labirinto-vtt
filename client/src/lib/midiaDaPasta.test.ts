/**
 * MÍDIA QUE VIAJA COM A AVENTURA (`lib/midiaDaPasta.ts`): salvar leva para a
 * pasta só a mídia usada; abrir traz de volta para `<appData>/midia` só o que
 * confere com o nome. Nada é apagado, e nada derruba a gravação.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from '../types/map'
import type { Personagem } from './personagem'

const APPDATA = 'C:/appdata'
const MIDIA_DO_APP = `${APPDATA}/midia`

const binarios = new Map<string, Uint8Array>()
const pastas = new Set<string>()
/** Pastas que existem mas o disco não deixa listar. */
const ilegiveis = new Set<string>()

function pai(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf('/'))
}

function criarPastasAte(caminho: string): void {
  for (let pasta = caminho; pasta.includes('/'); pasta = pai(pasta)) pastas.add(pasta)
}

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (caminho: string) => pai(caminho)),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: vi.fn(async (caminho: string) => criarPastasAte(caminho)),
  readDir: vi.fn(async (caminho: string) => {
    if (ilegiveis.has(caminho) || !pastas.has(caminho)) throw new Error(`não deu para listar ${caminho}`)
    const arquivos = [...binarios.keys()].filter((c) => pai(c) === caminho).map((c) => ({ name: c.slice(caminho.length + 1), isFile: true, isDirectory: false, isSymlink: false }))
    const subpastas = [...pastas].filter((c) => pai(c) === caminho).map((c) => ({ name: c.slice(caminho.length + 1), isFile: false, isDirectory: true, isSymlink: false }))
    return [...arquivos, ...subpastas]
  }),
  readFile: vi.fn(async (caminho: string) => {
    const bytes = binarios.get(caminho)
    if (bytes === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return bytes.slice()
  }),
  writeFile: vi.fn(async (caminho: string, bytes: Uint8Array) => {
    binarios.set(caminho, bytes.slice())
  }),
  copyFile: vi.fn(async (de: string, para: string) => {
    const bytes = binarios.get(de)
    if (bytes === undefined) throw new Error(`arquivo não existe: ${de}`)
    binarios.set(para, bytes.slice())
  }),
  stat: vi.fn(async (caminho: string) => {
    const bytes = binarios.get(caminho)
    if (bytes !== undefined) return { size: bytes.length, isFile: true, isDirectory: false, isSymlink: false }
    if (pastas.has(caminho)) return { size: 0, isFile: false, isDirectory: true, isSymlink: false }
    throw new Error(`não existe: ${caminho}`)
  }),
  remove: vi.fn(async () => undefined),
}))

const fs = await import('@tauri-apps/plugin-fs')
const { useToastStore } = await import('../stores/toastStore')
const { idDosBytes, MIDIA_MAX_BYTES, refDoId } = await import('./midia')
const { createEmptyMap } = await import('./mapFactory')
const { novoCartao } = await import('./personagem')
const {
  copiarMidiaParaAPasta,
  idsDaMidiaUsada,
  importarMidiaDaPasta,
  levarMidiaDaAventura,
  levarMidiaDoMapaSolto,
  nomeDaMidiaDoMapaSolto,
  trazerMidiaAoAbrir,
} = await import('./midiaDaPasta')

/** Um PNG pequeno; `marca` muda o conteúdo (e com ele o hash). */
function png(marca: number): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, marca])
}

async function idDe(bytes: Uint8Array): Promise<string> {
  const id = await idDosBytes(bytes)
  if (id === null) throw new Error('o teste montou bytes que não são imagem')
  return id
}

/** Grava a imagem na mídia do app, como `guardarMidia` faria, e devolve o id. */
async function noApp(bytes: Uint8Array): Promise<string> {
  const id = await idDe(bytes)
  criarPastasAte(MIDIA_DO_APP)
  binarios.set(`${MIDIA_DO_APP}/${id}`, bytes)
  return id
}

function token(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 64, y: 64, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('map_x', 'Masmorra', 10, 10, 64), tokens }
}

beforeEach(() => {
  binarios.clear()
  pastas.clear()
  ilegiveis.clear()
  vi.mocked(fs.remove).mockClear()
  vi.mocked(fs.readFile).mockClear()
  vi.mocked(fs.writeFile).mockClear()
  vi.mocked(fs.copyFile).mockClear()
  useToastStore.setState({ toasts: [] })
})

describe('onde mora a mídia', () => {
  it('mapa solto: pasta irmã com o nome do arquivo sem .json', () => {
    expect(nomeDaMidiaDoMapaSolto('masmorra.json')).toBe('masmorra.midia')
    expect(nomeDaMidiaDoMapaSolto('Mapa.JSON')).toBe('Mapa.midia')
    expect(nomeDaMidiaDoMapaSolto('sem-extensao')).toBe('sem-extensao.midia')
  })
})

describe('idsDaMidiaUsada', () => {
  it('retrato, cartão e subcartão, mochila das cenas e das fichas guardadas; sem repetir e sem a embutida', async () => {
    const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map((marca) => idDe(png(marca))))
    const sub = { ...novoCartao('Técnica'), imagem: refDoId(d) }
    const cartao = { ...novoCartao('Forma'), imagem: refDoId(c), subcartoes: [sub] }
    const personagem = { retrato: refDoId(a), abas: { tecnicas: [cartao] } }
    const mapa = mapaCom([token('t1', { mochila: [{ id: 'i1', nome: 'Espada', imagem: refDoId(b) }, { id: 'i2', nome: 'Corda' }] })])
    const guardada = token('t2', { mochila: [{ id: 'i3', nome: 'Espada', imagem: refDoId(b) }] })

    const ids = idsDaMidiaUsada({
      // A segunda ficha tem só o retrato embutido de antes: ele mora no `adventure.json`, não é mídia a levar.
      personagens: [{ ...vagnSemImagem(), ...personagem }, { ...vagnSemImagem(), retrato: 'data:image/png;base64,AAAA' }],
      mapas: [mapa],
      tokens: [guardada],
    })
    expect(ids).toEqual([a, b, c, d].sort())
  })
})

function vagnSemImagem(): Personagem {
  return {
    id: 'pers_1',
    tipo: 'jogador',
    nome: 'Vagn',
    descricao: '',
    retrato: null,
    escolhas: {},
    etiquetas: [],
    recursos: {},
    maximos: {},
    modificadoresDosRecursos: {},
    atributos: {},
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas: {},
  }
}

describe('copiarMidiaParaAPasta (salvar)', () => {
  it('leva só os ids pedidos, com o mesmo nome, e não grava de novo o que já está inteiro', async () => {
    const usada = await noApp(png(1))
    const outra = await noApp(png(2))

    const primeira = await copiarMidiaParaAPasta('C:/aventura/midia', [usada])
    expect(primeira).toEqual({ copiados: [usada], faltaram: [] })
    expect(binarios.get(`C:/aventura/midia/${usada}`)).toEqual(png(1))
    expect(binarios.has(`C:/aventura/midia/${outra}`)).toBe(false)

    const segunda = await copiarMidiaParaAPasta('C:/aventura/midia', [usada])
    expect(segunda).toEqual({ copiados: [], faltaram: [] })
    expect(fs.copyFile).toHaveBeenCalledTimes(1)
  })

  it('a cópia truncada (app fechado no meio) é refeita; a origem que sumiu vira "faltou" e as outras vão', async () => {
    const inteira = await noApp(png(1))
    const sumida = await idDe(png(2))
    binarios.set(`C:/aventura/midia/${inteira}`, png(1).slice(0, 5))
    criarPastasAte('C:/aventura/midia')

    const levada = await copiarMidiaParaAPasta('C:/aventura/midia', [sumida, inteira])
    expect(levada).toEqual({ copiados: [inteira], faltaram: [sumida] })
    expect(binarios.get(`C:/aventura/midia/${inteira}`)).toEqual(png(1))
  })

  it('a imagem que sumiu deste computador mas já está na pasta não é problema', async () => {
    const id = await idDe(png(3))
    criarPastasAte('C:/aventura/midia')
    binarios.set(`C:/aventura/midia/${id}`, png(3))
    expect(await copiarMidiaParaAPasta('C:/aventura/midia', [id])).toEqual({ copiados: [], faltaram: [] })
  })

  it('nunca apaga: a imagem que a aventura deixou de usar fica na pasta', async () => {
    const velha = await noApp(png(1))
    const nova = await noApp(png(2))
    await copiarMidiaParaAPasta('C:/aventura/midia', [velha])
    await copiarMidiaParaAPasta('C:/aventura/midia', [nova])
    expect(binarios.has(`C:/aventura/midia/${velha}`)).toBe(true)
    expect(binarios.has(`C:/aventura/midia/${nova}`)).toBe(true)
    expect(fs.remove).not.toHaveBeenCalled()
  })
})

describe('importarMidiaDaPasta (abrir)', () => {
  it('traz o que falta no app conferindo o hash; o arquivo trocado é recusado e não entra', async () => {
    const boa = await idDe(png(1))
    const trocada = await idDe(png(2))
    criarPastasAte('C:/aventura/midia')
    binarios.set(`C:/aventura/midia/${boa}`, png(1))
    // Nome de uma imagem, conteúdo de outra: a sala serviria o que não é.
    binarios.set(`C:/aventura/midia/${trocada}`, png(9))

    const trazida = await importarMidiaDaPasta('C:/aventura/midia')
    expect(trazida).toEqual({ importados: [boa], recusados: [trocada], pastaIlegivel: false })
    expect(binarios.get(`${MIDIA_DO_APP}/${boa}`)).toEqual(png(1))
    expect(binarios.has(`${MIDIA_DO_APP}/${trocada}`)).toBe(false)
  })

  it('arquivo maior que o teto é recusado sem ser lido; nome que não é de mídia, subpasta e o resto ficam de fora', async () => {
    const grande = new Uint8Array(MIDIA_MAX_BYTES + 1)
    grande.set(png(1))
    const idGrande = `${'a'.repeat(64)}.png`
    criarPastasAte('C:/aventura/midia/sub')
    binarios.set(`C:/aventura/midia/${idGrande}`, grande)
    binarios.set('C:/aventura/midia/leia-me.txt', new TextEncoder().encode('oi'))

    const trazida = await importarMidiaDaPasta('C:/aventura/midia')
    expect(trazida).toEqual({ importados: [], recusados: [idGrande], pastaIlegivel: false })
    expect(fs.readFile).not.toHaveBeenCalled()
  })

  it('idempotente: abrir de novo não regrava nada', async () => {
    const id = await idDe(png(1))
    criarPastasAte('C:/aventura/midia')
    binarios.set(`C:/aventura/midia/${id}`, png(1))
    await importarMidiaDaPasta('C:/aventura/midia')
    vi.mocked(fs.writeFile).mockClear()

    expect(await importarMidiaDaPasta('C:/aventura/midia')).toEqual({ importados: [], recusados: [], pastaIlegivel: false })
    expect(fs.writeFile).not.toHaveBeenCalled()
  })

  it('sem pasta de mídia não há problema; a pasta que existe e não abre é avisada', async () => {
    expect(await importarMidiaDaPasta('C:/aventura/midia')).toEqual({ importados: [], recusados: [], pastaIlegivel: false })
    criarPastasAte('C:/aventura/midia')
    ilegiveis.add('C:/aventura/midia')
    expect(await importarMidiaDaPasta('C:/aventura/midia')).toEqual({ importados: [], recusados: [], pastaIlegivel: true })
  })
})

describe('levar e trazer, com aviso', () => {
  it('imagem que não está neste computador: aviso, e a gravação não falha', async () => {
    const sumida = await idDe(png(5))
    const levada = await levarMidiaDaAventura('C:/aventura', { personagens: [{ ...vagnSemImagem(), retrato: refDoId(sumida) }] })
    expect(levada.faltaram).toEqual([sumida])
    const avisos = useToastStore.getState().toasts
    expect(avisos).toHaveLength(1)
    expect(avisos[0]?.text).toContain('1 imagem não foi junto')
  })

  it('nada a levar não cria pasta nem avisa', async () => {
    expect(await levarMidiaDaAventura('C:/aventura', { personagens: [vagnSemImagem()], mapas: [mapaCom([token('t')])] })).toEqual({ copiados: [], faltaram: [] })
    expect(pastas.has('C:/aventura/midia')).toBe(false)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('mapa solto: a mídia das mochilas vai para <nome>.midia ao lado do arquivo, e volta ao abrir em outro computador', async () => {
    const id = await noApp(png(7))
    const mapa = mapaCom([token('t', { mochila: [{ id: 'i', nome: 'Lanterna', imagem: refDoId(id) }] })])
    await levarMidiaDoMapaSolto('C:/mesa/masmorra.json', mapa)
    expect(binarios.get(`C:/mesa/masmorra.midia/${id}`)).toEqual(png(7))

    // Outro computador: a mídia do app está vazia.
    binarios.delete(`${MIDIA_DO_APP}/${id}`)
    const trazida = await trazerMidiaAoAbrir('C:/mesa/masmorra.json', null)
    expect(trazida.importados).toEqual([id])
    expect(binarios.get(`${MIDIA_DO_APP}/${id}`)).toEqual(png(7))
  })

  it('arquivo recusado ao abrir: aviso, e a abertura segue', async () => {
    const trocada = await idDe(png(2))
    criarPastasAte('C:/aventura/midia')
    binarios.set(`C:/aventura/midia/${trocada}`, png(8))
    const trazida = await trazerMidiaAoAbrir('C:/aventura/map.json', 'C:/aventura')
    expect(trazida.recusados).toEqual([trocada])
    expect(useToastStore.getState().toasts[0]?.text).toContain('foi ignorada')
  })
})
