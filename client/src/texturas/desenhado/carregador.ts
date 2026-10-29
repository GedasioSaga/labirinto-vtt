import type { ImagemDoLadrilho } from '../meioTermo/chaoNoMundo'
import { abrirFonteDoDesenhado } from './fonte'
import { CASA_PX_DO_DESENHADO, lerTexturaDoChao, type ChaoDesenhado, type IdDoChaoDesenhado, type TexturaDoChao } from './chao'

/**
 * O CARREGADOR DO DESENHADO (plano de 29/10/2026, F1b): baixa os PNG de um chão
 * do pacote (pela `FonteDoDesenhado`, sem saber o canal), decodifica em
 * `ImageData` e guarda para os pedaços pintarem.
 *
 * - Só o que a cena pede: nada é baixado até um renderer perguntar por um id.
 * - Teto de memória comum (CONTRATO.md seção 5): `TETO_POR_MAPA` de imagens
 *   decodificadas (RGBA + mipmaps) por mapa. Trocar de cena deixa as do mapa
 *   anterior soltas: saem quando o mapa novo precisa do espaço. O que não cabe
 *   fica no Atual nesta cena (sem aviso na tela: CONTRATO 10.8 item 4).
 * - Enquanto não chega, quem perguntou pinta o Atual; quando chega, todos os
 *   ouvintes (`assinarDesenhado`) são avisados e repintam. Falhou (rede do
 *   jogador, arquivo faltando): Atual, e a próxima cena tenta de novo.
 * - Nenhum byte vai para a placa aqui: a placa só recebe os pedaços pintados
 *   (o mesmo cache de 64 MB do Meio-Termo).
 */

const MEBIBYTE = 1024 * 1024
/** Teto das imagens decodificadas de UM mapa (CONTRATO.md seção 5: 48 MiB por mapa, 6 por textura). */
export const TETO_POR_MAPA = 48 * MEBIBYTE
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

type Estado =
  | { readonly tipo: 'carregando'; readonly bytes: number }
  | { readonly tipo: 'pronto'; readonly chao: ChaoCarregado }
  | { readonly tipo: 'falhou' }
  | { readonly tipo: 'recusado' }

interface Entrada {
  estado: Estado
  /** A última cena que pediu este id (as de outra cena saem para dar lugar). */
  cena: string
}

const entradas = new Map<IdDoChaoDesenhado, Entrada>()
const ouvintes = new Set<() => void>()
let cenaAtual = ''
/** Sobe a cada chão que fica pronto: entra no estilo da pintura dos renderers (repintam com o que chegou). */
let versao = 0

/** Bytes que a entrada ocupa (ou vai ocupar, enquanto carrega). */
function bytesDe(e: Entrada): number {
  if (e.estado.tipo === 'pronto') return e.estado.chao.bytes
  if (e.estado.tipo === 'carregando') return e.estado.bytes
  return 0
}

/** Memória comum do Desenhado agora (o portão da integração mede este número). */
export function bytesDoDesenhado(): number {
  let soma = 0
  for (const e of entradas.values()) soma += bytesDe(e)
  return soma
}

/** Sobe quando algum chão fica pronto. */
export function versaoDoDesenhado(): number {
  return versao
}

/** Avisado quando um chão fica pronto (quem pintou o Atual no lugar dele repinta). */
export function assinarDesenhado(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

function avisar(): void {
  versao += 1
  for (const o of [...ouvintes]) o()
}

/** O chão já está decodificado? */
export function desenhadoPronto(id: IdDoChaoDesenhado): boolean {
  return entradas.get(id)?.estado.tipo === 'pronto'
}

/** Quanto o chão vai ocupar, pelo `textura.json` (as bases e o atlas, com os mips). */
function bytesPrevistos(t: TexturaDoChao): number {
  const base = t.base.arquivos.length * t.base.ladoPx * t.base.ladoPx * 4
  const atlas = t.detalhes.arquivo === null ? 0 : 512 * 512 * 4
  return Math.ceil((base + atlas) * FATOR_DOS_MIPS)
}

/** Abre espaço para `bytes` soltando os chãos de outras cenas; `false` = nem assim cabe neste mapa. */
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
async function decodificar(url: string): Promise<ImagemDoLadrilho | null> {
  const resposta = await fetch(url)
  if (!resposta.ok) return null
  const bitmap = await createImageBitmap(await resposta.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  try {
    const { width, height } = bitmap
    if (width !== height || width === 0) return null
    const g =
      typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
        : criarTela(width, height)
    if (g === null) return null
    g.drawImage(bitmap, 0, 0)
    return { lado: width, pixels: g.getImageData(0, 0, width, height).data }
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

async function carregar(id: IdDoChaoDesenhado, entrada: Entrada): Promise<void> {
  try {
    const fonte = await abrirFonteDoDesenhado()
    const textura = lerTexturaDoChao(await fonte.textura(id))
    if (textura === null) {
      entrada.estado = { tipo: 'falhou' }
      return
    }
    const bytes = bytesPrevistos(textura)
    if (entradas.get(id) !== entrada) return
    // Reserva antes de baixar: dois pedidos ao mesmo tempo não passam juntos do teto.
    entrada.estado = { tipo: 'carregando', bytes: 0 }
    if (!abrirEspaco(bytes)) {
      entrada.estado = { tipo: 'recusado' }
      console.warn(`[desenhado] '${id}' não cabe no teto de ${TETO_POR_MAPA / MEBIBYTE} MiB deste mapa; fica o Atual`)
      return
    }
    entrada.estado = { tipo: 'carregando', bytes }
    const urls = textura.base.arquivos.map((arquivo) => fonte.urlDe(id, arquivo))
    const urlDoAtlas = textura.detalhes.arquivo === null ? null : fonte.urlDe(id, textura.detalhes.arquivo)
    if (urls.some((u) => u === undefined) || urlDoAtlas === undefined) {
      entrada.estado = { tipo: 'falhou' }
      return
    }
    const bases = await Promise.all(urls.map((u) => (u === undefined ? null : decodificar(u))))
    const atlas = urlDoAtlas === null ? null : await decodificar(urlDoAtlas)
    const prontas: ImagemDoLadrilho[] = []
    for (const b of bases) if (b !== null) prontas.push(b)
    if (prontas.length !== bases.length || (urlDoAtlas !== null && atlas === null)) {
      entrada.estado = { tipo: 'falhou' }
      return
    }
    // Saiu do mapa enquanto baixava (outra cena precisou do espaço): não volta.
    if (entradas.get(id) !== entrada) return
    entrada.estado = { tipo: 'pronto', chao: { id, textura, bases: prontas, atlas: atlas === null ? null : premultiplicar(atlas), bytes } }
    avisar()
  } catch (erro: unknown) {
    entrada.estado = { tipo: 'falhou' }
    console.warn(`[desenhado] '${id}' não carregou; fica o Atual`, erro)
  }
}

/**
 * O chão `id` para a cena `cena` (o `MapData.id`), se já está pronto; senão
 * começa a carregar (se couber no teto deste mapa) e devolve `null`: quem
 * pediu pinta o Atual e repinta no aviso de `assinarDesenhado`.
 */
export function pedirChaoDesenhado(id: IdDoChaoDesenhado, cena: string): ChaoCarregado | null {
  cenaAtual = cena
  const existente = entradas.get(id)
  if (existente !== undefined) {
    const mudouDeCena = existente.cena !== cena
    existente.cena = cena
    if (existente.estado.tipo === 'pronto') return existente.estado.chao
    // Falhou ou não coube noutra cena: este mapa tenta de novo.
    if (!mudouDeCena || existente.estado.tipo === 'carregando') return null
  }
  const entrada: Entrada = { estado: { tipo: 'carregando', bytes: 0 }, cena }
  entradas.set(id, entrada)
  void carregar(id, entrada)
  return null
}

/** O chão carregado pronto para os pedaços de um mapa com `grid` px por casa (e a rampa da sala, no piso). */
export function chaoParaPintar(c: ChaoCarregado, grid: number, rampa: Uint8Array | null): ChaoDesenhado {
  return { tipo: 'desenhado', textura: c.textura, bases: c.bases, atlas: c.atlas, escala: CASA_PX_DO_DESENHADO / grid, rampa }
}
