import { DIF, rngDe } from './sim'
import type { ArteDoPeixe, DificuldadeSim, Peixe, Puxada } from './sim'

/**
 * ARTE DA PESCA: o lago, a coluna de pesca, a placa do resultado, o retrato do
 * barqueiro e os 10 peixes gerados em código. Porte fiel da pixel art do
 * protótipo aprovado; o estado do jogo entra por parâmetro, nada é lido de
 * global. Canvas de baixa resolução, ampliado pelo CSS em escala inteira.
 */

/** Cena do lago. */
export const W = 240
export const H = 135
/** Linha d'água, pescador e mão que segura a vara. */
export const AGUA = 86
export const PX = 30
export const PY = 63
export const MAO: Ponto = [35, 53]
/** Instrumento: coluna de água (CX, CY, CW, CH) e o medidor ao lado (MX, MW). */
export const IW = 84
export const IH = 200
export const CX = 22
export const CW = 28
export const CY = 10
export const CH = 180
export const MX = 59
export const MW = 6

/** Duração das fases animadas, em s; o movimento reduzido encurta. */
export const DUR = {
  voo: (reduzido: boolean): number => (reduzido ? 0.2 : 0.55),
  final: (reduzido: boolean): number => (reduzido ? 0.5 : 1.2),
} as const

export type Ponto = readonly [number, number]

export type FaseDaPesca = 'convite' | 'lance' | 'voo' | 'espera' | 'cedo' | 'fisgada' | 'puxada' | 'final' | 'resultado'

/** O que a arte precisa saber do desfecho; no pegou o peixe sempre existe. */
export type ResultadoNaCena =
  | { tipo: 'pegou'; peixe: Peixe }
  | { tipo: 'escapou' | 'fugiu' | 'encerrado'; peixe: Peixe | null }

/** O estado do jogo que a arte lê (o do jogador e o de cada simulado têm este formato). */
export interface CenaDaPesca {
  fase: FaseDaPesca
  dif: DificuldadeSim
  /** Número do lance; muda o desenho do respingo. */
  n: number
  t: number
  tFase: number
  carregando: boolean
  forca: number
  dist: number
  /** Instante da última beliscada, em tFase (negativo = nenhuma). */
  beliscou: number
  /** Ângulo da manivela do carretel. */
  giro: number
  reduzido: boolean
  puxada: Puxada | null
  resultado: ResultadoNaCena | null
}

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k

/** Único ponto que cria canvas: o teste troca o `getContext` do jsdom por um falso. */
function novaTela(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas 2D indisponível')
  return { c, g }
}

function pix(g: CanvasRenderingContext2D, cor: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = cor
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

type Paleta = Readonly<Partial<Record<string, string>>>

function mapa(g: CanvasRenderingContext2D, linhas: readonly string[], pal: Paleta, x: number, y: number, s = 1): void {
  linhas.forEach((l, j) => {
    for (let i = 0; i < l.length; i++) {
      const c = pal[l[i]]
      if (c) pix(g, c, x + i * s, y + j * s, s, s)
    }
  })
}

const BAU = ['.ooooooo.', 'ommmmmmmo', 'obbbbbbbo', 'ommmkmmmo', 'ommmmmmmo', 'ommmmmmmo', '.ooooooo.']
const BAU_PAL: Paleta = { o: '#1b1208', m: '#8a5a22', b: '#c9963f', k: '#f2c14e' }
const BOIA = ['.a.', 'rrr', 'rwr', 'bbb', '.b.']
const BOIA_PAL: Paleta = { a: '#eceae4', r: '#e2645a', w: '#f6e7d0', b: '#f2c14e' }
const PEIXINHO = ['..ooo....o', '.olllo..oo', 'oelllloool', 'olllllllol', '.olllo..oo', '..ooo....o']
const PEIXINHO_PAL: Paleta = { o: '#1b1208', l: '#eceae4', e: '#1b1208' }
const EXCLAMA = ['oooo', 'okko', 'okko', 'okko', 'okko', 'okko', 'okko', 'okko', 'oooo', '....', 'oooo', 'okko', 'oooo']

// ------------------------------------------------------------------ peixes

/**
 * Máscara do peixe: índice de cor por pixel (0 vazio, 1 contorno, 2 dorso,
 * 3 corpo, 4 ventre, 5 barbatana, 6 detalhe, 7 olho, 8 joia da coroa) e a
 * paleta desses índices.
 */
export interface MascaraDoPeixe {
  w: number
  h: number
  m: Uint8Array
  pal: readonly (string | null)[]
}

/** Peixe gerado em código a partir dos parâmetros da arte (corpo, cauda, barbatana, padrão, extra). */
export function mascaraDoPeixe(a: ArteDoPeixe): MascaraDoPeixe {
  const L = a.L
  const A = a.A
  const topo = a.extra === 'coroa' || a.extra === 'isca' ? 3 : 0
  const ox = a.extra === 'bigode' ? 3 : 1
  const w = L + ox + 1
  const h = A + 2 + topo + (a.extra === 'bigode' ? 2 : 0)
  const cy = topo + 1 + (A - 1) / 2
  const m = new Uint8Array(w * h)
  const ler = (x: number, y: number): number => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0)
  const por = (x: number, y: number, c: number): void => {
    if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = c
  }
  const cauda = Math.max(2, Math.round(L * (a.cauda === 'fina' ? 0.2 : 0.25)))
  const Lb = L - cauda
  const meia = (x: number): number => {
    const u = (x + 0.5) / Lb
    if (a.perfil === 'longo') return (A / 2) * Math.min(1, (x + 1) / 3)
    if (a.perfil === 'oval') return (A / 2) * Math.sqrt(Math.max(0.05, 1 - Math.pow(2 * u - 1, 2)))
    return (A / 2) * Math.pow(Math.sin(Math.PI * (0.1 + u * 0.75)), 0.6)
  }
  for (let x = 0; x < Lb; x++) {
    const hh = meia(x)
    for (let y = 0; y < h; y++) {
      const dy = y - cy
      if (Math.abs(dy) <= hh + 0.25) por(ox + x, y, dy < -hh * 0.3 ? 2 : dy > hh * 0.4 ? 4 : 3)
    }
  }
  const hJ = meia(Lb - 1)
  for (let k = 0; k < cauda; k++) {
    const f = (k + 1) / cauda
    for (let y = 0; y < h; y++) {
      const dy = Math.abs(y - cy)
      const on = a.cauda === 'fina'
        ? dy <= hJ * (1 - f) + 0.3
        : a.cauda === 'leque'
          ? dy <= 0.6 + f * (A / 2 + 0.5)
          : (dy <= 0.6 + f * (A / 2 + 0.5) && dy >= f * (A / 2) * 0.75 - 0.2) || (k === 0 && dy <= 1)
      if (on) por(ox + Lb + k, y, 5)
    }
  }
  if (a.perfil !== 'longo') {
    for (let x = Math.round(Lb * 0.35); x <= Math.round(Lb * 0.6); x++) {
      const y = Math.round(cy - meia(x) - 0.75)
      if (!ler(ox + x, y)) por(ox + x, y, 5)
    }
  }
  const yc = Math.round(cy)
  if (a.padrao === 'runa') {
    const xr = ox + Math.round(Lb * 0.52)
    for (const [i, j] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1], [1, -1]]) por(xr + i, yc + j, 6)
  }
  if (a.padrao === 'pintas') {
    for (let x = 2; x < Lb - 1; x++) {
      for (let y = 0; y < h; y++) {
        const c = ler(ox + x, y)
        if ((c === 2 || c === 3) && (x * 7 + y * 13) % 5 === 0) por(ox + x, y, 6)
      }
    }
  }
  if (a.padrao === 'ossos') {
    for (let x = 2; x < Lb; x++) {
      if (ler(ox + x, yc)) por(ox + x, yc, 6)
      if (x % 2 === 0) {
        for (let y = 0; y < h; y++) {
          const c = ler(ox + x, y)
          if (c >= 2 && c <= 4 && Math.abs(y - cy) < meia(x) - 0.2) por(ox + x, y, 6)
        }
      }
    }
  }
  if (a.padrao === 'placas') for (let x = 2; x < Lb; x += 3) por(ox + x, Math.round(cy - meia(x) * 0.55), 6)
  const corpo = m.slice()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (
        !corpo[y * w + x] &&
        ((x > 0 && corpo[y * w + x - 1]) || (x < w - 1 && corpo[y * w + x + 1]) || (y > 0 && corpo[(y - 1) * w + x]) || (y < h - 1 && corpo[(y + 1) * w + x]))
      ) m[y * w + x] = 1
    }
  }
  const yTopo = (x: number): number => Math.round(cy - meia(x))
  if (a.extra === 'isca') {
    const t = yTopo(2)
    por(ox + 2, t - 2, 1)
    por(ox + 1, t - 3, 1)
    por(ox, t - 3, 6)
    por(ox - 1 < 0 ? 0 : ox - 1, t - 2, 6)
  }
  if (a.extra === 'bigode') {
    por(ox - 1, yc + 1, 6)
    por(ox - 2, yc + 2, 6)
    por(ox - 3, yc + 3, 6)
    por(ox - 1, yc + 2, 6)
    por(ox - 1, yc + 3, 6)
  }
  if (a.extra === 'ventosa') {
    por(ox - 1, yc - 1, 6)
    por(ox - 1, yc, 6)
    por(ox - 1, yc + 1, 6)
    por(ox, yc, 1)
  }
  if (a.extra === 'coroa') {
    const b = yTopo(4) - 2
    const x0 = ox + 2
    for (let i = 0; i < 6; i++) por(x0 + i, b, 6)
    for (const i of [0, 2, 5]) por(x0 + i, b - 1, 6)
    por(x0 + 3, b, 8)
    por(x0, b - 2, 6)
    por(x0 + 5, b - 2, 6)
  }
  const xo = ox + Math.max(1, Math.round(Lb * 0.16))
  por(xo, Math.round(cy - meia(xo - ox) * 0.3), 7)
  const pal = [null, a.cor[0], a.cor[1], a.cor[2], a.cor[3], a.cor[4], a.cor[5], a.olho ?? '#120d08', '#e2645a']
  return { w, h, m, pal }
}

export interface SpriteDoPeixe {
  c: HTMLCanvasElement
  w: number
  h: number
}

/** Pinta a máscara num canvas novo; sem cache (o `spriteDoPeixe` guarda). */
export function criarSpriteDoPeixe(px: Peixe): SpriteDoPeixe {
  const { w, h, m, pal } = mascaraDoPeixe(px.arte)
  const { c, g } = novaTela(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cor = pal[m[y * w + x]]
      if (cor) pix(g, cor, x, y)
    }
  }
  return { c, w, h }
}

const sprites = new Map<string, SpriteDoPeixe>()

export function spriteDoPeixe(px: Peixe): SpriteDoPeixe {
  const pronto = sprites.get(px.id)
  if (pronto) return pronto
  const sp = criarSpriteDoPeixe(px)
  sprites.set(px.id, sp)
  return sp
}

// ------------------------------------------------------------------ lago

const RUNAS: readonly (readonly [number, number, readonly Ponto[]])[] = [
  [150, 40, [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [2, 0]]],
  [178, 33, [[0, 0], [1, 1], [2, 2], [2, 0], [0, 2], [1, 3]]],
  [206, 44, [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]]],
]
const MARGEM: readonly Ponto[] = [[0, 64], [18, 62], [44, 64], [58, 68], [64, 76], [68, 88], [66, 135], [0, 135]]

function topoMargem(x: number): number {
  for (let i = 0; i < 5; i++) {
    const [x0, y0] = MARGEM[i]
    const [x1, y1] = MARGEM[i + 1]
    if (x >= x0 && x <= x1) return Math.round(lerp(y0, y1, (x - x0) / Math.max(1, x1 - x0)))
  }
  return AGUA
}

/** Caverna, água e margem: o que não muda entre quadros, pintado uma vez. */
export function montarFundo(): HTMLCanvasElement {
  const { c, g } = novaTela(W, H)
  const r = rngDe('caverna')
  pix(g, '#0d0c0f', 0, 0, W, H)
  pix(g, '#16141a', 0, 0, W, AGUA)
  for (let y = 24; y < AGUA; y++) {
    const l = Math.sqrt(Math.max(0, 1 - Math.pow((y - AGUA) / 62, 2))) * 72
    pix(g, '#0b0a0d', 150 - l, y, l * 2, 1)
  }
  for (let i = 0; i < 420; i++) pix(g, r() < 0.5 ? '#1c1a21' : '#110f14', Math.floor(r() * W), Math.floor(r() * AGUA))
  for (let i = 0; i < 11; i++) {
    const x = Math.floor(8 + i * 22 + r() * 10)
    const len = 6 + Math.floor(r() * 16)
    const lw = 3 + Math.floor(r() * 4)
    for (let k = 0; k < len; k++) {
      const ww = Math.max(1, Math.round(lw * (1 - k / len)))
      pix(g, '#211f26', x - (ww >> 1), k, ww)
      pix(g, '#2c2932', x - (ww >> 1), k)
    }
  }
  for (const [x, y, pts] of RUNAS) for (const [a, b] of pts) pix(g, 'rgba(121,169,204,0.3)', x + a, y + b)
  const camadas: readonly (readonly [string, number])[] = [['#0f2a33', AGUA], ['#0d252d', AGUA + 10], ['#0b2027', AGUA + 22], ['#091a20', AGUA + 35]]
  for (const [cor, y] of camadas) pix(g, cor, 0, y, W, H - y)
  for (let y = AGUA + 2; y < AGUA + 14; y += 2) {
    const l = 60 - (y - AGUA) * 3
    pix(g, 'rgba(5,10,12,0.45)', 150 - l, y, l * 2, 1)
  }
  pix(g, '#2f5f6b', 0, AGUA, W, 1)
  for (let k = 0; k < 16; k++) {
    const ww = Math.max(1, Math.round(6 * (k / 16)))
    pix(g, '#1f1d23', 226 - (ww >> 1), AGUA - 16 + k, ww)
  }
  for (let x = 0; x <= 68; x++) {
    const t = topoMargem(x)
    pix(g, '#24212a', x, t, 1, H - t)
    pix(g, '#3a363f', x, t)
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(r() * 64)
    const y = topoMargem(x) + 2 + Math.floor(r() * (H - topoMargem(x) - 2))
    pix(g, r() < 0.5 ? '#2b2831' : '#1d1b22', x, y)
  }
  pix(g, '#3a2a1a', 9, 50, 2, 14)
  return c
}

function anel(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, alfa: number): void {
  const n = Math.max(8, Math.round(r * 4))
  g.fillStyle = `rgba(143,199,212,${alfa})`
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.3), 1, 1)
  }
}

function respingo(g: CanvasRenderingContext2D, cx: number, cy: number, tau: number, semente: number, n: number, forca: number): void {
  if (tau < 0 || tau > 1) return
  g.fillStyle = '#9fd0da'
  for (let i = 0; i < n; i++) {
    const h1 = ((semente * 9301 + i * 49297) % 233280) / 233280
    const h2 = ((i * 7919 + semente * 104729) % 1000) / 1000
    const s = tau * 0.6
    const x = cx + (h1 - 0.5) * 34 * forca * s
    const y = cy - ((14 + h2 * 20) * forca * s - 60 * s * s)
    if (y <= cy) g.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
}

function linhaPix(g: CanvasRenderingContext2D, cor: string, pts: readonly Ponto[]): void {
  g.fillStyle = cor
  for (const [x, y] of pts) g.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** Bézier quadrática de `a` a `b` com controle `c`, amostrada sem buracos. */
function curva(a: Ponto, b: Ponto, c: Ponto, n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.6) + 4): Ponto[] {
  const o: Ponto[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    o.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]])
  }
  return o
}

function pescador(g: CanvasRenderingContext2D): void {
  pix(g, '#2a2730', PX - 3, PY - 3, 2, 3)
  pix(g, '#2a2730', PX + 1, PY - 3, 2, 3)
  pix(g, '#3d4f63', PX - 4, PY - 11, 8, 8)
  pix(g, '#2f3d4d', PX - 4, PY - 5, 8, 2)
  pix(g, '#d9b48f', PX - 2, PY - 14, 5, 3)
  pix(g, '#1b1208', PX + 1, PY - 13)
  pix(g, '#c9963f', PX - 4, PY - 15, 9, 1)
  pix(g, '#c9963f', PX - 2, PY - 17, 5, 2)
  pix(g, '#3d4f63', PX + 2, PY - 10, 3, 2)
  pix(g, '#d9b48f', MAO[0] - 1, MAO[1] - 1, 2, 2)
}

let fundo: HTMLCanvasElement | null = null

/** Cena do lago a partir do estado do jogo; `segurando` = o jogador desta cena está segurando agora (dobra a vara). */
export function desenharLago(g: CanvasRenderingContext2D, J: Readonly<CenaDaPesca>, segurando: boolean): void {
  if (!fundo) fundo = montarFundo()
  g.drawImage(fundo, 0, 0)
  const t = J.t
  const red = J.reduzido
  const f = J.fase
  const e = J.puxada
  const res = J.resultado
  const chama = red ? 1 : 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23.7) * 0.07
  const brilho = g.createRadialGradient(10, 46, 2, 10, 46, 46)
  brilho.addColorStop(0, `rgba(243,186,102,${0.2 * chama})`)
  brilho.addColorStop(1, 'rgba(243,186,102,0)')
  g.fillStyle = brilho
  g.fillRect(0, 0, 70, 100)
  pix(g, '#e2645a', 8, 46, 4, 4)
  pix(g, '#f3ba66', 9, chama > 0.9 ? 44 : 45, 2, 3)
  const tAgua = red ? 0 : t
  for (let i = 0; i < 14; i++) {
    const x = 70 + ((((i * 37 + tAgua * (i % 2 ? 6 : -5)) % 170) + 170) % 170)
    const y = AGUA + 3 + (i % 5) * 9 + (i % 3)
    pix(g, 'rgba(47,95,107,0.55)', x, y, 3 + (i % 4), 1)
  }
  pescador(g)
  const bx = 100 + J.dist * 118
  let ang = -1.0
  let dobra = 0
  let boia: Ponto | null = null
  let folga = 10
  if (f === 'lance' || f === 'convite') {
    ang = -1.0 - (J.carregando ? J.forca * 1.1 : 0)
    boia = null
  } else if (f === 'voo') {
    const tau = clamp(J.tFase / DUR.voo(red), 0, 1)
    ang = tau < 0.25 ? lerp(-2.1, -0.35, tau / 0.25) : lerp(-0.35, -0.7, (tau - 0.25) / 0.75)
    const p0: Ponto = [MAO[0] + Math.cos(ang) * 22, MAO[1] + Math.sin(ang) * 22]
    boia = [lerp(p0[0], bx, tau), lerp(p0[1], AGUA - 3, tau) - (red ? 0 : Math.sin(Math.PI * tau) * 30)]
    folga = 0
  } else if (f === 'espera' || f === 'cedo' || f === 'fisgada') {
    ang = f === 'fisgada' && J.tFase < 0.12 ? -1.15 : -0.7
    let by = AGUA - 3 + (red ? 0 : Math.round(Math.sin(t * 2.2) * 0.7))
    const tb = J.tFase - J.beliscou
    if (f === 'espera' && tb >= 0 && tb < 0.3) {
      by += 2
      anel(g, bx + 1, AGUA, 2 + tb * 18, 0.6 * (1 - tb / 0.3))
    }
    if (f === 'fisgada') {
      by += 3
      for (let k = 0; k < 2; k++) {
        const rr = ((J.tFase * 20 + k * 6) % 12) + 2
        anel(g, bx + 1, AGUA, rr, 0.7 * (1 - rr / 14))
      }
    }
    if (f === 'espera' && J.tFase < 0.5) {
      respingo(g, bx + 1, AGUA, J.tFase / 0.5, J.n + 1, 10, 0.6 + J.dist * 0.4)
      anel(g, bx + 1, AGUA, 2 + J.tFase * 16, 0.6 * (1 - J.tFase / 0.5))
    }
    if (f === 'cedo') {
      const tau = clamp(J.tFase / 0.4, 0, 1)
      boia = [lerp(bx, MAO[0] + 12, tau), lerp(by, MAO[1] - 4, tau) - Math.sin(Math.PI * tau) * 8]
      folga = 4
    } else boia = [bx, by]
  } else if ((f === 'puxada' || f === 'final' || f === 'resultado') && e && res?.tipo !== 'fugiu') {
    const p = e.p
    const sx = bx + Math.sin(t * 1.7) * 5 + (p.y - 0.5) * 14
    const sy = AGUA + 6 + (1 - p.y) * 30
    if (!e.fim || f === 'puxada') {
      for (let k = -5; k <= 5; k++) pix(g, 'rgba(4,14,18,0.75)', sx + k, sy + (Math.abs(k) > 3 ? 1 : 0), 1, Math.abs(k) > 3 ? 1 : 3)
      ang = -0.95
      dobra = 4 + (segurando ? 3 : 0) + (red ? 0 : Math.sin(t * 17) * 0.8)
      boia = [lerp(bx, sx, 0.4), AGUA - 2 + (p.y > 0.75 ? 0 : 1) + (red ? 0 : Math.round(Math.sin(t * 30) * Math.min(1, Math.abs(p.v))))]
      folga = 1
      if (p.y > 0.72 && !red) {
        const k = Math.floor(t / 0.6)
        respingo(g, boia[0], AGUA, (t - k * 0.6) / 0.6, k, 6, 0.6)
      }
    } else if (res && res.tipo === 'pegou') {
      ang = -1.25
      boia = null
      const sp = spriteDoPeixe(res.peixe)
      const tau = red ? 1 : clamp(J.fase === 'final' ? J.tFase / 0.7 : 1, 0, 1)
      const x = lerp(bx, PX - sp.w / 2, tau)
      const y = lerp(AGUA - 6, PY - 22 - sp.h, tau) - (red ? 0 : Math.sin(Math.PI * tau) * 24)
      g.drawImage(sp.c, Math.round(x), Math.round(y))
      if (tau >= 1) {
        const fase2 = Math.floor(t * 6) % 2
        const brilhos: readonly Ponto[] = [[-3, 2], [sp.w + 2, 0], [sp.w / 2, -3]]
        brilhos.forEach(([dx, dy], i) => {
          if ((i + fase2) % 2 === 0) pix(g, '#f3ba66', Math.round(PX - sp.w / 2 + dx), Math.round(PY - 22 - sp.h + dy))
        })
      }
      if (f === 'final' && J.tFase < 0.4) respingo(g, bx, AGUA, J.tFase / 0.4, 7, 12, 1)
    } else {
      ang = -0.6
      folga = 14
      boia = [bx, AGUA - 3 + (red ? 0 : Math.round(Math.sin(t * 2.2) * 0.7))]
      const tf = f === 'final' ? J.tFase : 2
      if (tf < 1.2) anel(g, bx + 1, AGUA, 3 + tf * 14, 0.6 * (1 - tf / 1.2))
    }
  } else if (res && res.tipo === 'fugiu') {
    ang = -0.6
    folga = 14
    boia = [bx, AGUA - 3]
    const tf = f === 'final' ? J.tFase : 2
    if (tf < 1.2) anel(g, bx + 1, AGUA, 3 + tf * 14, 0.6 * (1 - tf / 1.2))
  }
  const ponta: Ponto = [MAO[0] + Math.cos(ang) * 22, MAO[1] + Math.sin(ang) * 22 + dobra]
  const meio: Ponto = [MAO[0] + Math.cos(ang) * 11, MAO[1] + Math.sin(ang) * 11 + dobra * 0.25]
  linhaPix(g, '#7a5a3a', curva(MAO, ponta, meio))
  if (boia) {
    const ctl: Ponto = [(ponta[0] + boia[0]) / 2, Math.max(ponta[1], boia[1]) + folga]
    linhaPix(g, 'rgba(217,212,199,0.7)', curva(ponta, [boia[0] + 1, boia[1]], ctl))
    mapa(g, BOIA, BOIA_PAL, Math.round(boia[0]), Math.round(boia[1]))
  }
  if (f === 'fisgada') {
    const dy = red ? 0 : Math.round(2 * Math.max(0, 1 - J.tFase / 0.12))
    pix(g, '#1b1208', PX - 4, PY - 36 + dy, 8, 15)
    pix(g, '#f2c14e', PX - 3, PY - 35 + dy, 6, 13)
    mapa(g, EXCLAMA.slice(1, 12).map((l) => l.replace(/o/g, '.')), { k: '#1b1208' }, PX - 2, PY - 34 + dy)
  }
}

// ------------------------------------------------------------------ instrumento

/** Cor do medidor de captura: vermelho, âmbar e verde, misturados. */
export function corMedidor(m: number): string {
  const a = m < 0.5 ? [226, 100, 90] : [224, 164, 74]
  const b = m < 0.5 ? [224, 164, 74] : [127, 180, 138]
  const k = m < 0.5 ? m * 2 : (m - 0.5) * 2
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`
}

/** Altura na coluna (0 fundo, 1 topo) para y do canvas. */
const yCol = (v: number): number => CY + CH - v * CH

function carretel(g: CanvasRenderingContext2D, x: number, y: number, ang: number): void {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    pix(g, '#6b665d', x + Math.cos(a) * 4, y + Math.sin(a) * 4)
  }
  pix(g, '#a29b8c', x, y)
  linhaPix(g, '#c9963f', [1, 2, 3, 4, 5].map((k): Ponto => [x + Math.cos(ang) * k, y + Math.sin(ang) * k]))
  pix(g, '#f2c14e', x + Math.cos(ang) * 6, y + Math.sin(ang) * 6, 2, 2)
}

/** Instrumento da coluna: força do lance, espera, "!" da fisgada e a barra de pesca. */
export function desenharInstr(g: CanvasRenderingContext2D, J: Readonly<CenaDaPesca>): void {
  g.clearRect(0, 0, IW, IH)
  pix(g, '#2b2730', CX - 3, CY - 3, CW + 6, CH + 6)
  pix(g, '#3d3843', CX - 3, CY - 3, CW + 6, 1)
  pix(g, '#2b2730', MX - 3, CY - 3, MW + 6, CH + 6)
  pix(g, '#3d3843', MX - 3, CY - 3, MW + 6, 1)
  pix(g, '#0f2a33', CX, CY, CW, 60)
  pix(g, '#0c232b', CX, CY + 60, CW, 60)
  pix(g, '#0a1c22', CX, CY + 120, CW, 60)
  pix(g, '#141417', MX, CY, MW, CH)
  const f = J.fase
  const e = J.puxada
  const res = J.resultado
  if (!J.reduzido) for (let i = 0; i < 6; i++) pix(g, '#1f4b56', CX + 3 + ((i * 7) % (CW - 6)), CY + CH - 2 - ((J.t * 12 + i * 31) % (CH - 4)))
  if ((f === 'puxada' || f === 'final' || f === 'resultado') && e && (!res || res.tipo !== 'fugiu')) {
    const b = e.b
    const y0 = Math.round(yCol(b.y + b.tam))
    const y1 = Math.round(yCol(b.y))
    pix(g, e.dentro ? 'rgba(143,199,154,0.9)' : 'rgba(107,154,118,0.8)', CX, y0, CW, y1 - y0)
    pix(g, '#c4e6c9', CX, y0, CW, 1)
    pix(g, '#c4e6c9', CX, y1 - 1, CW, 1)
    if (e.bau && e.bau.estado === 'visivel') {
      const by = Math.round(yCol(e.bau.y)) - 3
      mapa(g, BAU, BAU_PAL, CX + 1, by)
      pix(g, '#141417', CX + 1, by + 8, 9, 2)
      pix(g, '#f2c14e', CX + 1, by + 8, Math.round(9 * e.bau.prog), 2)
    }
    const ondula = J.reduzido ? 0 : Math.round(Math.sin(J.t * 9) * 1.2)
    mapa(g, PEIXINHO, PEIXINHO_PAL, CX + 9 + ondula, Math.round(yCol(e.p.y)) - 3)
    const mh = Math.round(e.m * CH)
    pix(g, corMedidor(e.m), MX, CY + CH - mh, MW, mh)
  } else if (f === 'fisgada') {
    const dy = J.reduzido ? 0 : Math.round(3 * Math.max(0, 1 - J.tFase / 0.12))
    const d = DIF[J.dif]
    mapa(g, EXCLAMA, { o: '#1b1208', k: '#f2c14e' }, CX + 10, CY + 50 + dy, 2)
    const resto = clamp(1 - J.tFase / d.janela, 0, 1)
    const mh = Math.round(resto * CH)
    pix(g, '#e2645a', MX, CY + CH - mh, MW, mh)
  } else if (f === 'espera' || ((f === 'final' || f === 'resultado') && res && res.tipo === 'fugiu')) {
    pix(g, '#2f5f6b', CX, CY + 18, CW, 1)
    const tb = J.tFase - J.beliscou
    const dip = f === 'espera' && tb >= 0 && tb < 0.3 ? 2 : 0
    const bob = J.reduzido ? 0 : Math.round(Math.sin(J.t * 2.2) * 0.8)
    linhaPix(g, 'rgba(217,212,199,0.6)', Array.from({ length: 12 }, (_, i): Ponto => [CX + 15, CY + i]))
    mapa(g, BOIA, BOIA_PAL, CX + 14, CY + 15 + bob + dip)
  } else {
    const v = f === 'lance' ? J.forca : J.dist
    pix(g, 'rgba(121,169,204,0.12)', CX, yCol(0.4), CW, CH * 0.4)
    pix(g, 'rgba(224,164,74,0.12)', CX, yCol(0.8), CW, CH * 0.4)
    pix(g, 'rgba(127,180,138,0.16)', CX, CY, CW, CH * 0.2)
    pix(g, 'rgba(236,234,228,0.35)', CX, Math.round(yCol(0.4)), CW, 1)
    pix(g, 'rgba(236,234,228,0.35)', CX, Math.round(yCol(0.8)), CW, 1)
    const h = Math.round(v * CH)
    const cor = v >= 0.8 ? '#7fb48a' : v >= 0.4 ? '#e0a44a' : '#79a9cc'
    if (h > 0) {
      pix(g, cor, CX + 6, CY + CH - h, CW - 12, h)
      pix(g, '#eceae4', CX + 6, CY + CH - h, CW - 12, 1)
    }
  }
  carretel(g, 9, CY + CH - 10, J.giro)
}

// ------------------------------------------------------------------ retrato e placa

/** Retrato do barqueiro, 14 x 15. */
export function desenharNpc(g: CanvasRenderingContext2D): void {
  g.clearRect(0, 0, 14, 15)
  mapa(
    g,
    ['....hhhhhh....', '...hhhhhhhh...', '..bbbbbbbbbb..', '...pppppppp...', '...pdpppdpp...', '...pppppppp...', '..wppnpppppw..', '..wwwwwwwwww..', '..wwwwmmwwww..', '...wwwwwwww...', '....wwwwww....', '..cccwwwwccc..', '.cccccwwccccc.', '.cccccccccccc.', '.cccccccccccc.'],
    { h: '#3d4f63', b: '#2f3d4d', p: '#c8946a', d: '#1b1208', n: '#a8724f', w: '#d9d4c7', m: '#8a5a3a', c: '#5b4a36' },
    0,
    0,
  )
}

/** Placa de água do resultado, 64 x 34: o peixe pego, a silhueta do que escapou, ou só os anéis. */
export function desenharPlaca(g: CanvasRenderingContext2D, r: ResultadoNaCena | null): void {
  g.clearRect(0, 0, 64, 34)
  pix(g, '#0f2a33', 0, 0, 64, 34)
  pix(g, '#0c232b', 0, 14, 64, 10)
  pix(g, '#0a1c22', 0, 24, 64, 10)
  for (let i = 0; i < 9; i++) pix(g, 'rgba(47,95,107,0.6)', ((i * 23) % 60) + 2, 4 + ((i * 7) % 26), 2 + (i % 3), 1)
  if (!r || !r.peixe || r.tipo === 'fugiu' || r.tipo === 'encerrado') {
    anel(g, 32, 18, 8, 0.5)
    anel(g, 32, 18, 4, 0.7)
    return
  }
  const sp = spriteDoPeixe(r.peixe)
  const s = sp.w * 2 <= 60 && sp.h * 2 <= 32 ? 2 : 1
  g.imageSmoothingEnabled = false
  if (r.tipo === 'pegou') g.drawImage(sp.c, Math.round(32 - (sp.w * s) / 2), Math.round(17 - (sp.h * s) / 2), sp.w * s, sp.h * s)
  else {
    g.globalAlpha = 0.35
    g.filter = 'brightness(0)'
    g.drawImage(sp.c, Math.round(32 - (sp.w * s) / 2), Math.round(17 - (sp.h * s) / 2), sp.w * s, sp.h * s)
    g.filter = 'none'
    g.globalAlpha = 1
  }
}
