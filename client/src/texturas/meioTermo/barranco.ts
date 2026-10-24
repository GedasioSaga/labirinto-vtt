import { misturar, rgb, type Rgb } from '../ruido'
import { PALETA_MEIO_TERMO } from './paleta'

/**
 * BARRANCO LISO do Meio-Termo (fatia MT8, `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`
 * seção 3; regra 3 de `docs/design/ESTILO-DO-RPG.md`): a parede do penhasco
 * deixa as 6 faixas de hoje (lábio, terra, veio, terra clara, terra, base
 * molhada) e vira preenchimento liso: realce em cima, sombra embaixo, um
 * contorno fino no pé, sem hachura.
 *
 * Os tons são o `barranco` da paleta (`#aa745c`, realce `#c28b71`, sombra
 * `#915f4a`). O contorno segue a receita do protótipo (`vila-estilo-mother/
 * prototipo/mother.js`, `tons`, com `escuroDoContorno: 0.6` do Meio-Termo): o
 * tom escuro da própria cor, nunca preto, com o piso de luminância.
 *
 * Nada aqui desenha nem sorteia: a cor depende só da fração da altura.
 */

const TOM = PALETA_MEIO_TERMO.barranco

/** Quanto da luz (HSL) da cor o contorno guarda: 60% no Meio-Termo (o Mother guardava 50%). */
export const ESCURO_DO_CONTORNO = 0.6

/** Luminância linear mínima do contorno (regra 1 do estilo: nunca preto). */
export const PISO_DO_CONTORNO = 0.06

/**
 * O piso que a receita usa para subir o contorno, um pouco acima do da regra:
 * no pé da parede o antialias do canvas mistura o contorno com a sombra no
 * mar (até ~6% dela num pixel que ainda conta como opaco), e o pixel misturado
 * tem de ficar acima de `PISO_DO_CONTORNO`.
 */
const PISO_COM_FOLGA = 0.07

/** Espessura do contorno no pé, em px do protótipo (o traço do Meio-Termo é 72% do do Mother). */
export const LARGURA_DO_CONTORNO = 1.2

/**
 * O perfil, em frações da altura da parede (0 = lábio, 1 = pé): o realce
 * cheio até `realceAte` e some até `realceSome`; a sombra começa em
 * `sombraDe` e fica cheia em `sombraCheia`. Transições largas (smoothstep):
 * nenhuma troca de tom vira listra.
 */
export const PERFIL_DO_BARRANCO = {
  realceAte: 0.08,
  realceSome: 0.42,
  sombraDe: 0.5,
  sombraCheia: 0.95,
} as const

function limitar(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

function linear(c8: number): number {
  const u = c8 / 255
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

/** Luminância linear (sRGB decodificado, Rec. 709) de uma cor de 8 bits por canal. */
export function luminanciaDoRgb(c: Rgb): number {
  return 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2])
}

function paraHsl(c: Rgb): [number, number, number] {
  const r = c[0] / 255
  const g = c[1] / 255
  const b = c[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function deHsl(h: number, s: number, l: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 360
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const canal = (t: number): number => {
    const u = (t + 1) % 1
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  return [Math.round(canal(hh + 1 / 3) * 255), Math.round(canal(hh) * 255), Math.round(canal(hh - 1 / 3) * 255)]
}

/**
 * O contorno de uma cor pela receita do protótipo: matiz 6° mais quente nas
 * cores quentes, saturação +0,12 (teto 0,85), `ESCURO_DO_CONTORNO` da luz, e
 * sobe de 0,01 em 0,01 até passar do piso.
 */
export function contornoDoTom(base: Rgb, piso: number = PISO_COM_FOLGA): Rgb {
  const [h, s, l] = paraHsl(base)
  const quente = h < 90 || h > 330
  const hc = h + (quente ? -6 : 0)
  const sc = limitar(s + 0.12, 0, 0.85)
  let lc = l * ESCURO_DO_CONTORNO
  let cor = deHsl(hc, sc, lc)
  while (luminanciaDoRgb(cor) < piso && lc < 0.6) {
    lc += 0.01
    cor = deHsl(hc, sc, lc)
  }
  return cor
}

export interface TonsDoBarranco {
  readonly base: Rgb
  readonly realce: Rgb
  readonly sombra: Rgb
  readonly contorno: Rgb
}

export const TONS_DO_BARRANCO: TonsDoBarranco = {
  base: rgb(TOM.base),
  realce: rgb(TOM.realce),
  sombra: rgb(TOM.sombra),
  contorno: contornoDoTom(rgb(TOM.base)),
}

/** Curva suave de 0 a 1 (`smoothstep`). */
function suave(t: number): number {
  const x = limitar(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** A cor do barranco a `fracao` da altura (0 = lábio, 1 = pé), sem o contorno, em inteiros de 8 bits. */
export function corDoBarranco(fracao: number): [number, number, number] {
  const { realceAte, realceSome, sombraDe, sombraCheia } = PERFIL_DO_BARRANCO
  const f = limitar(fracao, 0, 1)
  const realce = 1 - suave((f - realceAte) / (realceSome - realceAte))
  const sombra = suave((f - sombraDe) / (sombraCheia - sombraDe))
  const cor = misturar(misturar(TONS_DO_BARRANCO.base, TONS_DO_BARRANCO.realce, realce), TONS_DO_BARRANCO.sombra, sombra)
  return [Math.round(cor[0]), Math.round(cor[1]), Math.round(cor[2])]
}
