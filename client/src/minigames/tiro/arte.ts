import { DIF, H, POP_X, semear, TIPOS, W, Y, type Alvo, type Rodada, type TipoDeAlvo } from './sim'
import type { MedalhaTiro } from './tipos'

/**
 * ARTE DO TIRO AO ALVO: a barraca (parede, toldo, trilhos, caixotes, balcão
 * e cortinas), os alvos desenhados por forma a partir da caixa de acerto, o
 * revólver, a mira, os números 3×5, o retrato da Tia e a medalha. Porte fiel
 * da pixel art do protótipo aprovado; o estado do jogo entra por parâmetro,
 * nada é lido de global. Canvas de 256 × 144, ampliado pelo CSS sem suavizar.
 */

const CONTORNO = '#1b1208'

/** Um efeito solto no palco: o número que sobe do acerto, ou uma lasca. */
export type EfeitoNoPalco =
  | { tipo: 'txt'; s: string; x: number; y: number; y0: number; vida: number; cor: string }
  | { tipo: 'p'; x: number; y: number; vx: number; vy: number; vida: number; cor: string }

/** O que a arte lê do jogo a cada quadro. */
export interface CenaDoTiro {
  R: Rodada | null
  /** No convite a Tia fica no balcão; no jogo aparecem a arma e a mira. */
  tela: 'convite' | 'jogo' | 'resultado'
  mira: { x: number; y: number }
  /** 0..1: o coice da arma depois do tiro. */
  coice: number
  flash: number
  tremor: number
  alvoFlash: readonly [number, number] | null
  fx: readonly EfeitoNoPalco[]
  furos: readonly (readonly [number, number])[]
  reduzido: boolean
}

type Tela = { c: HTMLCanvasElement; g: CanvasRenderingContext2D }

/** Único ponto que cria canvas. */
function nova(w: number, h: number): Tela {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas 2D indisponível')
  return { c, g }
}

function elipse(g: CanvasRenderingContext2D, cor: string, cx: number, cy: number, rx: number, ry: number): void {
  g.fillStyle = cor
  for (let j = Math.floor(cy - ry); j < cy + ry; j++) {
    const dy = (j + 0.5 - cy) / ry
    const m = 1 - dy * dy
    if (m <= 0) continue
    const h = rx * Math.sqrt(m)
    const a = Math.round(cx - h)
    const b = Math.round(cx + h)
    if (b > a) g.fillRect(a, j, b - a, 1)
  }
}

const disco = (g: CanvasRenderingContext2D, cor: string, cx: number, cy: number, r: number): void => elipse(g, cor, cx, cy, r, r)

function ret(g: CanvasRenderingContext2D, cor: string, x: number, y: number, w: number, h: number): void {
  g.fillStyle = cor
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
}

function mapa(g: CanvasRenderingContext2D, linhas: readonly string[], pal: Readonly<Record<string, string>>, x: number, y: number): void {
  linhas.forEach((l, j) => {
    for (let i = 0; i < l.length; i++) {
      const c = pal[l.charAt(i)]
      if (c !== undefined) {
        g.fillStyle = c
        g.fillRect(x + i, y + j, 1, 1)
      }
    }
  })
}

const VIZINHOS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function contorno(c: HTMLCanvasElement, gOrigem: CanvasRenderingContext2D): HTMLCanvasElement {
  const o = nova(c.width, c.height)
  const d = gOrigem.getImageData(0, 0, c.width, c.height).data
  o.g.fillStyle = CONTORNO
  const cheio = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.width && y < c.height && (d[(y * c.width + x) * 4 + 3] ?? 0) > 0
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (cheio(x, y)) continue
      if (VIZINHOS.some(([a, b]) => cheio(x + a, y + b))) o.g.fillRect(x, y, 1, 1)
    }
  }
  o.g.drawImage(c, 0, 0)
  return o.c
}

function espelhar(c: HTMLCanvasElement): HTMLCanvasElement {
  const o = nova(c.width, c.height)
  o.g.translate(c.width, 0)
  o.g.scale(-1, 1)
  o.g.drawImage(c, 0, 0)
  return o.c
}

type Desenho = (g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, q: number) => void

/** Os alvos são desenhados por formas a partir do tamanho da caixa de acerto: no Extremo saem menores sem perder o pixel. */
const DESENHO: Readonly<Record<TipoDeAlvo, Desenho>> = {
  anel(g, cx, cy, w) {
    disco(g, '#efe3c4', cx, cy, w)
    disco(g, '#b5402f', cx, cy, w * 0.74)
    disco(g, '#efe3c4', cx, cy, w * 0.5)
    disco(g, '#b5402f', cx, cy, w * 0.27)
    ret(g, '#fff6df', cx - w * 0.55, cy - w * 0.62, 1, 1)
  },
  garrafa(g, cx, cy, w, h) {
    ret(g, '#2f6b4c', cx - w, cy - h * 0.25, w * 2, h * 1.25)
    ret(g, '#2f6b4c', cx - w * 0.5, cy - h, w, h * 0.8)
    ret(g, '#8a5a22', cx - w * 0.5, cy - h, w, 1.5)
    ret(g, '#e6d9b4', cx - w, cy + h * 0.15, w * 2, h * 0.35)
    ret(g, '#9fe0b8', cx - w + 1, cy - h * 0.15, 1, h * 0.3)
  },
  goblin(g, cx, cy, w, h) {
    ret(g, '#8a6a3a', cx - w * 0.75, cy + h * 0.05, w * 1.5, h * 0.95)
    ret(g, '#6f522b', cx - w * 0.75, cy + h * 0.05, w * 1.5, 1)
    const hy = cy - h * 0.38
    const r = w * 0.6
    for (let i = 0; i < r; i++) {
      ret(g, '#6f8f45', cx - r - w * 0.4 + i * 0.6, hy - i * 0.35, w * 0.4 - i * 0.3, 1)
      ret(g, '#6f8f45', cx + r + i * -0.6, hy - i * 0.35, w * 0.4 - i * 0.3, 1)
    }
    disco(g, '#7da24c', cx, hy, r)
    ret(g, '#f2c14e', cx - r * 0.5, hy - r * 0.2, 1, 1)
    ret(g, '#f2c14e', cx + r * 0.5 - 1, hy - r * 0.2, 1, 1)
    ret(g, '#2a1a0c', cx - r * 0.45, hy + r * 0.4, r * 0.9, 1)
    ret(g, '#f3ead2', cx - r * 0.3, hy + r * 0.4, 1, 1)
    ret(g, '#f3ead2', cx + r * 0.2, hy + r * 0.4, 1, 1)
  },
  aldeao(g, cx, cy, w, h) {
    ret(g, '#4f6f9e', cx - w * 0.75, cy + h * 0.05, w * 1.5, h * 0.95)
    ret(g, '#e6d9b4', cx - w * 0.3, cy + h * 0.05, w * 0.6, 1.5)
    const hy = cy - h * 0.35
    const r = w * 0.55
    disco(g, '#d6a577', cx, hy, r)
    ret(g, '#c9a24a', cx - w, hy - r * 0.55, w * 2, 1.5)
    ret(g, '#b08a36', cx - r * 0.8, hy - r * 1.25, r * 1.6, r * 0.75)
    ret(g, '#2a1a0c', cx - r * 0.45, hy + r * 0.05, 1, 1)
    ret(g, '#2a1a0c', cx + r * 0.45 - 1, hy + r * 0.05, 1, 1)
    ret(g, '#a0523a', cx - r * 0.25, hy + r * 0.5, r * 0.5, 1)
  },
  rato(g, cx, cy, w, h) {
    ret(g, '#5a4636', cx - w * 1.15, cy + h * 0.1, w * 0.45, 1)
    ret(g, '#5a4636', cx - w * 1.3, cy - h * 0.2, 1, h * 0.35)
    elipse(g, '#8c7b69', cx - w * 0.1, cy, w * 0.8, h * 0.85)
    elipse(g, '#9c8b78', cx + w * 0.55, cy + h * 0.1, w * 0.4, h * 0.6)
    disco(g, '#c98b8b', cx + w * 0.25, cy - h * 0.6, Math.max(1.2, h * 0.4))
    ret(g, '#1b1208', cx + w * 0.6, cy - h * 0.1, 1, 1)
    ret(g, '#d98a8a', cx + w * 0.92, cy + h * 0.05, 1, 1)
    ret(g, '#3a2c20', cx - w * 0.5, cy + h * 0.75, 1.5, 1)
    ret(g, '#3a2c20', cx + w * 0.3, cy + h * 0.75, 1.5, 1)
  },
  morcego(g, cx, cy, w, h, q) {
    const s = q ? -1 : 1
    for (let i = 0; i < w * 0.9; i++) {
      const lg = Math.max(1, h * 0.9 - i * 0.35)
      const y = cy - s * i * 0.45 - lg * (s > 0 ? 0 : 1) + (s > 0 ? -lg * 0.2 : lg * 0.4)
      ret(g, '#5a4670', cx + h * 0.35 + i, y, 1, lg)
      ret(g, '#5a4670', cx - h * 0.35 - i - 1, y, 1, lg)
    }
    disco(g, '#3d2f4a', cx, cy, h * 0.75)
    ret(g, '#3d2f4a', cx - h * 0.55, cy - h * 1.05, 1, 1)
    ret(g, '#3d2f4a', cx + h * 0.55 - 1, cy - h * 1.05, 1, 1)
    ret(g, '#f3e9d2', cx - h * 0.35, cy - h * 0.15, 1, 1)
    ret(g, '#f3e9d2', cx + h * 0.35 - 1, cy - h * 0.15, 1, 1)
  },
  moeda(g, cx, cy, w, _h, q) {
    const k = [1, 0.7, 0.25, 0.7][q] ?? 1
    elipse(g, '#b8862f', cx, cy, Math.max(0.8, w * k), w)
    elipse(g, '#f2c14e', cx - (k > 0.3 ? 0.5 : 0), cy, Math.max(0.6, w * k - 1), w - 1)
    if (k > 0.5) ret(g, '#fff3c4', cx - w * k * 0.4, cy - w * 0.5, 1, 1)
  },
  gato(g, cx, cy, w, h) {
    elipse(g, '#7e93a6', cx, cy + h * 0.35, w * 0.75, h * 0.62)
    const hy = cy - h * 0.3
    const r = w * 0.58
    for (let i = 0; i < r * 0.9; i++) {
      ret(g, '#8ea3b5', cx - r + i * 0.5, hy - r * 0.6 - (r * 0.9 - i) * 0.7, r * 0.5 - i * 0.4 + 1, 1)
      ret(g, '#8ea3b5', cx + r * 0.5 - i * 0.1, hy - r * 0.6 - (r * 0.9 - i) * 0.7, r * 0.5 - i * 0.4 + 1, 1)
    }
    disco(g, '#8ea3b5', cx, hy, r)
    ret(g, '#1b1208', cx - r * 0.45, hy, 1, 1)
    ret(g, '#1b1208', cx + r * 0.45 - 1, hy, 1, 1)
    ret(g, '#f2c14e', cx - 0.5, hy + r * 1.05, 1.5, 1.5)
    ret(g, '#c4d2de', cx - r * 0.6, hy - r * 0.5, 1, 1)
  },
}

const SPR = new Map<string, HTMLCanvasElement>()

/** O sprite do alvo, com contorno, por tipo, escala, quadro e lado; feito uma vez e guardado. */
export function sprite(tipo: TipoDeAlvo, e: number, q = 0, dir = 1): HTMLCanvasElement {
  const chave = `${tipo}|${e}|${q}|${dir}`
  const pronto = SPR.get(chave)
  if (pronto !== undefined) return pronto
  const T = TIPOS[tipo]
  const w = T.w * e
  const h = T.h * e
  const b = nova(Math.ceil(2 * w) + 6, Math.ceil(2 * h) + 6)
  DESENHO[tipo](b.g, b.c.width / 2, b.c.height / 2, w, h, q)
  let c = contorno(b.c, b.g)
  if (dir < 0) c = espelhar(c)
  SPR.set(chave, c)
  return c
}

const PAL: Readonly<Record<string, string>> = { k: '#1b1208', g: '#4b505b', h: '#7d838f', c: '#646a76', b: '#d9b45a', s: '#c58c62', d: '#9c6a47', m: '#6d2f2a', n: '#4a2220', r: '#9e3a2e', R: '#c4533f', y: '#8f8a84', e: '#f2c14e', w: '#f3ead2', o: '#2a1a0c' }
const ARMA: readonly string[] = [
  '......k......',
  '.....kbk.....',
  '.....kgk.....',
  '.....khk.....',
  '.....kgk.....',
  '.....khk.....',
  '.....kgk.....',
  '.....khk.....',
  '....kgggk....',
  '...kcchcck...',
  '...kchccck...',
  '...kcchcck...',
  '...kchccck...',
  '....kgggk....',
  '....kgggkk...',
  '...kggggkhk..',
  '..kssddgkk...',
  '.kssssddsk...',
  '.ksdssssssk..',
  'kssdsssssssk.',
  'ksssssssssssk',
  'ksdssssssssk.',
  '.ksssssssssk.',
  '.kmmmmmmmmmk.',
  'kmmmmmmmmmmmk',
  'kmnmmmmmmmnmk',
  'kmmmmmmmmmmmk',
]
const NPC: readonly string[] = [
  '....kkkkkkk.....',
  '..kkrrrRrrrkk...',
  '.krrrrRRrrrrrk..',
  'krrrrrrrrrrrrrk.',
  'krrkkkkkkkkkrrk.',
  'krkyysssssyykrk.',
  '.kysssssssssyk..',
  '.ksskssssskssk..',
  '.ksssssssssssk..',
  'eksdsssssssdske.',
  '.ksssswwwssssk..',
  '..kssssssssskk..',
  '...kkssssskk....',
  '..kmmkkkkkmmk...',
  '.kmmmmwwwmmmmk..',
  'kmmmmmwwwmmmmmk.',
]
const MIRA: readonly string[] = ['...kwk...', '...kwk...', '.........', 'kk.....kk', 'ww..e..ww', 'kk.....kk', '.........', '...kwk...', '...kwk...']
const DIGITOS: Readonly<Record<string, string>> = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', '+': '000010111010000', '-': '000000111000000' }

/** Texto em dígitos 3×5 com sombra, centrado em `x`. */
function texto3x5(g: CanvasRenderingContext2D, s: string, x: number, y: number, cor: string): void {
  const largura = s.length * 4 - 1
  let px = Math.round(x - largura / 2)
  for (const ch of s) {
    const d = DIGITOS[ch]
    if (d !== undefined) {
      for (let i = 0; i < 15; i++) {
        if (d.charAt(i) !== '1') continue
        g.fillStyle = CONTORNO
        g.fillRect(px + (i % 3) + 1, y + Math.floor(i / 3) + 1, 1, 1)
        g.fillStyle = cor
        g.fillRect(px + (i % 3), y + Math.floor(i / 3), 1, 1)
      }
    }
    px += 4
  }
}

/** Camadas fixas do palco, pintadas uma vez: parede, toldo, trilhos (fundo); caixotes e barris (barreira); balcão e cortinas (frente). */
export interface CamadasDoPalco {
  fundo: HTMLCanvasElement
  barreira: HTMLCanvasElement
  frente: HTMLCanvasElement
  /** O aldeão e o gato lado a lado, para o aviso dos proibidos. */
  proib: HTMLCanvasElement
}

let camadasProntas: CamadasDoPalco | null = null

export function camadas(): CamadasDoPalco {
  if (camadasProntas !== null) return camadasProntas
  const r = semear('tabuas')
  const fundo = nova(W, H)
  let g = fundo.g
  ret(g, '#3b2a1d', 0, 0, W, H)
  for (let x = 0; x < W; x += 16) {
    ret(g, '#2c1f15', x, 0, 1, H)
    ret(g, '#45311f', x + 1, 0, 1, H)
    for (let k = 0; k < 2; k++) {
      const dx = Math.floor(r() * 9)
      ret(g, '#2f2117', x + 4 + dx, 18 + Math.floor(r() * 80), 2, 1)
    }
  }
  for (let x = 0; x < W; x += 24) {
    const cor = (x / 24) % 2 ? '#d9c7a1' : '#8e3b32'
    ret(g, cor, x, 0, 24, 10)
    disco(g, cor, x + 12, 10, 12 * 0.5 + 0.5)
  }
  ret(g, CONTORNO, 0, 0, W, 1)
  for (const lx of [44, 212]) {
    g.globalAlpha = 0.08
    disco(g, '#f2c14e', lx, 20, 16)
    g.globalAlpha = 0.12
    disco(g, '#f2c14e', lx, 20, 9)
    g.globalAlpha = 1
    ret(g, CONTORNO, lx, 12, 1, 4)
    ret(g, CONTORNO, lx - 3, 16, 7, 8)
    ret(g, '#f2c14e', lx - 2, 17, 5, 5)
    ret(g, '#fff3c4', lx - 1, 18, 2, 2)
  }
  for (const y of [Y.t1, Y.t2]) {
    ret(g, CONTORNO, 0, y - 1, W, 4)
    ret(g, '#c9963f', 0, y, W, 1)
    ret(g, '#7a5a22', 0, y + 1, W, 1)
    for (let x = 8; x < W; x += 32) ret(g, '#f2c14e', x, y, 1, 1)
  }
  ret(g, '#24180f', 0, Y.pop - 6, W, 6)

  const barreira = nova(W, H)
  g = barreira.g
  ret(g, '#4a3524', 0, Y.pop, W, 18)
  ret(g, CONTORNO, 0, Y.pop, W, 1)
  ret(g, '#5c4330', 0, Y.pop + 1, W, 1)
  for (let x = 0; x < W; x += 9) ret(g, '#3a2a1c', x, Y.pop + 2, 1, 16)
  POP_X.forEach((x, i) => {
    if (i % 2 === 0) {
      ret(g, CONTORNO, x - 15, Y.pop - 2, 30, 20)
      ret(g, '#8a6436', x - 14, Y.pop - 1, 28, 18)
      ret(g, '#6b4a26', x - 14, Y.pop + 7, 28, 1)
      ret(g, '#6b4a26', x - 1, Y.pop - 1, 2, 18)
      ret(g, '#a47a44', x - 14, Y.pop - 1, 28, 1)
    } else {
      elipse(g, CONTORNO, x, Y.pop + 8, 14, 11)
      elipse(g, '#6e4a2c', x, Y.pop + 8, 13, 10)
      ret(g, '#3a3940', x - 13, Y.pop + 1, 26, 2)
      ret(g, '#3a3940', x - 13, Y.pop + 13, 26, 2)
      ret(g, '#8b6a46', x - 6, Y.pop + 3, 2, 9)
    }
  })
  ret(g, CONTORNO, 0, Y.chao, W, 1)
  ret(g, '#2a1c12', 0, Y.chao + 1, W, 3)

  const frente = nova(W, H)
  g = frente.g
  ret(g, CONTORNO, 0, 118, W, 26)
  ret(g, '#6b4426', 0, 119, W, 25)
  ret(g, '#8a5a32', 0, 119, W, 2)
  ret(g, '#c9963f', 0, 121, W, 1)
  for (let x = 6; x < W; x += 20) ret(g, '#5a3820', x, 124, 1, 20)
  for (const [x0, dir] of [[0, 1], [W - 14, -1]] as const) {
    ret(g, CONTORNO, dir > 0 ? 14 : W - 15, 8, 1, 112)
    ret(g, '#6b2430', x0, 0, 14, 120)
    for (let k = 0; k < 3; k++) ret(g, '#55202a', x0 + 2 + k * 4, 0, 1, 118)
    ret(g, '#8a3440', x0 + (dir > 0 ? 11 : 1), 0, 1, 118)
  }

  const proib = nova(28, 14)
  proib.g.drawImage(sprite('aldeao', 0.6), 0, -1)
  proib.g.drawImage(sprite('gato', 0.8), 15, 1)
  camadasProntas = { fundo: fundo.c, barreira: barreira.c, frente: frente.c, proib: proib.c }
  return camadasProntas
}

/** O quadro do sprite: o morcego bate asa, a moeda gira (mais rápido caindo). */
function quadroDoAlvo(a: Alvo): number {
  if (a.tipo === 'morcego') return Math.floor(a.idade * 7) % 2
  if (a.tipo === 'moeda') return Math.floor(a.idade * (a.estado === 'caindo' ? 24 : 8)) % 4
  return 0
}

function desenharAlvo(g: CanvasRenderingContext2D, a: Alvo, escala: number): void {
  const c = sprite(a.tipo, escala, quadroDoAlvo(a), a.tipo === 'rato' ? Math.sign(a.vx) || 1 : 1)
  const x = Math.round(a.x - c.width / 2)
  let y = Math.round(a.y - c.height / 2)
  if (a.faixa === 'ar' && a.estado === 'ativo') ret(g, CONTORNO, Math.round(a.x), 12, 1, Math.max(0, y + 2 - 12))
  if (a.estado !== 'caindo') {
    g.drawImage(c, x, y)
    return
  }
  const te = a.te
  const fu = a.furo ?? [0, 0]
  // A garrafa estoura: some na hora, e as lascas fazem o resto.
  if (a.tipo === 'garrafa') return
  if (a.faixa === 't1' || a.faixa === 't2') {
    const sy = Math.cos((Math.min(1, te / 0.22) * Math.PI) / 2)
    if (sy < 0.08) {
      ret(g, CONTORNO, x + 2, Math.round(a.y + a.h), c.width - 4, 1)
      return
    }
    const hh = Math.max(1, Math.round(c.height * sy))
    const base = Math.round(a.y + c.height / 2)
    g.drawImage(c, x, base - hh, c.width, hh)
    ret(g, '#120c08', Math.round(a.x + fu[0]) - 1, Math.round(base - hh + (fu[1] + c.height / 2) * sy) - 1, 2, Math.max(1, Math.round(2 * sy)))
    return
  }
  g.save()
  if (a.faixa === 'pop') {
    y += Math.round((te / 0.18) ** 2 * 18)
    g.drawImage(c, x, y)
    ret(g, '#120c08', Math.round(a.x + fu[0]) - 1, Math.round(a.y + fu[1]) - 1 + y - Math.round(a.y - c.height / 2), 2, 2)
  } else if (a.faixa === 'moeda') {
    g.globalAlpha = Math.max(0, 1 - te / 0.4)
    g.drawImage(c, x, y - Math.round(te * 40))
  } else {
    g.globalAlpha = Math.max(0, 1 - Math.max(0, te - 0.2) / 0.3)
    g.translate(0, y * 2 + c.height + (a.faixa === 'ar' ? Math.round(te * te * 120) : 0))
    g.scale(1, -1)
    g.drawImage(c, x, y)
  }
  g.restore()
}

function desenharArma(g: CanvasRenderingContext2D, cena: CenaDoTiro): void {
  const recarregando = cena.R !== null && cena.R.recarga > 0
  const k = cena.reduzido ? 0.25 : 1
  const x = Math.round(150 + (cena.mira.x - 128) * 0.3) - 6
  const y = Math.round(106 - cena.coice * 4 * k + (recarregando ? 9 : 0))
  mapa(g, ARMA, PAL, x, y)
  if (cena.flash > 0) {
    ret(g, '#fff3c4', x + 5, y - 4, 3, 3)
    ret(g, '#f2c14e', x + 6, y - 7, 1, 3)
    ret(g, '#f2c14e', x + 2, y - 3, 3, 1)
    ret(g, '#f2c14e', x + 8, y - 3, 3, 1)
    ret(g, '#e2645a', x + 6, y - 9, 1, 2)
  }
}

const FAIXAS_DE_TRAS = ['t1', 'ar', 't2', 'pop'] as const
const FAIXAS_DA_FRENTE = ['chao', 'moeda'] as const

/** Um quadro do palco: fundo, furos, alvos atrás dos caixotes, alvos da frente, efeitos, balcão, arma e mira. */
export function desenharPalco(g: CanvasRenderingContext2D, cena: CenaDoTiro): void {
  const CAM = camadas()
  const R = cena.R
  let ox = 0
  let oy = 0
  if (cena.tremor > 0 && !cena.reduzido) {
    ox = Math.round(Math.sin(cena.tremor * 170) * 1.4)
    oy = Math.round(Math.cos(cena.tremor * 130))
  }
  g.setTransform(1, 0, 0, 1, 0, 0)
  ret(g, '#0d0c0f', 0, 0, W, H)
  g.setTransform(1, 0, 0, 1, ox, oy)
  g.drawImage(CAM.fundo, 0, 0)
  for (const [x, y] of cena.furos) {
    ret(g, '#120c08', Math.round(x) - 1, Math.round(y) - 1, 2, 2)
    ret(g, '#6a4c30', Math.round(x) + 1, Math.round(y) - 1, 1, 1)
  }
  if (R === null || cena.tela === 'convite') mapa(g, NPC, PAL, 120, 102)
  const escala = DIF[R === null ? 'normal' : R.dif].escala
  if (R !== null) for (const faixa of FAIXAS_DE_TRAS) for (const a of R.alvos) if (a.faixa === faixa) desenharAlvo(g, a, escala)
  g.drawImage(CAM.barreira, 0, 0)
  if (R !== null) for (const faixa of FAIXAS_DA_FRENTE) for (const a of R.alvos) if (a.faixa === faixa) desenharAlvo(g, a, escala)
  for (const f of cena.fx) {
    if (f.tipo === 'txt') texto3x5(g, f.s, f.x, Math.round(f.y), f.cor)
    else {
      g.globalAlpha = Math.min(1, f.vida / 0.15)
      ret(g, f.cor, f.x, f.y, 1, 1)
      g.globalAlpha = 1
    }
  }
  g.drawImage(CAM.frente, 0, 0)
  if (R !== null && cena.tela === 'jogo') {
    desenharArma(g, cena)
    if (cena.flash > 0 && cena.alvoFlash !== null) {
      const [fx, fy] = cena.alvoFlash
      ret(g, '#fff6df', fx - 2, fy, 5, 1)
      ret(g, '#fff6df', fx, fy - 2, 1, 5)
    }
    mapa(g, MIRA, PAL, Math.round(cena.mira.x) - 4, Math.round(cena.mira.y) - 4)
  }
  g.setTransform(1, 0, 0, 1, 0, 0)
}

/** O retrato da Tia Ferrolha no convite, em 16 × 16. */
export function desenharRetrato(g: CanvasRenderingContext2D): void {
  g.clearRect(0, 0, 16, 16)
  mapa(g, NPC, PAL, 0, 0)
}

/** O aviso dos proibidos: o aldeão e o gato, em 28 × 14. */
export function desenharProibidos(g: CanvasRenderingContext2D): void {
  g.clearRect(0, 0, 28, 14)
  g.drawImage(camadas().proib, 0, 0)
}

const CORES_DA_MEDALHA: Readonly<Record<MedalhaTiro, readonly [string, string, string]>> = {
  bronze: ['#cf8d55', '#8f5a2e', '#f0b98a'],
  prata: ['#c9cdd6', '#7f8592', '#f4f6fa'],
  ouro: ['#f2c14e', '#a87b22', '#fff0b8'],
}
const ESTRELA: readonly string[] = ['..1..', '..1..', '11111', '.111.', '.1.1.']

/** A medalha do resultado em 32 × 40; sem medalha, um disco apagado. */
export function desenharMedalha(g: CanvasRenderingContext2D, med: MedalhaTiro | null): void {
  g.clearRect(0, 0, 32, 40)
  if (med === null) {
    disco(g, '#3a3940', 16, 24, 12)
    disco(g, '#1a1a1e', 16, 24, 10)
    ret(g, '#5a5862', 11, 23, 10, 2)
    return
  }
  const cor = CORES_DA_MEDALHA[med]
  for (const [x, c] of [[8, '#8e3b32'], [12, '#d9c7a1'], [16, '#8e3b32'], [20, '#d9c7a1']] as const) ret(g, c, x, 0, 4, 14)
  ret(g, CONTORNO, 7, 0, 1, 14)
  ret(g, CONTORNO, 24, 0, 1, 14)
  disco(g, CONTORNO, 16, 25, 13)
  disco(g, cor[1], 16, 25, 12)
  disco(g, cor[0], 16, 25, 10)
  disco(g, cor[1], 16, 25, 7.5)
  disco(g, cor[0], 16, 25, 6.5)
  ESTRELA.forEach((l, j) => {
    for (let i = 0; i < 5; i++) if (l.charAt(i) === '1') ret(g, cor[2], 14 + i, 23 + j - 1, 1, 1)
  })
  ret(g, cor[2], 9, 18, 2, 1)
  ret(g, cor[2], 8, 19, 1, 2)
}
