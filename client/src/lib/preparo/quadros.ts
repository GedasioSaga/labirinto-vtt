import { join } from '@tauri-apps/api/path'
import { exists, readDir, readTextFile, remove, rename, writeFile } from '@tauri-apps/plugin-fs'
import { FEATURES, type FeatureFlags } from '../features'
import { ensureDir } from '../mapFileIO'
import { hashHex } from '../midia'
import { LUGARES, gravarNoPreparo, lerDoPreparo, listarNoPreparo, pastaDoPreparo, type DocumentoLido } from './disco'
import { chaveDoCaminho } from './importar/cofre'
import { ehRegistro } from './molde'
import { ARQUIVO_DO_QUADRO, type Quadro } from './tipos'

/**
 * OS QUADROS (MAPA MENTAL) DO PRELÚDIO: `<appData>/preparo/quadros/<id>.json`
 * com a foto do tldraw intacta (plano §2, fatia F3), e as imagens coladas nele
 * em `midia/<sha256>.<ext>`, uma vez só por conteúdo.
 *
 * - A foto é a do tldraw (`{document, session}`, como o Grimório grava em
 *   `canvasDoc.ts`; as fotos antigas são `{store, schema}`). Aqui ela só é
 *   contada e lida: quem a abre e migra é o próprio tldraw, na tela.
 * - A imagem que veio do Grimório guarda o caminho do cofre em `meta.rel`. Ao
 *   abrir, ela ganha `meta.midia` pela tabela da importação aplicada
 *   (`importacoes/<data>/relatorio.json`, `tabelaDeMidia`); o `meta.rel` fica.
 * - Nada daqui lê nem grava com a chave do Prelúdio desligada (`disco.ts`).
 */

const PASTA_DA_MIDIA = 'midia'
const PASTA_DAS_IMPORTACOES = 'importacoes'
const ARQUIVO_DO_RELATORIO = 'relatorio.json'
const SUFIXO_TEMPORARIO = '.tmp'

// ─── A foto do tldraw ────────────────────────────────────────────────────────

/** Os tipos de forma que contam como cartão de verbete (os 3 do Grimório). */
export const TIPOS_DE_CARTAO: ReadonlySet<string> = new Set(['character-card', 'cenario-card', 'item-card'])

/** Os tipos de forma de planta (mapa de masmorra do Grimório): o quadro com eles abre só para ver. */
export const TIPOS_DE_PLANTA: ReadonlySet<string> = new Set([
  'porta-mapa',
  'simbolo-mapa',
  'sala-mapa',
  'linha-mapa',
  'item-mapa',
  'retangulo-mapa',
  'escada-mapa',
  'corredor-mapa',
  'torre-mapa',
  'sala-poligono-mapa',
  'muralha-mapa',
])

/** Os registros da foto (`{document: {store}}`, ou `{store}` nas fotos antigas). Foto vazia ou estranha = nenhum. */
export function registrosDaFoto(tldraw: unknown): Record<string, unknown>[] {
  if (!ehRegistro(tldraw)) return []
  const documento = ehRegistro(tldraw.document) ? tldraw.document : tldraw
  const store = documento.store
  return ehRegistro(store) ? Object.values(store).filter(ehRegistro) : []
}

export interface ContagemDoQuadro {
  readonly formas: number
  readonly cartoes: number
  readonly imagens: number
  readonly setas: number
  readonly molduras: number
  readonly salas: number
  readonly textos: number
}

/** Quantas formas de cada tipo a foto tem (a lista e a prova de que o quadro abriu inteiro). */
export function contarFormas(tldraw: unknown): ContagemDoQuadro {
  let formas = 0
  let cartoes = 0
  let imagens = 0
  let setas = 0
  let molduras = 0
  let salas = 0
  let textos = 0
  for (const registro of registrosDaFoto(tldraw)) {
    if (registro.typeName !== 'shape' || typeof registro.type !== 'string') continue
    formas += 1
    const tipo = registro.type
    if (TIPOS_DE_CARTAO.has(tipo)) cartoes += 1
    else if (tipo === 'image') imagens += 1
    else if (tipo === 'arrow') setas += 1
    else if (tipo === 'frame') molduras += 1
    else if (tipo === 'sala-mapa' || tipo === 'sala-poligono-mapa') salas += 1
    else if (tipo === 'text' || tipo === 'note') textos += 1
  }
  return { formas, cartoes, imagens, setas, molduras, salas, textos }
}

/** Quadro de planta (os `mapas-soltos` do Grimório, ou foto com peça de planta): abre só para ver. */
export function ehPlanta(quadro: Quadro): boolean {
  const caminho = quadro.origem?.grimorio?.caminho ?? ''
  if (chaveDoCaminho(caminho).startsWith('mapas-soltos/')) return true
  return registrosDaFoto(quadro.tldraw).some((registro) => registro.typeName === 'shape' && typeof registro.type === 'string' && TIPOS_DE_PLANTA.has(registro.type))
}

/** O que a foto leva para o asset store: o caminho da mídia do Prelúdio. */
export function midiaDoAsset(meta: unknown): string | null {
  return ehRegistro(meta) && typeof meta.midia === 'string' ? meta.midia : null
}

/** As imagens da foto que vieram do Grimório e ainda não sabem a mídia do Prelúdio. */
export function caminhosSemMidia(tldraw: unknown): string[] {
  const saida: string[] = []
  for (const registro of registrosDaFoto(tldraw)) {
    if (registro.typeName !== 'asset' || !ehRegistro(registro.meta)) continue
    if (midiaDoAsset(registro.meta) === null && typeof registro.meta.rel === 'string') saida.push(registro.meta.rel)
  }
  return saida
}

/**
 * A foto com `meta.midia` em cada imagem do Grimório que a tabela conhece. Não
 * mexe na foto recebida: devolve outra, igual no resto (o tldraw migra o que
 * for preciso ao abrir). `semArquivo` conta as que a tabela não conhece.
 */
export function fotoComMidia(tldraw: unknown, midiaDe: (rel: string) => string | null): { foto: unknown; semArquivo: number } {
  if (!ehRegistro(tldraw)) return { foto: tldraw, semArquivo: 0 }
  const comDocumento = ehRegistro(tldraw.document)
  const documento = comDocumento ? (tldraw.document as Record<string, unknown>) : tldraw
  if (!ehRegistro(documento.store)) return { foto: tldraw, semArquivo: 0 }
  let semArquivo = 0
  const store: Record<string, unknown> = {}
  for (const [chave, registro] of Object.entries(documento.store)) {
    if (!ehRegistro(registro) || registro.typeName !== 'asset' || !ehRegistro(registro.meta) || midiaDoAsset(registro.meta) !== null || typeof registro.meta.rel !== 'string') {
      store[chave] = registro
      continue
    }
    const midia = midiaDe(registro.meta.rel)
    if (midia === null) {
      semArquivo += 1
      store[chave] = registro
    } else {
      store[chave] = { ...registro, meta: { ...registro.meta, midia } }
    }
  }
  const novoDocumento = { ...documento, store }
  return { foto: comDocumento ? { ...tldraw, document: novoDocumento } : novoDocumento, semArquivo }
}

// ─── Quadro novo ─────────────────────────────────────────────────────────────

/** Id de quadro novo: serve de nome de arquivo (`disco.ts`, `idDoPreparoValido`). */
export function idDeQuadroNovo(): string {
  return `quadro-${crypto.randomUUID()}`
}

/** Um quadro em branco; a foto nasce no primeiro salvar. */
export function quadroNovo(nome: string, opcoes: { campanhaId?: string; sessaoId?: string } = {}): Quadro {
  const quadro: Quadro = { formato: ARQUIVO_DO_QUADRO.formato, nome, tldraw: null }
  if (opcoes.campanhaId !== undefined) quadro.campanhaId = opcoes.campanhaId
  if (opcoes.sessaoId !== undefined) quadro.sessaoId = opcoes.sessaoId
  return quadro
}

// ─── Disco ───────────────────────────────────────────────────────────────────

export interface QuadroNaLista {
  readonly id: string
  /** `null` quando o arquivo não abriu (o motivo vem em `aviso`). */
  readonly quadro: Quadro | null
  readonly soLeitura: boolean
  readonly aviso: string | null
}

export function lerQuadro(id: string, flags: Readonly<FeatureFlags> = FEATURES): Promise<DocumentoLido<Quadro>> {
  return lerDoPreparo(ARQUIVO_DO_QUADRO, LUGARES.quadro(id), flags)
}

export function gravarQuadro(id: string, quadro: Quadro, flags: Readonly<FeatureFlags> = FEATURES): Promise<void> {
  return gravarNoPreparo(ARQUIVO_DO_QUADRO, LUGARES.quadro(id), quadro, flags)
}

/** Todos os quadros de preparo/quadros/, na ordem dos ids. Nunca lança por um arquivo ruim: ele vem com o aviso. */
export async function listarQuadros(flags: Readonly<FeatureFlags> = FEATURES): Promise<QuadroNaLista[]> {
  const ids = await listarNoPreparo('quadros', flags)
  return Promise.all(
    ids.map(async (id): Promise<QuadroNaLista> => {
      const lido = await lerQuadro(id, flags)
      switch (lido.estado) {
        case 'ok':
          return { id, quadro: lido.valor, soLeitura: false, aviso: lido.aviso }
        case 'somenteLeitura':
          return { id, quadro: lido.valor, soLeitura: true, aviso: lido.aviso }
        case 'novo':
          return { id, quadro: null, soLeitura: true, aviso: 'O arquivo sumiu enquanto a lista era lida.' }
        case 'falhou':
          return { id, quadro: null, soLeitura: true, aviso: lido.aviso }
      }
    }),
  )
}

// ─── Mídia ───────────────────────────────────────────────────────────────────

const EXTENSAO_DO_TIPO: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

/** A extensão da mídia pelo tipo do arquivo, ou pelo nome; `png` quando nada diz. */
export function extensaoDaImagem(tipo: string, nome: string): string {
  const doTipo = EXTENSAO_DO_TIPO[tipo.toLowerCase()]
  if (doTipo !== undefined) return doTipo
  const doNome = /\.([a-z0-9]{1,8})$/i.exec(nome)?.[1]?.toLowerCase()
  return doNome === 'jpeg' ? 'jpg' : (doNome ?? 'png')
}

/**
 * Grava a imagem em `midia/<sha256>.<ext>` e devolve esse caminho. A mesma
 * imagem colada duas vezes (ou já vinda do Grimório) não é gravada de novo.
 */
export async function gravarMidiaDoQuadro(bytes: Uint8Array, extensao: string, flags: Readonly<FeatureFlags> = FEATURES): Promise<string> {
  const raiz = await pastaDoPreparo(flags)
  const nome = `${await hashHex(bytes)}.${extensao}`
  const pasta = await join(raiz, PASTA_DA_MIDIA)
  const destino = await join(pasta, nome)
  if (!(await exists(destino))) {
    await ensureDir(pasta)
    const temporario = `${destino}${SUFIXO_TEMPORARIO}`
    try {
      await writeFile(temporario, bytes)
      await rename(temporario, destino)
    } catch (erro) {
      await remove(temporario).catch(() => undefined)
      throw erro
    }
  }
  return `${PASTA_DA_MIDIA}/${nome}`
}

let tabelaGuardada: Promise<ReadonlyMap<string, string>> | null = null

/**
 * Caminho do cofre → mídia do Prelúdio, juntando as tabelas de todas as
 * importações aplicadas (a mais nova vence). Lida uma vez por abertura do app,
 * e só quando um quadro tem imagem do Grimório sem `meta.midia`.
 */
export function tabelaDeMidiaDasImportacoes(flags: Readonly<FeatureFlags> = FEATURES): Promise<ReadonlyMap<string, string>> {
  tabelaGuardada ??= lerTabelas(flags).catch(() => {
    tabelaGuardada = null
    return new Map<string, string>()
  })
  return tabelaGuardada
}

async function lerTabelas(flags: Readonly<FeatureFlags>): Promise<ReadonlyMap<string, string>> {
  const pasta = await join(await pastaDoPreparo(flags), PASTA_DAS_IMPORTACOES)
  const tabela = new Map<string, string>()
  if (!(await exists(pasta))) return tabela
  // O nome da pasta é o carimbo da data: em ordem, a mais nova por último escreve por cima.
  const importacoes = (await readDir(pasta)).filter((entrada) => entrada.isDirectory).map((entrada) => entrada.name).sort()
  for (const nome of importacoes) {
    const arquivo = await join(pasta, nome, ARQUIVO_DO_RELATORIO)
    if (!(await exists(arquivo))) continue
    let relatorio: unknown
    try {
      relatorio = JSON.parse(await readTextFile(arquivo))
    } catch {
      continue
    }
    if (!ehRegistro(relatorio) || !ehRegistro(relatorio.tabelaDeMidia)) continue
    for (const [chave, midia] of Object.entries(relatorio.tabelaDeMidia)) {
      if (typeof midia === 'string') tabela.set(chave, midia)
    }
  }
  return tabela
}

/** A mídia de um `meta.rel` do Grimório na tabela, com qualquer grafia do caminho. */
export function midiaNaTabela(tabela: ReadonlyMap<string, string>, rel: string): string | null {
  return tabela.get(chaveDoCaminho(rel)) ?? null
}
