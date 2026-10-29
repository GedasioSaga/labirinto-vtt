import type { ImagemDoLadrilho } from '../meioTermo/chaoNoMundo'
import { abrirFonteDoDesenhado, type IdDoDesenhado } from './fonte'
import { CASA_PX_DO_DESENHADO, lerTexturaDoChao, type ChaoDesenhado, type IdDoChaoDesenhado, type TexturaDoChao } from './chao'
import { lerReceitaDoTelhado, montarItemDoTelhado, type IdDoTelhadoDesenhado, type ImagemDoItem, type ItemDoTelhado } from './telhado'

/**
 * O CARREGADOR DO DESENHADO (plano de 29/10/2026, F1b e F2a): baixa os PNG de
 * um item do pacote (pela `FonteDoDesenhado`, sem saber o canal), decodifica em
 * `ImageData` e guarda para os renderers pintarem. Itens: os chãos (onda 1) e
 * os telhados, a faixa e o objeto (onda 2).
 *
 * - Só o que a cena pede: nada é baixado até um renderer perguntar por um id.
 * - Teto de memória comum (CONTRATO.md seções 5 e 8.8): `TETO_POR_MAPA` de
 *   imagens decodificadas (RGBA + mipmaps) por mapa, chãos e telhados na mesma
 *   conta. Trocar de cena deixa as do mapa anterior soltas: saem quando o mapa
 *   novo precisa do espaço. O que não cabe fica no Atual nesta cena (sem aviso
 *   na tela: CONTRATO 10.8 item 4).
 * - Enquanto não chega, quem perguntou pinta o Atual; quando chega, todos os
 *   ouvintes (`assinarDesenhado`) são avisados e repintam. Falhou (rede do
 *   jogador, arquivo faltando): Atual, e a próxima cena tenta de novo.
 * - Nenhum byte vai para a placa aqui: a placa só recebe o que os renderers
 *   pintam (os pedaços do chão no cache de 64 MB, a imagem de cada telhado).
 */

const MEBIBYTE = 1024 * 1024
/**
 * Teto das imagens decodificadas de UM mapa (CONTRATO.md seção 5: 96 MiB por
 * mapa, 6 por textura). Era 48; subiu em 29/10/2026 (decisão do orquestrador):
 * o mapa real tem 12 biomas e o piso (68 MiB), e com 48 quatro chãos caíam no Atual.
 */
export const TETO_POR_MAPA = 96 * MEBIBYTE
/** Os mipmaps da CPU (média de 2 x 2) somam um terço à imagem. */
const FATOR_DOS_MIPS = 4 / 3

/** Um chão do pacote, decodificado e pronto para os pedaços. */
export interface ChaoCarregado {
  readonly id: IdDoChaoDesenhado
  readonly textura: TexturaDoChao
  readonly bases: readonly ImagemDoLadrilho[]
  /** RGBA PRÉ-MULTIPLICADO (a conta mistura assim); `null` = a textura não tem detalhes. */
  readonly atlas: ImagemDoLadrilho | null
  /** Memória comum que ele ocupa (imagens + mipmaps). */
  readonly bytes: number
}

/** O que está pronto: um chão ou um item da onda 2. */
type Pronto = { readonly tipo: 'chao'; readonly chao: ChaoCarregado } | { readonly tipo: 'telhado'; readonly item: ItemDoTelhado; readonly bytes: number }

type Estado =
  | { readonly tipo: 'carregando'; readonly bytes: number }
  | { readonly tipo: 'pronto'; readonly pronto: Pronto }
  | { readonly tipo: 'falhou' }
  | { readonly tipo: 'recusado' }

interface Entrada {
  estado: Estado
  /** A última cena que pediu este id (as de outra cena saem para dar lugar). */
  cena: string
}

/** Como ler e montar um tipo de item: os arquivos que ele pede, quanto ocupa e o que vira com as imagens. */
interface Preparo {
  readonly bytes: number
  readonly arquivos: readonly string[]
  readonly montar: (imagens: readonly ImagemDoItem[]) => Pronto | null
}

const entradas = new Map<IdDoDesenhado, Entrada>()
const ouvintes = new Set<() => void>()
let cenaAtual = ''
/** Sobe a cada item que fica pronto: entra no estilo da pintura dos renderers (repintam com o que chegou). */
let versao = 0

function bytesDoPronto(p: Pronto): number {
  return p.tipo === 'chao' ? p.chao.bytes : p.bytes
}

/** Bytes que a entrada ocupa (ou vai ocupar, enquanto carrega). */
function bytesDe(e: Entrada): number {
  if (e.estado.tipo === 'pronto') return bytesDoPronto(e.estado.pronto)
  if (e.estado.tipo === 'carregando') return e.estado.bytes
  return 0
}

/** Memória comum do Desenhado agora (o portão da integração mede este número). */
export function bytesDoDesenhado(): number {
  let soma = 0
  for (const e of entradas.values()) soma += bytesDe(e)
  return soma
}

/** Sobe quando algum item fica pronto. */
export function versaoDoDesenhado(): number {
  return versao
}

/** Avisado quando um item fica pronto (quem pintou o Atual no lugar dele repinta). */
export function assinarDesenhado(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

function avisar(): void {
  versao += 1
  for (const o of [...ouvintes]) o()
}

/** O item já está decodificado? */
export function desenhadoPronto(id: IdDoDesenhado): boolean {
  return entradas.get(id)?.estado.tipo === 'pronto'
}

/** Abre espaço para `bytes` soltando os itens de outras cenas; `false` = nem assim cabe neste mapa. */
function abrirEspaco(bytes: number): boolean {
  let total = bytesDoDesenhado()
  if (total + bytes <= TETO_POR_MAPA) return true
  for (const [id, e] of [...entradas]) {
    if (total + bytes <= TETO_POR_MAPA) break
    if (e.cena === cenaAtual || e.estado.tipo === 'carregando') continue
    total -= bytesDe(e)
    entradas.delete(id)
  }
  return total + bytes <= TETO_POR_MAPA
}

/** Um PNG da fonte em RGBA (alfa reto, como a tela 2D devolve). */
async function decodificar(url: string): Promise<ImagemDoItem | null> {
  const resposta = await fetch(url)
  if (!resposta.ok) return null
  const bitmap = await createImageBitmap(await resposta.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  try {
    const { width, height } = bitmap
    if (width === 0 || height === 0) return null
    const g =
      typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
        : criarTela(width, height)
    if (g === null) return null
    g.drawImage(bitmap, 0, 0)
    return { largura: width, altura: height, pixels: g.getImageData(0, 0, width, height).data }
  } finally {
    bitmap.close()
  }
}

function criarTela(largura: number, altura: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  return tela.getContext('2d', { willReadFrequently: true })
}

/** O atlas em alfa pré-multiplicado, no lugar. */
function premultiplicar(img: ImagemDoLadrilho): ImagemDoLadrilho {
  const p = img.pixels
  for (let o = 0; o < p.length; o += 4) {
    const a = p[o + 3]
    if (a === 255) continue
    p[o] = (p[o] * a) / 255
    p[o + 1] = (p[o + 1] * a) / 255
    p[o + 2] = (p[o + 2] * a) / 255
  }
  return img
}

/** A imagem quadrada que os pedaços do chão leem; outra forma = `null`. */
function ladrilho(img: ImagemDoItem): ImagemDoLadrilho | null {
  return img.largura === img.altura ? { lado: img.largura, pixels: img.pixels } : null
}

/** Quanto o chão vai ocupar, pelo `textura.json` (as bases e o atlas, com os mips). */
function bytesPrevistos(t: TexturaDoChao): number {
  const base = t.base.arquivos.length * t.base.ladoPx * t.base.ladoPx * 4
  const atlas = t.detalhes.arquivo === null ? 0 : 512 * 512 * 4
  return Math.ceil((base + atlas) * FATOR_DOS_MIPS)
}

function prepararChao(id: IdChaoOuTelhado, bruto: unknown): Preparo | null {
  if (id.tipo !== 'chao') return null
  const textura = lerTexturaDoChao(bruto)
  if (textura === null) return null
  const atlas = textura.detalhes.arquivo
  return {
    bytes: bytesPrevistos(textura),
    arquivos: atlas === null ? textura.base.arquivos : [...textura.base.arquivos, atlas],
    montar: (imagens) => {
      const bases: ImagemDoLadrilho[] = []
      for (const img of imagens.slice(0, textura.base.arquivos.length)) {
        const quadrada = ladrilho(img)
        if (quadrada === null) return null
        bases.push(quadrada)
      }
      const doAtlas = atlas === null ? null : imagens[textura.base.arquivos.length]
      const quadrado = doAtlas === undefined || doAtlas === null ? null : ladrilho(doAtlas)
      if (atlas !== null && quadrado === null) return null
      const chao: ChaoCarregado = { id: id.id, textura, bases, atlas: quadrado === null ? null : premultiplicar(quadrado), bytes: bytesPrevistos(textura) }
      return { tipo: 'chao', chao }
    },
  }
}

function prepararTelhado(id: IdChaoOuTelhado, bruto: unknown): Preparo | null {
  if (id.tipo !== 'telhado') return null
  const receita = lerReceitaDoTelhado(id.id, bruto)
  if (receita === null) return null
  return {
    bytes: receita.bytes,
    arquivos: receita.arquivos,
    montar: (imagens) => {
      const item = montarItemDoTelhado(receita, imagens)
      return item === null ? null : { tipo: 'telhado', item, bytes: receita.bytes }
    },
  }
}

type IdChaoOuTelhado = { readonly tipo: 'chao'; readonly id: IdDoChaoDesenhado } | { readonly tipo: 'telhado'; readonly id: IdDoTelhadoDesenhado }

async function carregar(qual: IdChaoOuTelhado, entrada: Entrada): Promise<void> {
  const { id } = qual
  try {
    const fonte = await abrirFonteDoDesenhado()
    const bruto = await fonte.textura(id)
    const preparo = qual.tipo === 'chao' ? prepararChao(qual, bruto) : prepararTelhado(qual, bruto)
    if (preparo === null) {
      entrada.estado = { tipo: 'falhou' }
      return
    }
    if (entradas.get(id) !== entrada) return
    // Reserva antes de baixar: dois pedidos ao mesmo tempo não passam juntos do teto.
    entrada.estado = { tipo: 'carregando', bytes: 0 }
    if (!abrirEspaco(preparo.bytes)) {
      entrada.estado = { tipo: 'recusado' }
      console.warn(`[desenhado] '${id}' não cabe no teto de ${TETO_POR_MAPA / MEBIBYTE} MiB deste mapa; fica o Atual`)
      return
    }
    entrada.estado = { tipo: 'carregando', bytes: preparo.bytes }
    const urls: string[] = []
    for (const arquivo of preparo.arquivos) {
      const url = fonte.urlDe(id, arquivo)
      if (url === undefined) {
        entrada.estado = { tipo: 'falhou' }
        return
      }
      urls.push(url)
    }
    const lidas = await Promise.all(urls.map(decodificar))
    const imagens: ImagemDoItem[] = []
    for (const img of lidas) if (img !== null) imagens.push(img)
    const pronto = imagens.length === lidas.length ? preparo.montar(imagens) : null
    if (pronto === null) {
      entrada.estado = { tipo: 'falhou' }
      return
    }
    // Saiu do mapa enquanto baixava (outra cena precisou do espaço): não volta.
    if (entradas.get(id) !== entrada) return
    entrada.estado = { tipo: 'pronto', pronto }
    avisar()
  } catch (erro: unknown) {
    entrada.estado = { tipo: 'falhou' }
    console.warn(`[desenhado] '${id}' não carregou; fica o Atual`, erro)
  }
}

/** O item pronto para a cena, ou `null` (começa a carregar, se couber no teto deste mapa). */
function pedir(qual: IdChaoOuTelhado, cena: string): Pronto | null {
  cenaAtual = cena
  const existente = entradas.get(qual.id)
  if (existente !== undefined) {
    const mudouDeCena = existente.cena !== cena
    existente.cena = cena
    if (existente.estado.tipo === 'pronto') return existente.estado.pronto
    // Falhou ou não coube noutra cena: este mapa tenta de novo.
    if (!mudouDeCena || existente.estado.tipo === 'carregando') return null
  }
  const entrada: Entrada = { estado: { tipo: 'carregando', bytes: 0 }, cena }
  entradas.set(qual.id, entrada)
  void carregar(qual, entrada)
  return null
}

/**
 * O chão `id` para a cena `cena` (o `MapData.id`), se já está pronto; senão
 * começa a carregar (se couber no teto deste mapa) e devolve `null`: quem
 * pediu pinta o Atual e repinta no aviso de `assinarDesenhado`.
 */
export function pedirChaoDesenhado(id: IdDoChaoDesenhado, cena: string): ChaoCarregado | null {
  const pronto = pedir({ tipo: 'chao', id }, cena)
  return pronto?.tipo === 'chao' ? pronto.chao : null
}

/** O telhado, a faixa ou o objeto `id` (onda 2) para a cena, como `pedirChaoDesenhado`. */
export function pedirItemDoTelhado(id: IdDoTelhadoDesenhado, cena: string): ItemDoTelhado | null {
  const pronto = pedir({ tipo: 'telhado', id }, cena)
  return pronto?.tipo === 'telhado' ? pronto.item : null
}

/** O chão carregado pronto para os pedaços de um mapa com `grid` px por casa (e a rampa da sala, no piso). */
export function chaoParaPintar(c: ChaoCarregado, grid: number, rampa: Uint8Array | null): ChaoDesenhado {
  return { tipo: 'desenhado', textura: c.textura, bases: c.bases, atlas: c.atlas, escala: CASA_PX_DO_DESENHADO / grid, rampa }
}
