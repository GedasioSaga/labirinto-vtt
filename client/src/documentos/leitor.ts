/**
 * A LEITURA DO DOCUMENTO vindo de fora (plano §1.5, §1.7): o índice da
 * biblioteca no disco e a lista na ficha (`adventure.json`, o Lobby). Tudo é
 * entrada hostil: arquivo editado à mão, versão de outro app.
 *
 * A regra é a dos outros leitores (`puzzles/leitor.ts`, `lib/personagem.ts`):
 * campo torto vira o padrão, campo a campo, e o documento continua; texto é
 * cortado no teto; imagem só como referência de mídia (`midia:<id>`), nunca
 * `data:`. Só o que não dá para ler de jeito nenhum (sem id) volta `null`.
 *
 * Este arquivo fica LEVE de propósito: `lib/personagem.ts` o importa, e o
 * fecho dos imports da ficha vai até o Worker do Lobby (`lib/nuvem/pureza.test.ts`).
 * O papel no chão (`DocumentoNoMapa`) é lido em `lib/mapFile.ts`, junto do
 * lugar do desafio e do piso, que puxam o mapa inteiro.
 */
import { ehIdDeItemDoAcervo } from '../lib/leituraDoItem'
import { ehRefDeMidia } from '../lib/midia'
import {
  ARTES_DO_DOCUMENTO,
  ASSINATURA_MAX,
  CHAVES_DO_TRECHO_MAX,
  DE_ONDE_MAX,
  DOCUMENTOS_NA_FICHA_MAX,
  extrasPadrao,
  FORMA_DO_ID_DO_TRECHO,
  LETRAS_DO_DOCUMENTO,
  MANCHAS_DO_PAPEL,
  MOSTRAS_DO_TRECHO,
  ORIGENS_DO_DOCUMENTO,
  PAGINAS_DO_DOCUMENTO_MAX,
  PAPEIS_DO_DOCUMENTO,
  PAPEL_PADRAO,
  TEXTO_CIFRADO_MAX,
  TEXTO_CLARO_MAX,
  TEXTO_DA_PAGINA_MAX,
  TEXTO_DO_CARIMBO_MAX,
  TINTAS_DO_DOCUMENTO,
  TITULO_DO_DOCUMENTO_MAX,
  TRECHOS_MAX,
  VERSAO_DO_DOCUMENTO,
} from './tipos'
import type {
  ArteDoDocumento,
  BrasaoDoDocumento,
  DesgasteDoPapel,
  Documento,
  DocumentoNaFicha,
  ExtrasDoDocumento,
  PaginaDoDocumento,
  PapelDoDocumento,
  SeloDoDocumento,
  TrechoProtegido,
} from './tipos'

/** Id de documento: a forma dos ids do app (o mesmo `idLido` da dica do puzzle, `puzzles/leitor.ts`), num teto. */
const FORMA_DO_ID = /^[A-Za-z0-9_-]{1,80}$/
/** Nomes que, como chave de um objeto, mexem no protótipo dele em vez de guardar um valor. */
const IDS_PROIBIDOS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
const COR = /^#[0-9a-fA-F]{6}$/
/** As cores de um selo novo no protótipo: a primeira cera e a primeira tinta de carimbo. */
const COR_DA_CERA_PADRAO = '#8e2a22'
const COR_DO_CARIMBO_PADRAO = '#33508f'
const ARTE_DA_CERA_PADRAO: ArteDoDocumento = 'rosa'
const ARTE_DO_CARIMBO_PADRAO: ArteDoDocumento = 'torre'
const ORIGEM_PADRAO: DocumentoNaFicha['origem'] = 'mestre'

// ------------------------------------------------------------------ peças pequenas

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Corta em `max` unidades UTF-16 sem deixar meio emoji no fim (como `lib/leituraDoItem.ts`). */
function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

/** Texto aparado no teto; o vazio vale. Não é texto: o vazio. */
function textoAparado(valor: unknown, max: number): string {
  return typeof valor === 'string' ? cortado(valor.trim(), max) : ''
}

/** Texto como o mestre o escreveu (espaços e quebras de linha contam), só cortado no teto. */
function textoCru(valor: unknown, max: number): string {
  return typeof valor === 'string' ? cortado(valor, max) : ''
}

function umDaLista<T>(lista: readonly T[], valor: unknown, padrao: T): T {
  return lista.find((item) => item === valor) ?? padrao
}

/** Instante gravado (ms desde 1970); torto = `padrao`. */
function instanteLido(valor: unknown, padrao: number): number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 ? valor : padrao
}

function imagemLida(valor: unknown): string | null {
  return ehRefDeMidia(valor) ? valor : null
}

function corLida(valor: unknown): string | null {
  return typeof valor === 'string' && COR.test(valor) ? valor : null
}

/** O id de um documento (da biblioteca, do papel no mapa, da lista da ficha): a forma dos do app, fora dos nomes proibidos. */
export function ehIdDeDocumento(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMA_DO_ID.test(valor) && !IDS_PROIBIDOS.has(valor)
}

/** O id de um trecho protegido, como a marca do texto o leva (`{{cifra:c1}}`). */
export function ehIdDeTrecho(valor: string): boolean {
  return FORMA_DO_ID_DO_TRECHO.test(valor) && !IDS_PROIBIDOS.has(valor)
}

export function lerPapel(valor: unknown): PapelDoDocumento {
  return umDaLista(PAPEIS_DO_DOCUMENTO, valor, PAPEL_PADRAO)
}

// ------------------------------------------------------------------ o documento da biblioteca

/**
 * Um documento do índice da biblioteca. Sem id ele sai (o papel no mapa e a
 * lista da ficha o acham pelo id); o resto torto vira o padrão, campo a campo.
 * Versão maior que a deste app fica como veio (não é rebaixada); a menor sobe
 * para a de agora, com a migração de cada passo (a 1 é a primeira: nada a migrar).
 */
export function lerDocumento(valor: unknown): Documento | null {
  if (!isRecord(valor) || !ehIdDeDocumento(valor.id)) return null
  const versaoLida = typeof valor.versao === 'number' && Number.isSafeInteger(valor.versao) ? valor.versao : VERSAO_DO_DOCUMENTO
  const criadoEm = instanteLido(valor.criadoEm, 0)
  return {
    id: valor.id,
    versao: Math.max(versaoLida, VERSAO_DO_DOCUMENTO),
    titulo: textoAparado(valor.titulo, TITULO_DO_DOCUMENTO_MAX),
    papel: lerPapel(valor.papel),
    imagemDoPapel: imagemLida(valor.imagemDoPapel),
    paginas: lerPaginas(valor.paginas),
    // O id do modelo de puzzle tem a mesma forma (o `FORMA_DO_ID` de `puzzles/meusPuzzles.ts`).
    dicaDe: ehIdDeDocumento(valor.dicaDe) ? valor.dicaDe : null,
    extras: lerExtras(valor.extras),
    trechos: lerTrechos(valor.trechos),
    criadoEm,
    mudadoEm: instanteLido(valor.mudadoEm, criadoEm),
  }
}

/** De 1 a `PAGINAS_DO_DOCUMENTO_MAX`: sem nenhuma página boa, o documento fica com uma em branco. */
function lerPaginas(valor: unknown): PaginaDoDocumento[] {
  const lidas = Array.isArray(valor) ? valor.flatMap((pagina) => (isRecord(pagina) ? [lerPagina(pagina)] : [])).slice(0, PAGINAS_DO_DOCUMENTO_MAX) : []
  return lidas.length === 0 ? [{ texto: '', imagem: null }] : lidas
}

function lerPagina(valor: Record<string, unknown>): PaginaDoDocumento {
  return { texto: textoCru(valor.texto, TEXTO_DA_PAGINA_MAX), imagem: imagemLida(valor.imagem) }
}

/** Os extras (§1.5.1): o que não é objeto vira o padrão inteiro; o subcampo torto, o padrão dele. */
function lerExtras(valor: unknown): ExtrasDoDocumento {
  const padrao = extrasPadrao()
  if (!isRecord(valor)) return padrao
  const assinatura = textoAparado(valor.assinatura, ASSINATURA_MAX)
  return {
    letra: umDaLista(LETRAS_DO_DOCUMENTO, valor.letra, padrao.letra),
    tinta: umDaLista(TINTAS_DO_DOCUMENTO, valor.tinta, padrao.tinta),
    desgaste: lerDesgaste(valor.desgaste, padrao.desgaste),
    selo: lerSelo(valor.selo),
    assinatura: assinatura === '' ? null : assinatura,
    brasao: lerBrasao(valor.brasao),
  }
}

function lerDesgaste(valor: unknown, padrao: DesgasteDoPapel): DesgasteDoPapel {
  if (!isRecord(valor)) return padrao
  return {
    cor: corLida(valor.cor),
    manchas: umDaLista(MANCHAS_DO_PAPEL, valor.manchas, padrao.manchas),
    bordaQueimada: valor.bordaQueimada === true,
    dobras: valor.dobras === true,
    rasgos: valor.rasgos === true,
  }
}

/**
 * Selo de tipo desconhecido sai (sem selo); cor e desenho tortos viram os do
 * selo novo do protótipo. A imagem própria é a do brasão: `arte: null` e a
 * `midia:<id>`. O selo gravado antes dela não tem `imagem` e lê como desenho.
 */
function lerSelo(valor: unknown): SeloDoDocumento | null {
  if (!isRecord(valor)) return null
  const imagem = imagemLida(valor.imagem)
  if (valor.tipo === 'cera') {
    return { tipo: 'cera', cor: corLida(valor.cor) ?? COR_DA_CERA_PADRAO, arte: arteDoSelo(valor.arte, ARTE_DA_CERA_PADRAO), imagem }
  }
  if (valor.tipo === 'carimbo') {
    return {
      tipo: 'carimbo',
      cor: corLida(valor.cor) ?? COR_DO_CARIMBO_PADRAO,
      arte: arteDoSelo(valor.arte, ARTE_DO_CARIMBO_PADRAO),
      imagem,
      texto: textoAparado(valor.texto, TEXTO_DO_CARIMBO_MAX),
    }
  }
  return null
}

/** `null` gravado = a imagem própria (com ou sem a imagem ainda); desenho torto ou ausente = o padrão do tipo. */
function arteDoSelo(valor: unknown, padrao: ArteDoDocumento): ArteDoDocumento | null {
  return valor === null ? null : umDaLista(ARTES_DO_DOCUMENTO, valor, padrao)
}

/** Brasão: o desenho conhecido ou a imagem de mídia; os dois ausentes é o "Imagem" ainda sem a imagem (vale). */
function lerBrasao(valor: unknown): BrasaoDoDocumento | null {
  if (!isRecord(valor)) return null
  const arte = ARTES_DO_DOCUMENTO.find((candidata) => candidata === valor.arte) ?? null
  return { arte, imagem: imagemLida(valor.imagem) }
}

/**
 * Os trechos protegidos, pelo id da marca. Id fora da forma (ou nome que
 * mexeria no protótipo do objeto) sai; trecho de tipo desconhecido sai; no
 * máximo `TRECHOS_MAX`. O claro e o cifrado ficam como o mestre escreveu,
 * só cortados no teto.
 */
function lerTrechos(valor: unknown): Record<string, TrechoProtegido> {
  if (!isRecord(valor)) return {}
  const bons: [string, TrechoProtegido][] = []
  for (const [id, cru] of Object.entries(valor)) {
    if (bons.length >= TRECHOS_MAX) break
    if (!ehIdDeTrecho(id)) continue
    const trecho = lerTrecho(cru)
    if (trecho !== null) bons.push([id, trecho])
  }
  return Object.fromEntries(bons)
}

function lerTrecho(valor: unknown): TrechoProtegido | null {
  if (!isRecord(valor)) return null
  const claro = textoCru(valor.claro, TEXTO_CLARO_MAX)
  if (valor.tipo === 'borrado') return { tipo: 'borrado', claro }
  if (valor.tipo !== 'cifra') return null
  const chaves = Array.isArray(valor.chaves) ? [...new Set(valor.chaves.filter(ehIdDeItemDoAcervo))].slice(0, CHAVES_DO_TRECHO_MAX) : []
  return {
    tipo: 'cifra',
    claro,
    mostra: umDaLista(MOSTRAS_DO_TRECHO, valor.mostra, 'embaralhado'),
    textoCifrado: textoCru(valor.textoCifrado, TEXTO_CIFRADO_MAX),
    chaves,
  }
}

// ------------------------------------------------------------------ a lista na ficha

/** Uma linha da lista da ficha. Sem `docId` ela sai; o resto torto vira o padrão (título vazio, papel e origem padrão). */
export function lerDocumentoNaFicha(valor: unknown): DocumentoNaFicha | null {
  if (!isRecord(valor) || !ehIdDeDocumento(valor.docId)) return null
  const linha: DocumentoNaFicha = {
    docId: valor.docId,
    titulo: textoAparado(valor.titulo, TITULO_DO_DOCUMENTO_MAX),
    papel: lerPapel(valor.papel),
    em: instanteLido(valor.em, 0),
    origem: umDaLista(ORIGENS_DO_DOCUMENTO, valor.origem, ORIGEM_PADRAO),
  }
  // Ausentes continuam ausentes (nada de `de: undefined` gravado de volta).
  const de = textoAparado(valor.de, DE_ONDE_MAX)
  if (de !== '') linha.de = de
  if (valor.novo === true) linha.novo = true
  return linha
}

/**
 * `Personagem.documentos` do disco ou da rede. Ausente, que não é lista ou
 * sem nenhuma linha boa = `undefined` (a ficha grava sem a chave, como a
 * mochila vazia). O mesmo documento duas vezes: a primeira linha vence. Acima
 * de `DOCUMENTOS_NA_FICHA_MAX`, ficam as mais novas (o fim da lista).
 */
export function lerDocumentosDaFicha(valor: unknown): DocumentoNaFicha[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const vistos = new Set<string>()
  const lidas: DocumentoNaFicha[] = []
  for (const cru of valor) {
    const linha = lerDocumentoNaFicha(cru)
    if (linha === null || vistos.has(linha.docId)) continue
    vistos.add(linha.docId)
    lidas.push(linha)
  }
  return lidas.length === 0 ? undefined : lidas.slice(-DOCUMENTOS_NA_FICHA_MAX)
}
