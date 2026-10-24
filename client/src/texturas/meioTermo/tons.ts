import { rgb, type Rgb } from '../ruido'
import { contornoDoTom, deHsl, paraHsl } from './barranco'
import { PALETA_MEIO_TERMO, type TokenDaPaleta } from './paleta'

/**
 * TONS de uma cor da paleta do Meio-Termo, pela receita do protótipo
 * (`vila-estilo-mother/prototipo/mother.js`, `tons`; `escuroDoContorno: 0.6`
 * do Meio-Termo): realce = luz +0,09 com o matiz 12% na direção do amarelo da
 * luz (55°); sombra = luz −0,12 e saturação +0,05 (4° mais quente nas cores
 * quentes); contorno = `contornoDoTom` (60% da luz, nunca abaixo do piso de
 * luminância). Quando a paleta já traz realce ou sombra prontos, eles valem.
 */

export interface TonsDoMeio {
  readonly base: Rgb
  readonly realce: Rgb
  readonly sombra: Rgb
  readonly contorno: Rgb
}

function limitar(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

/** Diferença de matiz, em graus, de `h` até `alvo` pelo caminho mais curto (−180 a 180). */
function rumo(h: number, alvo: number): number {
  return ((((alvo - h) % 360) + 540) % 360) - 180
}

const guardados = new Map<TokenDaPaleta, TonsDoMeio>()

export function tonsDoMeio(token: TokenDaPaleta): TonsDoMeio {
  const pronto = guardados.get(token)
  if (pronto !== undefined) return pronto
  const tom = PALETA_MEIO_TERMO[token] as { base: string; realce?: string; sombra?: string }
  const base = rgb(tom.base)
  const [h, s, l] = paraHsl(base)
  const quente = h < 90 || h > 330
  const tons: TonsDoMeio = {
    base,
    realce: tom.realce !== undefined ? rgb(tom.realce) : deHsl(h + rumo(h, 55) * 0.12, s, limitar(l + 0.09, 0, 0.95)),
    sombra: tom.sombra !== undefined ? rgb(tom.sombra) : deHsl(h + (quente ? -4 : 0), limitar(s + 0.05, 0, 1), limitar(l - 0.12, 0.05, 1)),
    contorno: contornoDoTom(base),
  }
  guardados.set(token, tons)
  return tons
}

/** A cor `#rrggbb` como número (o formato de cor do Pixi). */
export function numeroDoRgb(c: Rgb): number {
  return (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2])
}
