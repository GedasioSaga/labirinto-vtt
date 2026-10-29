import { varianteDoGiro } from '../../lib/carimbos'
import type { OpcaoDeMaterial } from '../meioTermo/materiais'
import { formaDoGiro, matrizDoCorpo, type EspelhoDoCarimbo } from './carimbos'
import { sombraDoCorpo, type Camada, type ImagemDoPacote } from './movel'
import { campo, corParaOMaterial, criarCarregador, folgaDaSombra, gravarSombra, lerSombraDaPlanta, numero, par, sombraEmCasas, texto, type PlanoDaPlanta, type SombraDaPlanta } from './trecho'

/**
 * O VASO DO DESENHADO (CONTRATO.md 9.4 e 9.6; plano de 29/10/2026, F3d): carimbo de destino
 * `movel`. A imagem NUNCA gira: o giro do móvel escolhe a forma (`formaDoGiro` com
 * `varianteDoGiro`, o arquivo e o espelho diagonal) e o corpo vai pela `matrizDoCorpo` dos
 * carimbos. A camada sai já na tela (o giro inteiro pintado: a tela não gira nada), com a
 * sombra do app À PARTE (a camada única das sombras dos móveis).
 *
 * O tamanho: 1 unidade = 1 casa no vaso do tamanho padrão (0,5 casa, `TAMANHO_PADRAO`);
 * esticado, a unidade cresce com o lado MENOR (nunca num eixo só). Tingir: como o trecho
 * (`corParaOMaterial`, só o que tem o matiz do barro).
 */

/** O lado do vaso que o app cria, em casas (`lib/mobilia`): nele 1 unidade do pacote = 1 casa. */
const TAMANHO_PADRAO = 0.5

/** Matriz do Canvas [a, b, c, d, e, f]: (u, v) -> (a u + c v + e, b u + d v + f). */
type Matriz = readonly [number, number, number, number, number, number]

export interface ParamsDoVaso {
  readonly variacoes: number
  readonly espelho: EspelhoDoCarimbo
  readonly arquivos: readonly string[]
  readonly ladoPx: number
  readonly unidadePx: number
  readonly ancoraPx: readonly [number, number]
  readonly sombra: SombraDaPlanta
}

export interface VasoCarregado {
  readonly p: ParamsDoVaso
  /** As formas, na ordem dos arquivos, com os níveis 2 x 2 (o mipmap da colagem). */
  readonly imagens: readonly ImagemDoPacote[]
}

export function lerParamsDoVaso(bruto: unknown): ParamsDoVaso | null {
  if (texto(bruto, 'idDoApp') !== 'vaso' || numero(bruto, 'contrato') !== 1 || texto(bruto, 'tipo') !== 'carimbo' || texto(bruto, 'destino') !== 'movel') return null
  const formas = campo(bruto, 'formas')
  const variacoes = numero(formas, 'variacoes')
  const espelhoBruto = campo(formas, 'espelho')
  const espelho: EspelhoDoCarimbo | null = espelhoBruto === undefined || espelhoBruto === 'diagonal' ? 'diagonal' : espelhoBruto === 'nenhum' ? 'nenhum' : null
  const sprite = campo(bruto, 'sprite')
  const lista = campo(sprite, 'arquivos')
  const arquivos = Array.isArray(lista) && lista.every((a) => typeof a === 'string') ? lista.map(String) : null
  const ladoPx = numero(sprite, 'ladoPx')
  const unidadePx = numero(sprite, 'unidadePx')
  const ancoraPx = par(sprite, 'ancoraPx')
  const sombra = lerSombraDaPlanta(campo(bruto, 'sombra'))
  if (variacoes === null || !Number.isInteger(variacoes) || variacoes < 1 || variacoes > 4 || espelho === null) return null
  if (arquivos === null || arquivos.length !== variacoes || ladoPx === null || ladoPx < 32 || ladoPx > 512 || unidadePx === null || unidadePx < 16 || unidadePx > 512) return null
  if (ancoraPx === null || sombra === null) return null
  return { variacoes, espelho, arquivos, ladoPx, unidadePx, ancoraPx, sombra }
}

const pedirVaso = criarCarregador<VasoCarregado>(async (bruto, imagem) => {
  const p = lerParamsDoVaso(bruto)
  if (p === null) return null
  const imagens = await Promise.all(p.arquivos.map((a) => imagem(a)))
  const prontas: ImagemDoPacote[] = []
  for (const img of imagens) {
    if (img === null || img.w !== p.ladoPx || img.h !== p.ladoPx) return null
    prontas.push(img)
  }
  return { p, imagens: prontas }
})

/** O vaso Desenhado, ou `'esperando'` (sai o Atual até o aviso), ou `null`. */
export function pedirVasoDesenhado(tipo: string | undefined): VasoCarregado | 'esperando' | null {
  return tipo === 'vaso' ? pedirVaso('vaso') : null
}

export interface PedidoDoVaso {
  readonly casasW: number
  readonly casasH: number
  /** O giro do móvel, em graus: escolhe a forma; a imagem não gira. */
  readonly giro: number
  readonly material?: OpcaoDeMaterial
}

/** A imagem pré-multiplicada em float e os níveis 2 x 2 dela (o mipmap da colagem, como a mesa). */
function niveisPremultiplicados(img: ImagemDoPacote): Camada[] {
  const base = new Float32Array(img.w * img.h * 4)
  for (let i = 0; i < img.w * img.h; i += 1) {
    const a = img.px[i * 4 + 3] / 255
    for (let k = 0; k < 3; k += 1) base[i * 4 + k] = img.px[i * 4 + k] * a
    base[i * 4 + 3] = img.px[i * 4 + 3]
  }
  const niveis: Camada[] = [{ w: img.w, h: img.h, px: base }]
  let c = niveis[0]
  while (c.w > 2 && c.h > 2) {
    const w = c.w >> 1
    const h = c.h >> 1
    const px = new Float32Array(w * h * 4)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        for (let k = 0; k < 4; k += 1) {
          px[(y * w + x) * 4 + k] = (c.px[(2 * y * c.w + 2 * x) * 4 + k] + c.px[(2 * y * c.w + 2 * x + 1) * 4 + k] + c.px[((2 * y + 1) * c.w + 2 * x) * 4 + k] + c.px[((2 * y + 1) * c.w + 2 * x + 1) * 4 + k]) / 4
        }
      }
    }
    c = { w, h, px }
    niveis.push(c)
  }
  return niveis
}

/** O plano do vaso na resolução `pxPorCasa`; `null` = tamanho que não se desenha (fica o Atual). */
export function planejarVaso(v: VasoCarregado, pedido: PedidoDoVaso, pxPorCasa: number): PlanoDaPlanta | null {
  const { p } = v
  const lado = Math.min(pedido.casasW, pedido.casasH)
  if (!(lado > 0) || !(pxPorCasa > 0)) return null
  const unidadeCasas = lado / TAMANHO_PADRAO
  const forma = formaDoGiro(varianteDoGiro(pedido.giro), p.variacoes, p.espelho)
  const sb = sombraEmCasas(p.sombra, unidadeCasas)
  // A imagem posta: o pé no meio do móvel, px da imagem -> px da camada.
  const m = matrizDoCorpo(p, forma.espelho)
  const u = unidadeCasas * pxPorCasa
  const mapa: Matriz = [m[0] * u, m[1] * u, m[2] * u, m[3] * u, m[4] * u, m[5] * u]
  const cantos = [[0, 0], [p.ladoPx, 0], [0, p.ladoPx], [p.ladoPx, p.ladoPx]].map(([x, y]) => [mapa[0] * x + mapa[2] * y + mapa[4], mapa[1] * x + mapa[3] * y + mapa[5]])
  const folga = folgaDaSombra(sb, pxPorCasa) + 1
  const x0 = Math.floor(Math.min(...cantos.map((c) => c[0])) - folga)
  const y0 = Math.floor(Math.min(...cantos.map((c) => c[1])) - folga)
  const W = Math.ceil(Math.max(...cantos.map((c) => c[0])) + folga) - x0
  const H = Math.ceil(Math.max(...cantos.map((c) => c[1])) + folga) - y0
  const img = corParaOMaterial(v.imagens[forma.arquivo], 'vaso', pedido.material)
  return {
    W,
    H,
    cx: -x0,
    cy: -y0,
    pxPorCasa,
    giroPintado: Math.round(pedido.giro),
    pintar: (pixels, sombra) => pintarVaso(img, u / p.unidadePx, mapa, x0, y0, W, H, sb, pxPorCasa, pixels, sombra),
  }
}

/** A colagem da mesa (`porAfim`): bilinear no nível do mipmap que a escala pede, e depois a sombra. */
function* pintarVaso(
  img: ImagemDoPacote,
  escala: number,
  mapa: Matriz,
  x0: number,
  y0: number,
  W: number,
  H: number,
  sb: ReturnType<typeof sombraEmCasas>,
  pxPorCasa: number,
  pixels: Uint8ClampedArray,
  sombra: Uint8ClampedArray,
): Generator<void, void, void> {
  const niveis = niveisPremultiplicados(img)
  const nivel = Math.min(niveis.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, 1 / escala)))))
  const c = niveis[nivel]
  const kx = c.w / img.w
  const ky = c.h / img.h
  // A inversa: px da camada -> px da imagem (sem espelho, a escala; com, a transposta).
  const det = mapa[0] * mapa[3] - mapa[1] * mapa[2]
  const inv = [mapa[3] / det, -mapa[1] / det, -mapa[2] / det, mapa[0] / det, (mapa[2] * mapa[5] - mapa[3] * mapa[4]) / det, (mapa[1] * mapa[4] - mapa[0] * mapa[5]) / det]
  const corpo: Camada = { w: W, h: H, px: new Float32Array(W * H * 4) }
  const s = [0, 0, 0, 0]
  for (let Y = 0; Y < H; Y += 1) {
    for (let X = 0; X < W; X += 1) {
      const px = X + 0.5 + x0
      const py = Y + 0.5 + y0
      const u = (inv[0] * px + inv[2] * py + inv[4]) * kx - 0.5
      const v = (inv[1] * px + inv[3] * py + inv[5]) * ky - 0.5
      const iu = Math.floor(u)
      const iv = Math.floor(v)
      const tu = u - iu
      const tv = v - iv
      s.fill(0)
      for (let q = 0; q < 4; q += 1) {
        const x = iu + (q & 1)
        const y = iv + (q >> 1)
        const peso = ((q & 1) === 1 ? tu : 1 - tu) * ((q >> 1) === 1 ? tv : 1 - tv)
        if (x < 0 || y < 0 || x >= c.w || y >= c.h || peso === 0) continue
        const o = (y * c.w + x) * 4
        for (let k = 0; k < 4; k += 1) s[k] += c.px[o + k] * peso
      }
      if (s[3] <= 0) continue
      const o = (Y * W + X) * 4
      for (let k = 0; k < 4; k += 1) corpo.px[o + k] = s[k]
    }
    if (Y % 32 === 31) yield
  }
  // A sombra é a silhueta da mesma colagem (a forma e o espelho já escolhidos).
  const cobertura = yield* sombraDoCorpo(sb, corpo, pxPorCasa)
  gravarSombra(cobertura, sombra)
  yield
  for (let o = 0; o < corpo.px.length; o += 1) pixels[o] = corpo.px[o]
}
