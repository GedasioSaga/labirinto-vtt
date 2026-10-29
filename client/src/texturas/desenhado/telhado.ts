import { amostrarAgua, BEIRAL_PX, cruzamentosDaLinha, novaAmostraDaAgua, prepararAguas, type PontoDoTelhado } from '../../lib/telhado/aguas'
import type { ModeloDoTeto } from '../../lib/telhado/paletas'
import { posicaoDaChamine } from '../meioTermo/chamine'
import { ehCumeeira, posicaoAoLongoDoCume } from '../meioTermo/cumeeiraAmarrada'
import { ruidoDoMundo } from '../meioTermo/ruidoDoMundo'
import { escalaDoTelhado, type ImagemDoTelhado, type PinturaDoTelhado } from '../telhado'
import { CASA_PX_DO_DESENHADO, campo, lerTingir, numero, numeros, texto, textos } from './chao'
import { TINGIR_PADRAO, type ContaDeTingir } from './tingir'

/**
 * TELHADO DESENHADO (onda 2 do pacote, CONTRATO.md seção 8; plano de 29/10/2026,
 * F2a): a montagem da seção 8.4, porta fiel de `campoDoTelhado`, `tingirCampo`
 * e `porObjeto` de `godot/desenhado/ferramentas/telhado.ts` (a referência que
 * gera a folha aprovada), sem I/O. O renderer (`pixi/telhadosRenderer.ts`) só
 * troca o desenho dentro da imagem de cada sala: águas, sombra, sumir ao entrar,
 * cache e fatias continuam os de hoje.
 *
 * Diferenças da referência, todas neutras a 1 px por px do mapa e grade de 64:
 * - `escala` (pixels da imagem por px do mapa, a sala enorme fica com menos):
 *   o centro do pixel, o alcance do beiral, a borda suavizada e a mistura na
 *   emenda andam em pixel da imagem, como em `comecarTelhado`;
 * - `grid` diferente de 64: as medidas do pacote são em px do Desenhado (64 por
 *   casa), então tudo o que lê a arte (base, faixa, beiral, rincão, ruído) passa
 *   por `CASA_PX_DO_DESENHADO / grid`, como o chão (`chaoParaPintar`). A chaminé
 *   fica no tamanho que o app dá (`posicaoDaChamine`, em px do mapa).
 */

/** Os itens da onda 2: 3 telhados, a faixa avulsa da palha e o objeto. */
export const TELHADOS_DO_DESENHADO = ['telhado-telhas', 'telhado-madeira', 'telhado-palha', 'cumeeira-amarrada', 'chamine'] as const
export type IdDoTelhadoDesenhado = (typeof TELHADOS_DO_DESENHADO)[number]

const IDS_DA_ONDA_2: ReadonlySet<string> = new Set(TELHADOS_DO_DESENHADO)

export function ehItemDoTelhado(id: string): id is IdDoTelhadoDesenhado {
  return IDS_DA_ONDA_2.has(id)
}

/** O telhado do pacote para o modelo do app. */
export function idDoTelhadoDoModelo(modelo: ModeloDoTeto): IdDoTelhadoDesenhado {
  if (modelo === 'madeira') return 'telhado-madeira'
  if (modelo === 'palha') return 'telhado-palha'
  return 'telhado-telhas'
}

/** RGBA de alfa reto (como a tela 2D devolve), de qualquer forma. */
export interface ImagemDoItem {
  readonly largura: number
  readonly altura: number
  readonly pixels: Uint8ClampedArray
}

/** A faixa repetível (cumeeira, espigão), seção 8.7. */
export interface FaixaDoPacote {
  readonly imagem: ImagemDoItem
  readonly comprimentoPx: number
  readonly meiaLarguraPx: number
  /** px da imagem por px do Desenhado (`pxPorCasa / 64`). */
  readonly pxPorPx: number
  readonly onde: ReadonlySet<string>
  /** `luz.lado` de quem trouxe a faixa (o telhado, ou a faixa avulsa). */
  readonly ganhoLado: number
}

export interface TelhadoDoPacote {
  readonly tipo: 'telhado'
  readonly id: IdDoTelhadoDesenhado
  readonly bases: readonly ImagemDoItem[]
  readonly ladoPx: number
  readonly mistura: { readonly semente: number; readonly escala: number; readonly faixa: number; readonly corte: number }
  readonly tom: { readonly semente: number; readonly escala: number; readonly amplitude: number }
  readonly luz: { readonly agua: number; readonly lado: number }
  readonly beiral: { readonly escuro: number; readonly alturaPx: number; readonly franjaPx: number; readonly franjaPassoPx: number }
  readonly rincao: { readonly escuro: number; readonly larguraPx: number }
  readonly tingir: ContaDeTingir
  /** A faixa do próprio telhado (telha e tábua de cumeeira); `null` = sem faixa ou vem de outro item. */
  readonly faixa: FaixaDoPacote | null
  /** `"faixa": { "de": id }` (a palha pega a cumeeira amarrada). */
  readonly faixaDe: IdDoTelhadoDesenhado | null
}

export interface FaixaAvulsa {
  readonly tipo: 'faixa'
  readonly id: IdDoTelhadoDesenhado
  readonly faixa: FaixaDoPacote
}

export interface ObjetoDoPacote {
  readonly tipo: 'objeto'
  readonly id: IdDoTelhadoDesenhado
  readonly imagem: ImagemDoItem
  /** Lado do corpo na imagem, px; e o centro do corpo na imagem, px. */
  readonly corpoPx: number
  readonly ancoraX: number
  readonly ancoraY: number
}

export type ItemDoTelhado = TelhadoDoPacote | FaixaAvulsa | ObjetoDoPacote

/** O que pintar: o telhado, a faixa das emendas (dele ou avulsa) e a chaminé (se a sala pede). */
export interface DesenhoDoTelhado {
  readonly telhado: TelhadoDoPacote
  readonly faixa: FaixaDoPacote | null
  readonly objeto: ObjetoDoPacote | null
}

// ---------- leitura do textura.json (dado de fora: confere cada campo) ----------

const MEBIBYTE = 1024 * 1024
/** O teto por item da seção 8.8, para o `textura.json` sem `memoria.gpuBytes`. */
const TETO_POR_ITEM = 6 * MEBIBYTE

interface FaixaLida {
  readonly arquivo: string
  readonly comprimentoPx: number
  readonly meiaLarguraPx: number
  readonly pxPorCasa: number
  readonly onde: readonly string[]
}

type Partes =
  | { readonly tipo: 'telhado'; readonly bases: number; readonly dados: Omit<TelhadoDoPacote, 'bases' | 'faixa'>; readonly faixa: FaixaLida | null }
  | { readonly tipo: 'faixa'; readonly faixa: FaixaLida; readonly ganhoLado: number }
  | { readonly tipo: 'objeto'; readonly corpoPx: number; readonly ancoraX: number; readonly ancoraY: number }

/** O item lido do `textura.json`, antes das imagens: o que baixar e quanto vai ocupar. */
export interface ReceitaDoTelhado {
  readonly id: IdDoTelhadoDesenhado
  readonly bytes: number
  /** Os PNG, na ordem em que `montarItemDoTelhado` os espera. */
  readonly arquivos: readonly string[]
  readonly partes: Partes
}

function lerFaixa(bruto: unknown): FaixaLida | null {
  const arquivo = texto(bruto, 'arquivo')
  const comprimentoPx = numero(bruto, 'comprimentoPx')
  const meiaLarguraPx = numero(bruto, 'meiaLarguraPx')
  const pxPorCasa = numero(bruto, 'pxPorCasa')
  const onde = textos(bruto, 'onde')
  if (arquivo === null || comprimentoPx === null || meiaLarguraPx === null || pxPorCasa === null || onde === null) return null
  if (!(comprimentoPx > 0 && meiaLarguraPx > 0 && pxPorCasa > 0)) return null
  return { arquivo, comprimentoPx, meiaLarguraPx, pxPorCasa, onde }
}

/** Os números de um bloco, todos ou nenhum. */
function bloco<K extends string>(bruto: unknown, chaves: readonly K[]): Record<K, number> | null {
  const saida: Partial<Record<K, number>> = {}
  for (const k of chaves) {
    const v = numero(bruto, k)
    if (v === null) return null
    saida[k] = v
  }
  // Todas as chaves conferidas no laço acima: o objeto parcial está completo.
  return saida as Record<K, number> // as: Partial com todas as chaves preenchidas logo acima
}

function lerTelhado(id: IdDoTelhadoDesenhado, bruto: unknown): Partes | null {
  const base = campo(bruto, 'base')
  const arquivos = textos(base, 'arquivos')
  const ladoPx = numero(base, 'ladoPx')
  const mistura = bloco(campo(bruto, 'mistura'), ['semente', 'escala', 'faixa', 'corte'])
  const tom = bloco(campo(bruto, 'tom'), ['semente', 'escala', 'amplitude'])
  const luz = bloco(campo(bruto, 'luz'), ['agua', 'lado'])
  const beiral = bloco(campo(bruto, 'beiral'), ['escuro', 'alturaPx', 'franjaPx', 'franjaPassoPx'])
  const rincao = bloco(campo(bruto, 'rincao'), ['escuro', 'larguraPx'])
  if (arquivos === null || arquivos.length < 1 || arquivos.length > 3 || ladoPx === null || !(ladoPx > 0)) return null
  if (mistura === null || tom === null || luz === null || beiral === null || rincao === null) return null
  const brutoDaFaixa = campo(bruto, 'faixa')
  const de = texto(brutoDaFaixa, 'de')
  const faixa = brutoDaFaixa === undefined || brutoDaFaixa === null || de !== null ? null : lerFaixa(brutoDaFaixa)
  // Faixa que não lê (campo faltando) com arquivo: o item inteiro não serve (fica o Atual).
  if (brutoDaFaixa !== undefined && brutoDaFaixa !== null && de === null && faixa === null) return null
  const faixaDe = de !== null && ehItemDoTelhado(de) ? de : null
  const dados: Omit<TelhadoDoPacote, 'bases' | 'faixa'> = {
    tipo: 'telhado',
    id,
    ladoPx,
    mistura,
    tom,
    luz,
    beiral,
    rincao,
    tingir: lerTingir(campo(bruto, 'tingir')) ?? TINGIR_PADRAO,
    faixaDe,
  }
  return { tipo: 'telhado', bases: arquivos.length, dados, faixa }
}

function arquivosDe(partes: Partes, bruto: unknown): string[] {
  if (partes.tipo === 'telhado') {
    const bases = textos(campo(bruto, 'base'), 'arquivos') ?? []
    return partes.faixa === null ? bases : [...bases, partes.faixa.arquivo]
  }
  if (partes.tipo === 'faixa') return [partes.faixa.arquivo]
  const arquivo = texto(campo(bruto, 'objeto'), 'arquivo')
  return arquivo === null ? [] : [arquivo]
}

/** O `textura.json` de um item da onda 2, conferido; campo faltando ou de outro tipo = `null` (fica o Atual). */
export function lerReceitaDoTelhado(id: IdDoTelhadoDesenhado, bruto: unknown): ReceitaDoTelhado | null {
  if (numero(bruto, 'contrato') !== 1 || texto(bruto, 'id') !== id) return null
  const tipo = texto(bruto, 'tipo')
  let partes: Partes | null = null
  if (tipo === 'telhado') partes = lerTelhado(id, bruto)
  else if (tipo === 'faixa') {
    const faixa = lerFaixa(campo(bruto, 'faixa'))
    const ganhoLado = numero(campo(bruto, 'luz'), 'lado')
    partes = faixa === null || ganhoLado === null ? null : { tipo: 'faixa', faixa, ganhoLado }
  } else if (tipo === 'objeto') {
    const objeto = campo(bruto, 'objeto')
    const corpoPx = numero(objeto, 'corpoPx')
    const ancora = numeros(objeto, 'ancoraPx')
    partes = corpoPx === null || !(corpoPx > 0) || ancora === null || ancora.length !== 2 ? null : { tipo: 'objeto', corpoPx, ancoraX: ancora[0], ancoraY: ancora[1] }
  }
  if (partes === null) return null
  const arquivos = arquivosDe(partes, bruto)
  if (arquivos.length === 0) return null
  const gpu = numero(campo(bruto, 'memoria'), 'gpuBytes')
  return { id, bytes: gpu !== null && gpu > 0 ? gpu : TETO_POR_ITEM, arquivos, partes }
}

function faixaDoPacote(f: FaixaLida, imagem: ImagemDoItem, ganhoLado: number): FaixaDoPacote {
  return { imagem, comprimentoPx: f.comprimentoPx, meiaLarguraPx: f.meiaLarguraPx, pxPorPx: f.pxPorCasa / CASA_PX_DO_DESENHADO, onde: new Set(f.onde), ganhoLado }
}

/** O item com as imagens na ordem de `receita.arquivos`; imagem faltando ou de outra forma = `null`. */
export function montarItemDoTelhado(receita: ReceitaDoTelhado, imagens: readonly ImagemDoItem[]): ItemDoTelhado | null {
  if (imagens.length !== receita.arquivos.length) return null
  const { partes } = receita
  if (partes.tipo === 'telhado') {
    const bases = imagens.slice(0, partes.bases)
    const L = partes.dados.ladoPx
    if (bases.some((b) => b.largura !== L || b.altura !== L)) return null
    const daFaixa = partes.faixa === null ? undefined : imagens[partes.bases]
    const faixa = partes.faixa === null || daFaixa === undefined ? null : faixaDoPacote(partes.faixa, daFaixa, partes.dados.luz.lado)
    return { ...partes.dados, bases, faixa }
  }
  const [imagem] = imagens
  if (partes.tipo === 'faixa') return { tipo: 'faixa', id: receita.id, faixa: faixaDoPacote(partes.faixa, imagem, partes.ganhoLado) }
  return { tipo: 'objeto', id: receita.id, imagem, corpoPx: partes.corpoPx, ancoraX: partes.ancoraX, ancoraY: partes.ancoraY }
}

// ---------- a conta (CONTRATO.md, seção 8.4) ----------

/** A luz do app (`texturas/telhado.ts`): de cima à esquerda, mais da esquerda. */
const LUZ_X = -1 / Math.hypot(1, 0.45)
const LUZ_Y = -0.45 / Math.hypot(1, 0.45)

function suave(a: number, b: number, t: number): number {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1)
  return x * x * (3 - 2 * x)
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** Canal `k` (0..1) no ponto (x, y) da imagem, bilinear, centros de pixel em +0,5; `rodaX`/`rodaY` repetem. */
function bilinear(img: ImagemDoItem, x: number, y: number, k: number, rodaX: boolean, rodaY: boolean): number {
  const w = img.largura
  const h = img.altura
  const fx = x - 0.5
  const fy = y - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const a = rodaX ? mod(x0, w) : Math.min(Math.max(x0, 0), w - 1)
  const b = rodaX ? mod(x0 + 1, w) : Math.min(Math.max(x0 + 1, 0), w - 1)
  const c = rodaY ? mod(y0, h) : Math.min(Math.max(y0, 0), h - 1)
  const e = rodaY ? mod(y0 + 1, h) : Math.min(Math.max(y0 + 1, 0), h - 1)
  const p = img.pixels
  const ac = p[(c * w + a) * 4 + k]
  const bc = p[(c * w + b) * 4 + k]
  const ae = p[(e * w + a) * 4 + k]
  const be = p[(e * w + b) * 4 + k]
  return ((ac * (1 - tx) + bc * tx) * (1 - ty) + (ae * (1 - tx) + be * tx) * ty) / 255
}

/** Pesos das variantes no ponto do mundo: a mesma conta do chão (seção 4). */
function pesos(m: TelhadoDoPacote['mistura'], n: number, quantas: number, saida: Float64Array): void {
  if (quantas === 1) {
    saida[0] = 1
    saida[1] = 0
    saida[2] = 0
    return
  }
  if (quantas === 2) {
    const t = suave(-m.faixa, m.faixa, n)
    saida[0] = 1 - t
    saida[1] = t
    saida[2] = 0
    return
  }
  const w1 = 1 - suave(-m.corte - m.faixa, -m.corte + m.faixa, n)
  const w3 = suave(m.corte - m.faixa, m.corte + m.faixa, n)
  saida[0] = w1
  saida[1] = 1 - w1 - w3
  saida[2] = w3
}

/** O recuo da franja do beiral (px do Desenhado), a fórmula da palha do app com outro tamanho. */
function franja(t: TelhadoDoPacote, u: number): number {
  if (t.beiral.franjaPx <= 0) return 0
  const meia = t.beiral.franjaPx / 2
  return meia + meia * Math.sin(u * ((2 * Math.PI) / t.beiral.franjaPassoPx) + 0.9 * Math.sin(u * 0.83))
}

/**
 * O telhado Desenhado do polígono (px do mapa), na cor da `rampa` (256 x RGB,
 * `tingir.ts`), na mesma caixa e na mesma varredura de linha de `comecarTelhado`.
 * Pintar de uma vez ou em fatias de linhas dá os mesmos bytes.
 */
export function comecarTelhadoDesenhado(poligono: readonly PontoDoTelhado[], desenho: DesenhoDoTelhado, rampa: Uint8Array, escala: number, grid: number): PinturaDoTelhado {
  const preparada = prepararAguas(poligono)
  if (preparada === null) {
    const vazia: ImagemDoTelhado = { largura: 0, altura: 0, origemX: 0, origemY: 0, escala: escalaDoTelhado(1, 1, escala), pixels: new Uint8ClampedArray(0) }
    return { imagem: vazia, pintarLinhas: () => true }
  }
  // Num `const` próprio: as funções da varredura (declaradas abaixo) não herdam o estreitamento do `if`.
  const geo = preparada
  const { telhado: tex, faixa, objeto } = desenho
  const f = grid > 0 && Number.isFinite(grid) ? CASA_PX_DO_DESENHADO / grid : 1
  const margem = BEIRAL_PX + 1
  const origemX = Math.floor(geo.minX - margem)
  const origemY = Math.floor(geo.minY - margem)
  const larguraMundo = Math.ceil(geo.maxX + margem) - origemX
  const alturaMundo = Math.ceil(geo.maxY + margem) - origemY
  const k = escalaDoTelhado(larguraMundo, alturaMundo, escala)
  const largura = Math.ceil(larguraMundo * k)
  const altura = Math.ceil(alturaMundo * k)
  const pixels = new Uint8ClampedArray(largura * altura * 4)
  const passo = 1 / k
  const alcance = BEIRAL_PX + 0.5 * passo

  const n = geo.n
  const luzDaAgua = new Float64Array(n)
  const luzAoLongo = new Float64Array(n)
  for (let i = 0; i < n; i += 1) {
    luzDaAgua[i] = -geo.nx[i] * LUZ_X - geo.ny[i] * LUZ_Y
    luzAoLongo[i] = geo.dx[i] * LUZ_X + geo.dy[i] * LUZ_Y
  }
  const L = tex.ladoPx
  const quantas = tex.bases.length
  const w = new Float64Array(3)
  /** Valor da água `a` em (u, v) px do mapa, no ponto (x, y) do mapa. */
  const valorNaAgua = (a: number, u: number, v: number, x: number, y: number): number => {
    const ix = mod(u * f, L)
    const iy = mod(L - mod(v * f, L), L)
    const xd = x * f
    const yd = y * f
    pesos(tex.mistura, ruidoDoMundo(xd / tex.mistura.escala, yd / tex.mistura.escala, tex.mistura.semente), quantas, w)
    let valor = 0
    let lado = 0
    for (let i = 0; i < quantas; i += 1) {
      if (w[i] <= 0) continue
      valor += w[i] * bilinear(tex.bases[i], ix, iy, 0, true, true)
      lado += w[i] * (bilinear(tex.bases[i], ix, iy, 1, true, true) * 2 - 1)
    }
    valor *= 1 + tex.tom.amplitude * ruidoDoMundo(xd / tex.tom.escala, yd / tex.tom.escala, tex.tom.semente)
    return valor + tex.luz.lado * lado * luzAoLongo[a] + tex.luz.agua * luzDaAgua[a]
  }

  const chamine = objeto === null ? null : posicaoDaChamine(geo)
  const am = novaAmostraDaAgua()
  const cruz = new Float64Array(n)

  function pintarLinha(py: number): void {
    const y = origemY + (py + 0.5) * passo
    const total = cruzamentosDaLinha(geo, y, cruz)
    let proximo = 0
    let dentro = false
    let px = 0
    while (px < largura) {
      const x = origemX + (px + 0.5) * passo
      while (proximo < total && cruz[proximo] <= x) {
        dentro = !dentro
        proximo += 1
      }
      if (!amostrarAgua(geo, x, y, dentro, alcance, am)) {
        // Fora do telhado: a distância até ele anda no máximo 1 px por px, então pula os vazios garantidos.
        const vazios = (-am.dist - alcance) * k
        px += Number.isFinite(vazios) && vazios > 1 ? Math.ceil(vazios) : 1
        continue
      }
      const a = am.agua
      const v = am.dist + BEIRAL_PX
      const u = am.aoLongo + geo.regua[a]
      let g = valorNaAgua(a, u, v, x, y)
      const b = am.vizinha
      const ate = am.ateEmenda
      const ateNaImagem = ate * k
      if (b >= 0 && ateNaImagem < 0.5) {
        // Na emenda o pixel mistura as duas águas pela área de cada uma (como o app).
        const gb = valorNaAgua(b, geo.t[b] + geo.regua[b], geo.s[b] + BEIRAL_PX, x, y)
        const peso = 0.5 + ateNaImagem
        g = g * peso + gb * (1 - peso)
      }
      const ateD = ate * f
      if (b >= 0 && am.rincao) g -= tex.rincao.escuro * (1 - suave(0.4, tex.rincao.larguraPx, ateD))
      const vb = v * f - franja(tex, u * f)
      if (vb < tex.beiral.alturaPx) g -= tex.beiral.escuro * (1 - suave(0, tex.beiral.alturaPx, vb))
      if (faixa !== null && b >= 0 && !am.rincao && ateD < faixa.meiaLarguraPx && faixa.onde.has(ehCumeeira(geo, a, b) ? 'cumeeira' : 'espigao')) {
        const lo = a < b ? a : b
        const hi = a < b ? b : a
        const s = posicaoAoLongoDoCume(geo, a, b, x, y) * f
        const c = a === lo ? ateD : -ateD
        // Atravessando a emenda, do lado da água de índice maior para o da menor.
        const wx = geo.nx[hi] - geo.nx[lo]
        const wy = geo.ny[hi] - geo.ny[lo]
        const wn = Math.hypot(wx, wy) || 1
        const luzAtravessada = (wx * LUZ_X + wy * LUZ_Y) / wn
        const fx = mod(s, faixa.comprimentoPx) * faixa.pxPorPx
        const fy = (c + faixa.meiaLarguraPx) * faixa.pxPorPx
        const gf = bilinear(faixa.imagem, fx, fy, 0, true, false)
        const lf = bilinear(faixa.imagem, fx, fy, 1, true, false) * 2 - 1
        const af = bilinear(faixa.imagem, fx, fy, 3, true, false)
        g += (gf + faixa.ganhoLado * lf * luzAtravessada - g) * af
      }
      const alfa = Math.min(Math.max((vb / f) * k + 0.5, 0), 1)
      if (alfa > 0) {
        const o = (py * largura + px) * 4
        const i = Math.min(Math.max(Math.round(g * 255), 0), 255) * 3
        pixels[o] = rampa[i]
        pixels[o + 1] = rampa[i + 1]
        pixels[o + 2] = rampa[i + 2]
        pixels[o + 3] = Math.round(alfa * 255)
      }
      px += 1
    }
    if (chamine !== null && objeto !== null) porObjetoNaLinha(py, y, chamine.x, chamine.y, objeto.corpoPx / chamine.lado)
  }

  /** O objeto por cima, na linha: centro do corpo em (cx, cy), `kObj` px da imagem do objeto por px do mapa. */
  function porObjetoNaLinha(py: number, y: number, cx: number, cy: number, kObj: number): void {
    if (objeto === null) return
    const img = objeto.imagem
    const iy = objeto.ancoraY + (y - cy) * kObj
    if (iy < -1 || iy > img.altura + 1) return
    // Só os pixels cuja leitura cai na imagem do objeto (os outros a referência também pula).
    const xMin = cx + (-1 - objeto.ancoraX) / kObj
    const xMax = cx + (img.largura + 1 - objeto.ancoraX) / kObj
    const px0 = Math.max(0, Math.floor((xMin - origemX) * k - 0.5))
    const px1 = Math.min(largura - 1, Math.ceil((xMax - origemX) * k - 0.5))
    for (let px = px0; px <= px1; px += 1) {
      const x = origemX + (px + 0.5) * passo
      const ix = objeto.ancoraX + (x - cx) * kObj
      if (ix < -1 || ix > img.largura + 1) continue
      const fora = ix < 0 || iy < 0 || ix > img.largura || iy > img.altura
      const a = fora ? 0 : bilinear(img, ix, iy, 3, false, false)
      if (a <= 0) continue
      const o = (py * largura + px) * 4
      for (let c = 0; c < 3; c += 1) pixels[o + c] = pixels[o + c] * (1 - a) + bilinear(img, ix, iy, c, false, false) * 255 * a
      pixels[o + 3] = pixels[o + 3] + (255 - pixels[o + 3]) * a
    }
  }

  const imagem: ImagemDoTelhado = { largura, altura, origemX, origemY, escala: k, pixels }
  let linha = 0
  return {
    imagem,
    pintarLinhas(quantas: number): boolean {
      const ate = Math.min(altura, linha + Math.max(1, quantas))
      for (; linha < ate; linha += 1) pintarLinha(linha)
      return linha >= altura
    },
  }
}
