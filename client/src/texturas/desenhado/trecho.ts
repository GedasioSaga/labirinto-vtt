import { MATERIAIS, ehMaterial, type IdDoMaterial, type OpcaoDeMaterial } from '../meioTermo/materiais'
import { abrirFonteDoDesenhado, ehIdDoDesenhado } from './fonte'
import { avisarMoveisDesenhados, decodificar } from './moveis'
import { oklab, rgbDoHex, sombraDoCorpo, type Camada, type GeometriaDaCercaEmCasas, type ImagemDoPacote, type Rgb, type SombraDoMovel } from './movel'

/**
 * OS TRECHOS DO DESENHADO (CONTRATO.md 9.5 e 9.6; plano de 29/10/2026, F3d): a SEBE
 * (`curva: true`) e a JARDINEIRA (`curva: false`) são um período de L px ao longo, com a
 * ponta do começo, em cor sem luz e em relevo. O app deita o trecho no eixo do móvel e
 * acende pela LUZ depois, a conta de `camadaDeTrechos` de
 * `godot/desenhado/ferramentas/carimbo_pagina.ts` (a referência), número por número.
 *
 * - **O eixo da sebe** é o da cerca: a corda de mourão a mourão das pontas e o arco de
 *   `geometriaDaCerca` (em casas DA GRADE DO MAPA, o `cercaEmCasas` do raster), então a
 *   sebe curva passa onde a alça e a seleção mostram.
 * - **O eixo da jardineira** é reto, no lado maior, recuado `RECUO_DA_JARDINEIRA` de cada
 *   ponta: T = largura - 12 px (a caixa ocupa a casa exata; a folha `na-casa.png`).
 * - **A unidade** é o px da referência, 64 por casa. Mais grossa que o padrão
 *   (`casas[1]`), a imagem inteira cresce junto (nunca num eixo só).
 * - **A imagem sai já na tela** (o giro inteiro pintado, como a cerca por peças): a luz
 *   fica em cima à esquerda em qualquer giro.
 * - **A sombra** é a silhueta andada e desfocada, devolvida À PARTE (a cobertura, 0..1):
 *   o palco a põe na camada única das sombras dos móveis (`drawProps.ts`).
 * - **Tingir:** o contrato não tinge trecho nem carimbo (a cor é reta, 9.1). Com o
 *   material padrão do app (buxo, nogueira) a imagem é a do pacote, sem mexer em nada;
 *   com outro, a cor anda em OKLab do tom padrão para o escolhido (`tingirPeloMaterial`).
 */

/** Px da referência por casa: as medidas do trecho (`comprimentoPx`, `meiaLarguraPx`, `pontaPx`) são nela. */
const PX_DA_REFERENCIA = 64
/** Px da imagem do trecho por px da referência (128 por casa, CONTRATO 9.2). */
const TEXELS_POR_PX = 2
/** A tábua da ponta da jardineira passa 6 px do eixo de cada lado: a caixa ocupa a casa exata. */
const RECUO_DA_JARDINEIRA = 6
/** Passo, em px da referência, das amostras do eixo que dão a caixa da imagem. */
const PASSO_DA_CAIXA = 4
/** Folga da caixa da imagem, em px da imagem. */
const FOLGA_DA_CAIXA = 2
/** O alfa abaixo disto não pinta (a referência: `a[3] <= 0.001`). */
const ALFA_MINIMO = 0.001

export type IdDoTrecho = 'sebe' | 'jardineira'

/** O material padrão de cada planta do app (`LUGARES_DE_MATERIAL`): com ele, a imagem do pacote sai como está. */
export const MATERIAL_PADRAO: Readonly<Record<IdDoTrecho | 'vaso', IdDoMaterial>> = { sebe: 'buxo', jardineira: 'nogueira', vaso: 'barro' }

export interface SombraDaPlanta {
  readonly jeito: 'deslocada' | 'nenhuma'
  readonly direcao: readonly [number, number]
  /** Em unidades do tamanho (no trecho, a largura 2 x meia; no vaso, a unidade). */
  readonly deslocamento: number
  readonly borrao: number
}

export interface ParamsDoTrecho {
  readonly id: IdDoTrecho
  readonly curva: boolean
  readonly casas: readonly [number, number]
  readonly comprimento: number
  readonly meia: number
  readonly ponta: number
  readonly forca: number
  readonly luz: readonly [number, number]
  readonly sombra: SombraDaPlanta
  readonly arquivos: { readonly cor: string; readonly relevo: string }
  readonly larguraPx: number
  readonly alturaPx: number
}

export interface TrechoCarregado {
  readonly p: ParamsDoTrecho
  readonly cor: ImagemDoPacote
  readonly relevo: ImagemDoPacote
}

// ---------- leitura do textura.json (dado de fora: confere cada campo) ----------

export function campo(o: unknown, k: string): unknown {
  return typeof o === 'object' && o !== null && k in o ? Reflect.get(o, k) : undefined
}

export function numero(o: unknown, k: string): number | null {
  const v = campo(o, k)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function texto(o: unknown, k: string): string | null {
  const v = campo(o, k)
  return typeof v === 'string' ? v : null
}

export function par(o: unknown, k: string): [number, number] | null {
  const v = campo(o, k)
  return Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? [v[0], v[1]] : null
}

function dentro(v: number | null, min: number, max: number): v is number {
  return v !== null && v >= min && v <= max
}

/** A sombra do `textura.json` de trecho ou carimbo (`deslocada` ou `nenhuma`). */
export function lerSombraDaPlanta(bruto: unknown): SombraDaPlanta | null {
  const jeito = texto(bruto, 'jeito')
  if (jeito === 'nenhuma') return { jeito, direcao: [7, 11], deslocamento: 0, borrao: 0 }
  const direcao = par(bruto, 'direcao')
  const deslocamento = numero(bruto, 'deslocamento')
  const borrao = numero(bruto, 'borrao')
  if (jeito !== 'deslocada' || direcao === null || Math.hypot(direcao[0], direcao[1]) === 0 || !dentro(deslocamento, 0, 0.5) || !dentro(borrao, 0, 0.2)) return null
  return { jeito, direcao, deslocamento, borrao }
}

export function lerParamsDoTrecho(bruto: unknown): ParamsDoTrecho | null {
  const id = texto(bruto, 'idDoApp')
  if (id !== 'sebe' && id !== 'jardineira') return null
  if (numero(bruto, 'contrato') !== 1 || texto(bruto, 'tipo') !== 'trecho') return null
  const curva = campo(bruto, 'curva')
  const casas = par(bruto, 'casas')
  const t = campo(bruto, 'trecho')
  const comprimento = numero(t, 'comprimentoPx')
  const meia = numero(t, 'meiaLarguraPx')
  const ponta = numero(t, 'pontaPx')
  const larguraPx = numero(t, 'larguraImagemPx')
  const alturaPx = numero(t, 'alturaImagemPx')
  const arquivos = campo(t, 'arquivos')
  const cor = texto(arquivos, 'cor')
  const relevo = texto(arquivos, 'relevo')
  const luz = campo(bruto, 'luz')
  const forca = numero(luz, 'forca')
  const direcao = par(luz, 'direcao')
  const sombra = lerSombraDaPlanta(campo(bruto, 'sombra'))
  if (typeof curva !== 'boolean' || casas === null || casas[0] <= 0 || casas[1] <= 0) return null
  if (!dentro(comprimento, 16, 256) || !dentro(meia, 4, 48) || !dentro(ponta, 0, 64) || !dentro(forca, 0, 1)) return null
  if (larguraPx === null || alturaPx === null || cor === null || relevo === null || direcao === null || sombra === null) return null
  // A imagem tem (ponta + L) x 2 por 4 x meia (CONTRATO 9.2): outra medida = outra conta.
  if (Math.round((ponta + comprimento) * TEXELS_POR_PX) !== larguraPx || Math.round(4 * meia) !== alturaPx) return null
  return { id, curva, casas, comprimento, meia, ponta, forca, luz: direcao, sombra, arquivos: { cor, relevo }, larguraPx, alturaPx }
}

// ---------- o carregador (só o que o mapa usa) ----------

type Estado<T> = { readonly tipo: 'carregando' } | { readonly tipo: 'pronto'; readonly valor: T } | { readonly tipo: 'falhou' }

/**
 * Um carregador por id do pacote: a primeira vez que alguém pede, abre o `textura.json`
 * e as imagens; pronto, avisa os ouvintes dos móveis (quem pintou o Atual no lugar repinta).
 */
export function criarCarregador<T>(ler: (bruto: unknown, imagem: (nome: string) => Promise<ImagemDoPacote | null>) => Promise<T | null>): (id: string) => T | 'esperando' | null {
  const estados = new Map<string, Estado<T>>()
  async function carregar(id: string): Promise<void> {
    try {
      if (!ehIdDoDesenhado(id)) throw new Error(`'${id}' não é id do pacote`)
      const fonte = await abrirFonteDoDesenhado()
      const bruto = await fonte.textura(id)
      const valor = await ler(bruto, async (nome) => {
        const url = fonte.urlDe(id, nome)
        return url === undefined ? null : decodificar(url)
      })
      if (valor === null) {
        estados.set(id, { tipo: 'falhou' })
        console.warn(`[desenhado] '${id}' não serve; fica o Atual`)
        return
      }
      estados.set(id, { tipo: 'pronto', valor })
      avisarMoveisDesenhados()
    } catch (erro: unknown) {
      estados.set(id, { tipo: 'falhou' })
      console.warn(`[desenhado] '${id}' não carregou; fica o Atual`, erro)
    }
  }
  return (id) => {
    const e = estados.get(id)
    if (e === undefined) {
      estados.set(id, { tipo: 'carregando' })
      void carregar(id)
      return 'esperando'
    }
    return e.tipo === 'pronto' ? e.valor : e.tipo === 'carregando' ? 'esperando' : null
  }
}

const pedirTrecho = criarCarregador<TrechoCarregado>(async (bruto, imagem) => {
  const p = lerParamsDoTrecho(bruto)
  if (p === null) return null
  const [cor, relevo] = await Promise.all([imagem(p.arquivos.cor), imagem(p.arquivos.relevo)])
  if (cor === null || relevo === null || cor.w !== p.larguraPx || cor.h !== p.alturaPx || relevo.w !== p.larguraPx || relevo.h !== p.alturaPx) return null
  return { p, cor, relevo }
})

/** O trecho Desenhado do tipo (`sebe`, `jardineira`), ou `'esperando'` (sai o Atual até o aviso), ou `null`. */
export function pedirTrechoDesenhado(tipo: string | undefined): TrechoCarregado | 'esperando' | null {
  return tipo === 'sebe' || tipo === 'jardineira' ? pedirTrecho(tipo) : null
}

// ---------- tingir pelo material (fora do contrato: ver o cabeçalho) ----------

function linearDoOklab(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}

function srgb8(c: number): number {
  const u = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055
  return Math.round(Math.min(Math.max(u, 0), 1) * 255)
}

function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** O tom (RGB) do material do app, ou `null` se a opção não é material. */
export function tomDoMaterial(opcao: OpcaoDeMaterial | undefined): Rgb | null {
  return opcao !== undefined && ehMaterial(opcao) ? rgbDoHex(MATERIAIS[opcao].tom) : null
}

/**
 * A imagem com a cor andada em OKLab do tom `de` para o tom `para` (L, a e b somados).
 * `seletivo`: só anda o que tem o matiz do tom `de` (a madeira da jardineira e o barro do
 * vaso; as folhas e as flores ficam), pelo cosseno do matiz e pelo croma.
 */
export function tingirPeloMaterial(img: ImagemDoPacote, de: Rgb, para: Rgb, seletivo: boolean): ImagemDoPacote {
  const o0 = oklab(de)
  const o1 = oklab(para)
  const d = [o1[0] - o0[0], o1[1] - o0[1], o1[2] - o0[2]]
  const c0 = Math.hypot(o0[1], o0[2])
  const px = new Uint8ClampedArray(img.px)
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const [L, a, b] = oklab([px[i], px[i + 1], px[i + 2]])
    let w = 1
    if (seletivo) {
      const c = Math.hypot(a, b)
      const cosseno = c > 0 && c0 > 0 ? (a * o0[1] + b * o0[2]) / (c * c0) : 0
      w = suave(0.6, 0.9, cosseno) * suave(0.015, 0.035, c)
    }
    if (w <= 0) continue
    const L2 = Math.min(Math.max(L + w * d[0], 0), 1)
    let a2 = a + w * d[1]
    let b2 = b + w * d[2]
    let lin = linearDoOklab(L2, a2, b2)
    // Fora do sRGB, o croma encolhe (mesmo matiz) até caber.
    for (let k = 0; k < 12 && !lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4); k += 1) {
      a2 *= 0.85
      b2 *= 0.85
      lin = linearDoOklab(L2, a2, b2)
    }
    px[i] = srgb8(lin[0])
    px[i + 1] = srgb8(lin[1])
    px[i + 2] = srgb8(lin[2])
  }
  return { w: img.w, h: img.h, px }
}

const tingidas = new WeakMap<ImagemDoPacote, Map<string, ImagemDoPacote>>()

/** A imagem de cor para o material escolhido: a do pacote no padrão (ou opção que não é material), a tingida guardada no resto. */
export function corParaOMaterial(img: ImagemDoPacote, id: IdDoTrecho | 'vaso', opcao: OpcaoDeMaterial | undefined): ImagemDoPacote {
  const padrao = MATERIAL_PADRAO[id]
  if (opcao === undefined || opcao === padrao) return img
  const de = tomDoMaterial(padrao)
  const para = tomDoMaterial(opcao)
  if (de === null || para === null) return img
  let porMaterial = tingidas.get(img)
  if (porMaterial === undefined) {
    porMaterial = new Map()
    tingidas.set(img, porMaterial)
  }
  const pronta = porMaterial.get(opcao)
  if (pronta !== undefined) return pronta
  const nova = tingirPeloMaterial(img, de, para, id !== 'sebe')
  porMaterial.set(opcao, nova)
  return nova
}

// ---------- o plano e a pintura ----------

/** O que o raster dos móveis precisa de uma planta (trecho ou vaso): a camada já na tela, com a sombra à parte. */
export interface PlanoDaPlanta {
  readonly W: number
  readonly H: number
  /** O meio do móvel, em px da camada. */
  readonly cx: number
  readonly cy: number
  readonly pxPorCasa: number
  /** O giro que a camada traz pintado (a tela gira só o resto). */
  readonly giroPintado: number
  /** Pinta o corpo (RGBA pré-multiplicado) em `pixels` e a cobertura da sombra (0..255 nos 4 canais) em `sombra`. */
  readonly pintar: (pixels: Uint8ClampedArray, sombra: Uint8ClampedArray) => Generator<void, void, void>
}

export interface PedidoDoTrecho {
  /** A pegada SEM giro, em casas da grade do mapa. */
  readonly casasW: number
  readonly casasH: number
  /** O giro pintado, em graus (inteiro). */
  readonly giro: number
  /** A geometria da cerca (em casas, sem o giro): o eixo da sebe. A jardineira não usa. */
  readonly cerca?: GeometriaDaCercaEmCasas
  /** A opção do lugar do material (folhas da sebe, madeira da jardineira). */
  readonly material?: OpcaoDeMaterial
}

/** O eixo na tela, em px da referência, a partir do meio do móvel. */
type Eixo =
  | { readonly tipo: 'reta'; readonly ax: number; readonly ay: number; readonly tx: number; readonly ty: number; readonly T: number }
  | { readonly tipo: 'arco'; readonly ox: number; readonly oy: number; readonly R: number; readonly a0: number; readonly sentido: number; readonly varrido: number; readonly T: number }

interface NoEixo {
  readonly s: number
  readonly c: number
  readonly tx: number
  readonly ty: number
}

/** s (ao longo, 0 no começo do eixo), c (atravessando, + do lado n = (-t.y, t.x)) e a tangente: `noTrecho` da referência. */
function noEixo(e: Eixo, px: number, py: number): NoEixo {
  if (e.tipo === 'reta') {
    const vx = px - e.ax
    const vy = py - e.ay
    return { s: vx * e.tx + vy * e.ty, c: -vx * e.ty + vy * e.tx, tx: e.tx, ty: e.ty }
  }
  const DOIS_PI = 2 * Math.PI
  let u = (Math.atan2(py - e.oy, px - e.ox) - e.a0) * e.sentido
  // O ângulo andado no sentido do arco, de -pi a pi em volta do meio dele.
  u = ((((u - e.varrido / 2) % DOIS_PI) + 3 * Math.PI) % DOIS_PI) - Math.PI + e.varrido / 2
  const ang = e.a0 + u * e.sentido
  const tx = -Math.sin(ang) * e.sentido
  const ty = Math.cos(ang) * e.sentido
  const qx = e.ox + Math.cos(ang) * e.R
  const qy = e.oy + Math.sin(ang) * e.R
  return { s: e.R * u, c: (px - qx) * -ty + (py - qy) * tx, tx, ty }
}

/** O ponto do eixo a `s` (px da referência), na tela. */
function pontoDoEixo(e: Eixo, s: number): [number, number] {
  if (e.tipo === 'reta') return [e.ax + e.tx * s, e.ay + e.ty * s]
  const ang = e.a0 + (s / e.R) * e.sentido
  return [e.ox + Math.cos(ang) * e.R, e.oy + Math.sin(ang) * e.R]
}

function girar(x: number, y: number, co: number, si: number): [number, number] {
  return [co * x - si * y, si * x + co * y]
}

/** O eixo do móvel na tela (px da referência): o da cerca na sebe, o reto recuado na jardineira. */
function eixoNaTela(p: ParamsDoTrecho, pedido: PedidoDoTrecho, k: number): Eixo | null {
  const r = (pedido.giro * Math.PI) / 180
  const co = Math.cos(r)
  const si = Math.sin(r)
  const ref = PX_DA_REFERENCIA
  if (p.curva) {
    const g = pedido.cerca
    if (g === undefined || g.mouroes.length < 2) return null
    const a = g.mouroes[0]
    const b = g.mouroes[g.mouroes.length - 1]
    if (g.arco === null) {
      const T = Math.hypot(b.x - a.x, b.y - a.y) * ref
      if (T <= 0) return null
      const [ax, ay] = girar(a.x * ref, a.y * ref, co, si)
      const [tx, ty] = girar((b.x - a.x) * ref / T, (b.y - a.y) * ref / T, co, si)
      return { tipo: 'reta', ax, ay, tx, ty, T }
    }
    const arco = g.arco
    const [ox, oy] = girar(arco.center.x * ref, arco.center.y * ref, co, si)
    const R = arco.radius * ref
    const varrido = Math.abs(arco.sweep)
    return { tipo: 'arco', ox, oy, R, a0: arco.startAngle + r, sentido: Math.sign(arco.sweep), varrido, T: R * varrido }
  }
  // A jardineira: reta, no lado maior, a tábua da ponta encostada na borda da caixa.
  const deitada = pedido.casasW >= pedido.casasH
  const comprimento = (deitada ? pedido.casasW : pedido.casasH) * ref
  const recuo = RECUO_DA_JARDINEIRA * k
  const T = comprimento - 2 * recuo
  if (T <= 0) return null
  const [ax, ay] = girar(deitada ? -comprimento / 2 + recuo : 0, deitada ? 0 : -comprimento / 2 + recuo, co, si)
  const [tx, ty] = girar(deitada ? 1 : 0, deitada ? 0 : 1, co, si)
  return { tipo: 'reta', ax, ay, tx, ty, T }
}

/** Bilinear, sem repetir (as bordas grudam), em 0..1 com alfa reto: o `amostrar` da referência. */
function amostrar(im: ImagemDoPacote, x: number, y: number, r: number[]): void {
  const fx = Math.min(Math.max(x - 0.5, 0), im.w - 1)
  const fy = Math.min(Math.max(y - 0.5, 0), im.h - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(x0 + 1, im.w - 1)
  const y1 = Math.min(y0 + 1, im.h - 1)
  const tx = fx - x0
  const ty = fy - y0
  const d = im.px
  for (let k = 0; k < 4; k += 1) {
    const a = d[(y0 * im.w + x0) * 4 + k] * (1 - tx) + d[(y0 * im.w + x1) * 4 + k] * tx
    const b = d[(y1 * im.w + x0) * 4 + k] * (1 - tx) + d[(y1 * im.w + x1) * 4 + k] * tx
    r[k] = (a * (1 - ty) + b * ty) / 255
  }
}

/** O realce da luz (o `realce` da referência, a cor de luz do cabeçalho do shader). */
function realce(c: number, k: number): number {
  return c * 1.1 * 0.92 + [0.98, 0.93, 0.7][k] * 0.08
}

/** A sombra da planta na conta dos móveis (`sombraDoCorpo`): em casas, sem o alfa (a cobertura). */
export function sombraEmCasas(sb: SombraDaPlanta, tamanhoCasas: number): SombraDoMovel {
  return { jeito: sb.jeito, direcao: sb.direcao, deslocamentoCasas: sb.deslocamento * tamanhoCasas, borraoCasas: sb.borrao * tamanhoCasas, alfa: 1, cor: [10, 28, 40] }
}

/** Folga da caixa para a sombra caber, em px da imagem: o deslocamento e três desvios do borrão. */
export function folgaDaSombra(sb: SombraDoMovel, pxPorCasa: number): number {
  return sb.jeito === 'nenhuma' ? 0 : (sb.deslocamentoCasas + 3 * sb.borraoCasas) * pxPorCasa + FOLGA_DA_CAIXA
}

/** Passa a cobertura da sombra (0..1) para os bytes da textura dela (branco pré-multiplicado). */
export function gravarSombra(cobertura: Float32Array | null, sombra: Uint8ClampedArray): void {
  if (cobertura === null) return
  for (let i = 0; i < cobertura.length; i += 1) {
    const v = cobertura[i] * 255
    sombra[i * 4] = v
    sombra[i * 4 + 1] = v
    sombra[i * 4 + 2] = v
    sombra[i * 4 + 3] = v
  }
}

/** O plano do trecho na resolução `pxPorCasa` (px da imagem por casa); `null` = sem eixo (fica o Atual). */
export function planejarTrecho(t: TrechoCarregado, pedido: PedidoDoTrecho, pxPorCasa: number): PlanoDaPlanta | null {
  const { p } = t
  const espessura = Math.min(pedido.casasW, pedido.casasH)
  if (!(espessura > 0) || !(pxPorCasa > 0)) return null
  // Mais grosso que o padrão: a imagem inteira cresce junto (o período também).
  const k = espessura / p.casas[1]
  const e = eixoNaTela(p, pedido, k)
  if (e === null) return null
  const kpx = pxPorCasa / PX_DA_REFERENCIA
  const sb = sombraEmCasas(p.sombra, (2 * p.meia * k) / PX_DA_REFERENCIA)
  const folga = (p.meia * k + 1) * kpx + folgaDaSombra(sb, pxPorCasa)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const ponta = p.ponta * k
  for (let s = -ponta; ; s = Math.min(s + PASSO_DA_CAIXA, e.T + ponta)) {
    const [x, y] = pontoDoEixo(e, s)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    if (s >= e.T + ponta) break
  }
  const x0 = Math.floor(minX * kpx - folga)
  const y0 = Math.floor(minY * kpx - folga)
  const W = Math.ceil(maxX * kpx + folga) - x0
  const H = Math.ceil(maxY * kpx + folga) - y0
  const cor = corParaOMaterial(t.cor, p.id, pedido.material)
  return {
    W,
    H,
    cx: -x0,
    cy: -y0,
    pxPorCasa,
    giroPintado: pedido.giro,
    pintar: (pixels, sombra) => pintarTrecho(p, cor, t.relevo, e, k, kpx, x0, y0, W, H, sb, pxPorCasa, pixels, sombra),
  }
}

/** A conta de `camadaDeTrechos` (CONTRATO 9.5) em cada px da camada, uma linha por passo, e depois a sombra. */
function* pintarTrecho(
  p: ParamsDoTrecho,
  cor: ImagemDoPacote,
  relevo: ImagemDoPacote,
  e: Eixo,
  k: number,
  kpx: number,
  x0: number,
  y0: number,
  W: number,
  H: number,
  sb: SombraDoMovel,
  pxPorCasa: number,
  pixels: Uint8ClampedArray,
  sombra: Uint8ClampedArray,
): Generator<void, void, void> {
  const { comprimento: L, meia, ponta, forca } = p
  const [lx, ly] = p.luz
  const corpo: Camada = { w: W, h: H, px: new Float32Array(W * H * 4) }
  const a = [0, 0, 0, 0]
  const rl = [0, 0, 0, 0]
  for (let j = 0; j < H; j += 1) {
    for (let i = 0; i < W; i += 1) {
      // O px da camada em px do desenho (a referência sem a escala k), a partir do meio do móvel.
      const q = noEixo(e, (i + 0.5 + x0) / kpx, (j + 0.5 + y0) / kpx)
      const s = q.s / k
      const c = q.c / k
      const total = e.T / k
      if (Math.abs(c) > meia || s < -ponta || s > total + ponta) continue
      let xi: number
      let sinalAoLongo = 1
      if (s < 0) xi = (ponta + s) * TEXELS_POR_PX
      else if (s > total) {
        xi = (ponta + (total - s)) * TEXELS_POR_PX
        sinalAoLongo = -1
      } else xi = (ponta + (s % L)) * TEXELS_POR_PX
      const yi = (c + meia) * TEXELS_POR_PX
      amostrar(cor, xi, yi, a)
      if (a[3] <= ALFA_MINIMO) continue
      amostrar(relevo, xi, yi, rl)
      const ladoAo = (2 * rl[0] - 1) * sinalAoLongo
      const ladoAt = 2 * rl[1] - 1
      const nx = ladoAo * q.tx + ladoAt * -q.ty
      const ny = ladoAo * q.ty + ladoAt * q.tx
      const luz = nx * lx + ny * ly
      const o = (j * W + i) * 4
      for (let ch = 0; ch < 3; ch += 1) {
        const v = a[ch]
        const lit = luz >= 0 ? v + (realce(v, ch) - v) * luz * forca : v * (1 - 0.3 * forca * -luz)
        // Como a referência: a camada sai em 8 bits de alfa reto (ImageData) antes de compor.
        corpo.px[o + ch] = Math.round(lit * 255) * (Math.round(a[3] * 255) / 255)
      }
      corpo.px[o + 3] = Math.round(a[3] * 255)
    }
    yield
  }
  const cobertura = yield* sombraDoCorpo(sb, corpo, pxPorCasa)
  gravarSombra(cobertura, sombra)
  yield
  for (let o = 0; o < corpo.px.length; o += 1) pixels[o] = corpo.px[o]
}
