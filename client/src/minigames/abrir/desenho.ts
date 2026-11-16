/**
 * DESENHO EM PIXEL DOS JOGOS DE ABRIR: utilitários de 1 px na tela lógica de
 * 240x135 (como a pesca do app: só retângulo, sem texto no canvas) e a paleta
 * do Meio-Termo, o estilo do RPG (docs/design/vila-meio-termo/README.md do
 * app, "Paleta (tokens)"). Regras do estilo que valem aqui: contorno nunca
 * preto puro, é a própria cor a 60% da luz e nunca abaixo de luminância 0,06;
 * cores contidas, pastel e nunca neon; textura por código, determinística.
 */

export const W = 240
export const H = 135

/** Um retângulo de pixels inteiros (1x1 por padrão). */
export function pix(g: CanvasRenderingContext2D, cor: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = cor
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

/**
 * Sprite em texto: cada caractere é uma chave da paleta; '.' e ' ' são vazios.
 * `s` amplia cada pixel do sprite em s x s.
 */
export function mapa(
  g: CanvasRenderingContext2D, linhas: readonly string[], pal: Readonly<Record<string, string>>,
  x: number, y: number, s = 1,
): void {
  for (let j = 0; j < linhas.length; j++) {
    const l = linhas[j]
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (c === '.' || c === ' ') continue
      const cor = pal[c]
      if (cor !== undefined) pix(g, cor, x + i * s, y + j * s, s, s)
    }
  }
}

/** Paleta: tokens do Meio-Termo, acentos de jogo da pesca e o porão. */
export const COR = {
  // Madeira e metal do Meio-Termo (materiais da Textura, mais claros e quentes).
  carvalho: '#a07b51',
  nogueira: '#775739',
  pinho: '#b9995f',
  ferro: '#5d6164',
  latao: '#b89552',
  // Pedra, terra e telha do Meio-Termo.
  praca: '#dcd0b6',
  pedra: '#c3c0b2',
  terra: '#dda56c',
  barranco: '#aa745c',
  palha: '#d6b56a',
  terracota: '#b56e50',
  telhaMadeira: '#867a6a',
  // Flores do Meio-Termo, só para acento.
  rosa: '#e8a2c4',
  amarelo: '#f0d266',
  violeta: '#a87fcb',
  branco: '#f3efe2',
  laranja: '#e6793f',
  // Acentos de jogo, os mesmos da pesca do app.
  ouro: '#f2c14e',
  chama: '#f3ba66',
  brasa: '#e2645a',
  verde: '#7fb48a',
  verdeClaro: '#c4e6c9',
  ambar: '#e0a44a',
  azul: '#79a9cc',
  papel: '#eceae4',
  // Porão: parede de pedra e piso de tábua, quentes e escuros, para o recipiente saltar.
  muro: '#3d332d',
  muroRealce: '#4a3e36',
  argamassa: '#2a231f',
  piso: '#4a3826',
  pisoFresta: '#271c14',
  sombra: '#1f1915',
} as const

export type NomeDaCor = keyof typeof COR

function canais(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hexDe(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** A cor com a luz multiplicada por `f` (0,6 = tom de contorno; 1,15 = realce). */
export function luz(hex: string, f: number): string {
  const [r, g, b] = canais(hex)
  return hexDe(r * f, g * f, b * f)
}

/** Mistura linear de duas cores (t = 0 dá `a`, t = 1 dá `b`). */
export function misturar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = canais(a)
  const [r2, g2, b2] = canais(b)
  return hexDe(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/** Luminância relativa (WCAG) de 0 a 1. */
export function luminancia(hex: string): number {
  const lin = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = canais(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Luminância mínima de um contorno (regra 1 do Meio-Termo). */
export const CONTORNO_MIN = 0.06

/** Marrom quente para onde um contorno escuro demais é puxado. */
const CONTORNO_DE_SOCORRO = '#6b5643'

/**
 * Contorno da cor: a própria cor a 60% da luz. Se ficar escura demais, é
 * puxada para um marrom quente até a luminância 0,06. Nunca preto puro.
 */
export function contorno(hex: string): string {
  const base = luz(hex, 0.6)
  let c = base
  for (let t = 0.1; luminancia(c) < CONTORNO_MIN && t <= 1.001; t += 0.1) c = misturar(base, CONTORNO_DE_SOCORRO, t)
  return c
}

/**
 * Bloco com volume: preenchimento, realce de 1 px em cima, sombra de 1 px
 * embaixo e contorno da própria cor em volta (tábua, aro, ferragem).
 */
export function bloco(g: CanvasRenderingContext2D, cor: string, x: number, y: number, w: number, h: number): void {
  pix(g, contorno(cor), x, y, w, h)
  if (w <= 2 || h <= 2) return
  pix(g, cor, x + 1, y + 1, w - 2, h - 2)
  pix(g, luz(cor, 1.15), x + 1, y + 1, w - 2, 1)
  if (h > 3) pix(g, luz(cor, 0.85), x + 1, y + h - 2, w - 2, 1)
}
