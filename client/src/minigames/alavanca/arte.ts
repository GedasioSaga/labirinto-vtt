/**
 * A ARTE DA ALAVANCA DA PONTE: o bloco CENA do protótipo aprovado
 * (`docs/design/minigames/alavanca-da-ponte.html`), traço por traço. Estilo
 * Meio-Termo: contorno no tom escuro da própria cor (60% da luz), cores
 * contidas, grão leve na pedra e na madeira, tudo por código e determinístico.
 */
import { criarRng, DENTES, VOLTAS } from './sim'

type G = CanvasRenderingContext2D

export const COR = {
  grama: '#8cbf80',
  gramaR: '#a2cc92',
  gramaS: '#76ac6d',
  terra: '#dda56c',
  barranco: '#aa745c',
  pedra: '#c3c0b2',
  praca: '#dcd0b6',
  carvalho: '#a07b51',
  nogueira: '#775739',
  pinho: '#b9995f',
  ferro: '#5d6164',
  latao: '#b89552',
  telhaAzul: '#43639a',
  palha: '#d6b56a',
  rosa: '#e8a2c4',
  amarelo: '#f0d266',
  branco: '#f3efe2',
  laranja: '#e6793f',
  agua: '#86aebb',
  interior: '#3a302a',
} as const // só congela a paleta (somente leitura); não converte tipo nenhum

/** A cor de cada jogador (a marca na lista e o anel do aperto na manivela), na ordem da rodada. */
export const CORES_J: readonly string[] = ['#e0a44a', '#79a9cc', '#8cbf80', '#e8a2c4']
/** A cor da poeira que levanta quando a ponte assenta. */
export const COR_DA_PRACA = COR.praca

const rgbDe = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const tomDe = (h: string, f: number, a = 1): string => {
  const [r, g, b] = rgbDe(h)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return a < 1 ? `rgba(${c(r)},${c(g)},${c(b)},${a})` : `rgb(${c(r)},${c(g)},${c(b)})`
}
export const mistura = (a: string, b: string, k: number): string => {
  const x = rgbDe(a)
  const y = rgbDe(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`
}
export const contorno = (h: string): string => tomDe(h, 0.6)

export const MUNDO = { w: 620, h: 340, cx: 310, cy: 190 }
const PONTE = { cx: 330, hy: 244, L: 136, meia: 66 }
/** O quadro do sarilho (o mecanismo dentro da torre), em coordenadas do mundo. */
export const SARILHO = { x: 12, y: 178, w: 196, h: 168, cx: 98, cy: 96, R: 44 }
const FUROS: readonly (readonly [number, number])[] = [
  [262, 104],
  [398, 104],
]

/** Um grão de poeira (o pouso da ponte, a catraca soltando). */
export interface Poeira {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  vida: number
  max: number
  cor: string
}

/** O estado visual de um quadro: tudo o que a cena precisa, já pronto. */
export interface EstadoVisual {
  /** A ponte, de 0 (erguida) a 1 (assentada); no canhão, a plataforma, de 0 (no fundo do poço) a 1 (rente às lajes). */
  p: number
  /** Só no canhão: o cano, de 1 (erguido, saindo do poço) a 0 (baixado até a ameia, depois da trava). */
  cano: number
  /** Só no canhão: os ferrolhos, de 0 (abertos) a 1 (dentro da plataforma, na vitória). */
  trava: number
  solta: number
  tensao: number
  /** Tremor das correntes. */
  vib: number
  /** O brilho do aperto de cada jogador (1 no aperto, some em 160 ms). */
  flash: readonly number[]
  poeira: readonly Poeira[]
  /** O tranco da tela (quadrado do trauma). */
  tremor: number
  /** O relógio da cena (água e tocha); parado com movimento reduzido. */
  t: number
  tReal: number
}

export function caminhoArredondado(g: G, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export function grao(g: G, x: number, y: number, w: number, h: number, cor: string, n: number, semente: string): void {
  const rng = criarRng(semente)
  g.fillStyle = cor
  for (let i = 0; i < n; i++) g.fillRect(x + rng() * w, y + rng() * h, 0.9 + rng() * 1.2, 0.7)
}

export function blocos(g: G, x: number, y: number, w: number, h: number, alt: number, larg: number, cor: string, semente: string): void {
  const rng = criarRng(semente)
  g.strokeStyle = cor
  g.lineWidth = 0.8
  g.beginPath()
  for (let yy = y + alt; yy < y + h; yy += alt) {
    g.moveTo(x, yy)
    g.lineTo(x + w, yy)
  }
  for (let yy = y, lin = 0; yy < y + h; yy += alt, lin++) {
    for (let xx = x + (lin % 2 ? larg / 2 : 0) + rng() * 4; xx < x + w; xx += larg * (0.8 + rng() * 0.4)) {
      g.moveTo(xx, yy)
      g.lineTo(xx, Math.min(y + h, yy + alt))
    }
  }
  g.stroke()
}

function ameias(g: G, x0: number, x1: number, y: number, alt: number, larg: number, vao: number, cor: string): void {
  g.fillStyle = cor
  g.strokeStyle = contorno(COR.pedra)
  g.lineWidth = 1
  for (let x = x0; x + larg <= x1 + 0.1; x += larg + vao) {
    g.fillRect(x, y - alt, larg, alt)
    g.strokeRect(x + 0.5, y - alt + 0.5, larg - 1, alt)
  }
}

export function torre(g: G, x: number, y: number, w: number, base: number): void {
  const corpo = g.createLinearGradient(x, 0, x + w, 0)
  corpo.addColorStop(0, tomDe(COR.pedra, 0.82))
  corpo.addColorStop(0.65, COR.pedra)
  corpo.addColorStop(1, tomDe(COR.pedra, 1.06))
  g.fillStyle = corpo
  g.fillRect(x, y, w, base - y)
  blocos(g, x, y, w, base - y, 11, 18, tomDe(COR.pedra, 0.86, 0.7), `torre${x}`)
  grao(g, x, y, w, base - y, tomDe(COR.pedra, 0.78, 0.5), 60, `gt${x}`)
  g.strokeStyle = contorno(COR.pedra)
  g.lineWidth = 1.2
  g.strokeRect(x, y, w, base - y)
  // telhado cônico
  const meio = x + w / 2
  g.beginPath()
  g.moveTo(x - 7, y + 2)
  g.lineTo(meio, y - 52)
  g.lineTo(x + w + 7, y + 2)
  g.closePath()
  const tel = g.createLinearGradient(x, 0, x + w, 0)
  tel.addColorStop(0, tomDe(COR.telhaAzul, 0.82))
  tel.addColorStop(0.6, COR.telhaAzul)
  tel.addColorStop(1, tomDe(COR.telhaAzul, 1.12))
  g.fillStyle = tel
  g.fill()
  g.strokeStyle = contorno(COR.telhaAzul)
  g.lineWidth = 1.2
  g.stroke()
  g.strokeStyle = tomDe(COR.telhaAzul, 0.75, 0.6)
  g.lineWidth = 0.8
  for (let i = 1; i < 5; i++) {
    const k = i / 5
    g.beginPath()
    g.moveTo(meio - (w / 2 + 7) * k, y - 52 + 54 * k)
    g.lineTo(meio + (w / 2 + 7) * k, y - 52 + 54 * k)
    g.stroke()
  }
  // seteira
  g.fillStyle = '#2b2420'
  caminhoArredondado(g, meio - 2.5, y + 30, 5, 18, 2.5)
  g.fill()
}

export function nuvem(g: G, x: number, y: number, k: number): void {
  g.fillStyle = 'rgba(248, 240, 226, 0.78)'
  g.beginPath()
  g.ellipse(x, y, 34 * k, 9 * k, 0, 0, Math.PI * 2)
  g.ellipse(x - 16 * k, y - 5 * k, 15 * k, 9 * k, 0, 0, Math.PI * 2)
  g.ellipse(x + 12 * k, y - 7 * k, 18 * k, 11 * k, 0, 0, Math.PI * 2)
  g.fill()
}

/** O vão do portão (a passagem escura), o mesmo recorte da tocha de dentro. */
function caminhoDoVao(g: G): void {
  g.beginPath()
  g.moveTo(270, 244)
  g.lineTo(270, 182)
  g.arc(330, 182, 60, Math.PI, 0)
  g.lineTo(390, 244)
  g.closePath()
}

/** Tudo o que não se mexe, em coordenadas do mundo (620 x 340, estende para os lados). */
function desenharFixo(g: G): void {
  const ceu = g.createLinearGradient(0, -140, 0, 244)
  ceu.addColorStop(0, '#a3bfcc')
  ceu.addColorStop(0.58, '#dcd8c8')
  ceu.addColorStop(1, '#efd5ac')
  g.fillStyle = ceu
  g.fillRect(-700, -500, 2000, 760)
  const sol = g.createRadialGradient(560, 64, 4, 560, 64, 110)
  sol.addColorStop(0, 'rgba(255, 242, 210, 0.95)')
  sol.addColorStop(0.16, 'rgba(255, 234, 196, 0.5)')
  sol.addColorStop(1, 'rgba(255, 234, 196, 0)')
  g.fillStyle = sol
  g.fillRect(420, -60, 300, 260)
  nuvem(g, 70, 40, 1)
  nuvem(g, 440, 22, 0.75)
  nuvem(g, 640, 52, 1.1)
  nuvem(g, -120, 30, 0.9)
  // morros distantes
  g.fillStyle = mistura(COR.gramaS, '#dcd8c8', 0.5)
  g.beginPath()
  g.moveTo(-700, 244)
  for (let x = -700; x <= 1300; x += 40) g.lineTo(x, 150 + 18 * Math.sin(x * 0.013) + 10 * Math.sin(x * 0.031 + 1))
  g.lineTo(1300, 244)
  g.closePath()
  g.fill()
  // muralha
  const mur = g.createLinearGradient(0, 92, 0, 244)
  mur.addColorStop(0, tomDe(COR.pedra, 1.05))
  mur.addColorStop(1, tomDe(COR.pedra, 0.9))
  g.fillStyle = mur
  g.fillRect(-700, 104, 2000, 140)
  blocos(g, -700, 104, 2000, 140, 12, 26, tomDe(COR.pedra, 0.84, 0.75), 'muralha')
  grao(g, -700, 104, 2000, 140, tomDe(COR.pedra, 0.76, 0.45), 900, 'gmur')
  ameias(g, -700, 1300, 104, 12, 14, 10, tomDe(COR.pedra, 1.02))
  g.strokeStyle = contorno(COR.pedra)
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(-700, 104.5)
  g.lineTo(1300, 104.5)
  g.stroke()
  torre(g, 120, 72, 64, 244)
  torre(g, 470, 72, 64, 244)
  // casa do portão
  const cp = g.createLinearGradient(238, 0, 422, 0)
  cp.addColorStop(0, tomDe(COR.pedra, 0.94))
  cp.addColorStop(1, tomDe(COR.pedra, 1.06))
  g.fillStyle = cp
  g.fillRect(238, 50, 184, 194)
  blocos(g, 238, 50, 184, 194, 12, 24, tomDe(COR.pedra, 0.84, 0.75), 'portao')
  grao(g, 238, 50, 184, 194, tomDe(COR.pedra, 0.76, 0.45), 260, 'gport')
  ameias(g, 238, 422, 50, 12, 15, 9.5, tomDe(COR.pedra, 1.06))
  g.strokeStyle = contorno(COR.pedra)
  g.lineWidth = 1.2
  g.strokeRect(238, 50, 184, 194)
  // o vão do portão: passagem escura com luz no fim
  g.save()
  caminhoDoVao(g)
  const vao = g.createLinearGradient(0, 122, 0, 244)
  vao.addColorStop(0, '#231c18')
  vao.addColorStop(1, COR.interior)
  g.fillStyle = vao
  g.fill()
  g.clip()
  g.fillStyle = 'rgba(238, 206, 150, 0.6)'
  caminhoArredondado(g, 314, 190, 32, 40, 3)
  g.fill()
  g.fillStyle = mistura(COR.gramaR, '#efd5ac', 0.4)
  g.fillRect(314, 222, 32, 8)
  g.fillStyle = '#4e4036'
  g.beginPath()
  g.moveTo(270, 244)
  g.lineTo(312, 230)
  g.lineTo(348, 230)
  g.lineTo(390, 244)
  g.closePath()
  g.fill()
  g.strokeStyle = tomDe(COR.ferro, 0.7)
  g.lineWidth = 2
  for (let x = 278; x < 390; x += 11) {
    g.beginPath()
    g.moveTo(x, 122)
    g.lineTo(x, 146)
    g.stroke()
  }
  for (let y = 128; y < 148; y += 9) {
    g.beginPath()
    g.moveTo(270, y)
    g.lineTo(390, y)
    g.stroke()
  }
  g.restore()
  g.strokeStyle = tomDe(COR.pedra, 0.8)
  g.lineWidth = 8
  g.beginPath()
  g.moveTo(266, 244)
  g.lineTo(266, 182)
  g.arc(330, 182, 64, Math.PI, 0)
  g.lineTo(394, 244)
  g.stroke()
  g.strokeStyle = contorno(COR.pedra)
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(262, 244)
  g.lineTo(262, 182)
  g.arc(330, 182, 68, Math.PI, 0)
  g.lineTo(398, 244)
  g.stroke()
  caminhoDoVao(g)
  g.stroke()
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI
    g.beginPath()
    g.moveTo(330 + 60 * Math.cos(a), 182 + 60 * Math.sin(a))
    g.lineTo(330 + 68 * Math.cos(a), 182 + 68 * Math.sin(a))
    g.stroke()
  }
  // furos das correntes
  for (const [x, y] of FUROS) {
    g.fillStyle = tomDe(COR.pedra, 0.7)
    g.beginPath()
    g.arc(x, y, 6.5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1e1916'
    g.beginPath()
    g.arc(x, y, 4, 0, Math.PI * 2)
    g.fill()
  }
  // base de pedra e água do fosso
  g.fillStyle = tomDe(COR.pedra, 0.78)
  g.fillRect(-700, 236, 2000, 8)
  const ag = g.createLinearGradient(0, 244, 0, 300)
  ag.addColorStop(0, tomDe(COR.agua, 0.78))
  ag.addColorStop(0.3, COR.agua)
  ag.addColorStop(1, tomDe(COR.agua, 1.08))
  g.fillStyle = ag
  g.fillRect(-700, 244, 2000, 58)
  g.fillStyle = 'rgba(40, 52, 60, 0.18)'
  g.fillRect(-700, 244, 2000, 10)
  // margem de cá: grama, trilha de terra com lajes, tufos e flores
  g.fillStyle = COR.barranco
  g.fillRect(-700, 297, 2000, 7)
  const gr = g.createLinearGradient(0, 300, 0, 420)
  gr.addColorStop(0, COR.gramaR)
  gr.addColorStop(0.35, COR.grama)
  gr.addColorStop(1, COR.gramaS)
  g.fillStyle = gr
  g.beginPath()
  g.moveTo(-700, 302)
  for (let x = -700; x <= 1300; x += 16) g.lineTo(x, 301 + 1.6 * Math.sin(x * 0.21))
  g.lineTo(1300, 800)
  g.lineTo(-700, 800)
  g.closePath()
  g.fill()
  g.strokeStyle = contorno(COR.grama)
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(-700, 302)
  for (let x = -700; x <= 1300; x += 16) g.lineTo(x, 301 + 1.6 * Math.sin(x * 0.21))
  g.stroke()
  g.fillStyle = COR.terra
  g.beginPath()
  g.moveTo(256, 310)
  g.lineTo(404, 310)
  g.lineTo(470, 560)
  g.lineTo(190, 560)
  g.closePath()
  g.fill()
  g.strokeStyle = contorno(COR.terra)
  g.lineWidth = 1
  g.stroke()
  grao(g, 200, 312, 260, 250, tomDe(COR.terra, 0.82, 0.55), 220, 'gterra')
  const rng = criarRng('margem')
  for (let i = 0; i < 9; i++) {
    const y = 330 + i * 20
    const x = 300 + (rng() - 0.5) * 40 + (y - 330) * 0.08
    g.fillStyle = COR.praca
    caminhoArredondado(g, x, y, 34 + rng() * 14, 11, 4)
    g.fill()
    g.strokeStyle = contorno(COR.praca)
    g.lineWidth = 0.9
    g.stroke()
  }
  const flores = [COR.amarelo, COR.branco, COR.rosa]
  for (let i = 0; i < 170; i++) {
    const x = -300 + rng() * 1220
    const y = 308 + rng() * 200
    if (x > 185 && x < 475 && y > 306) continue
    if (rng() < 0.16) {
      g.fillStyle = flores[Math.floor(rng() * 3)]
      g.beginPath()
      g.arc(x, y, 1.6, 0, Math.PI * 2)
      g.fill()
    } else {
      g.strokeStyle = tomDe(COR.gramaS, 0.8)
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(x - 2.5, y - 3)
      g.lineTo(x, y + 1)
      g.lineTo(x + 2.5, y - 3)
      g.stroke()
    }
  }
  quadroFixo(g, 'Sarilho, dentro da torre')
}

/** O quadro do sarilho: o mecanismo de perto, no canto, igual nas duas cenas. */
export function quadroFixo(g: G, rotulo: string): void {
  const S = SARILHO
  g.save()
  g.translate(S.x, S.y)
  caminhoArredondado(g, 0, 0, S.w, S.h, 10)
  g.save()
  g.clip()
  const fundo = g.createRadialGradient(30, 40, 4, 60, 70, 210)
  fundo.addColorStop(0, '#5a4a3c')
  fundo.addColorStop(1, '#2c2521')
  g.fillStyle = fundo
  g.fillRect(0, 0, S.w, S.h)
  blocos(g, 0, 0, S.w, S.h, 14, 30, 'rgba(0, 0, 0, 0.22)', 'sarilho')
  g.fillStyle = tomDe(COR.nogueira, 0.85)
  g.fillRect(0, S.h - 16, S.w, 16)
  g.strokeStyle = contorno(COR.nogueira)
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(0, S.h - 16)
  g.lineTo(S.w, S.h - 16)
  g.stroke()
  // cavalete de madeira
  const pernas: readonly (readonly [number, number])[] = [
    [60, 88],
    [136, 108],
  ]
  for (const [x0, x1] of pernas) {
    g.fillStyle = COR.carvalho
    g.beginPath()
    g.moveTo(x0 - 6, S.h - 16)
    g.lineTo(x1 - 4, S.cy)
    g.lineTo(x1 + 4, S.cy)
    g.lineTo(x0 + 6, S.h - 16)
    g.closePath()
    g.fill()
    g.strokeStyle = contorno(COR.carvalho)
    g.lineWidth = 1
    g.stroke()
  }
  // suporte da tocha
  g.fillStyle = COR.ferro
  g.fillRect(20, 46, 6, 14)
  g.strokeStyle = contorno(COR.ferro)
  g.strokeRect(20, 46, 6, 14)
  g.restore()
  g.lineWidth = 4
  g.strokeStyle = tomDe(COR.pedra, 0.62)
  caminhoArredondado(g, 0, 0, S.w, S.h, 10)
  g.stroke()
  g.lineWidth = 1
  g.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  caminhoArredondado(g, 3, 3, S.w - 6, S.h - 6, 8)
  g.stroke()
  g.font = '600 9px Bahnschrift, Barlow, "Segoe UI", sans-serif'
  g.textBaseline = 'middle'
  const largura = Math.ceil(g.measureText(rotulo).width) + 14
  g.fillStyle = 'rgba(18, 14, 12, 0.72)'
  caminhoArredondado(g, S.w - 8 - largura, S.h - 22, largura, 16, 8)
  g.fill()
  g.fillStyle = '#eceae4'
  g.fillText(rotulo, S.w - 1 - largura, S.h - 13.5)
  g.restore()
}

const cacheFixo = new Map<string, HTMLCanvasElement>()
const CACHE_FIXO_MAX = 6

/** O que não se mexe, pintado uma vez por cena e tamanho do palco. */
function camadaFixa(W: number, H: number, s: number, ox: number, oy: number, cena: string, desenhar: (g: G) => void): HTMLCanvasElement | null {
  const chave = `${cena}|${W}x${H}`
  const pronta = cacheFixo.get(chave)
  if (pronta !== undefined) return pronta
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (g === null) return null
  g.setTransform(s, 0, 0, s, ox, oy)
  desenhar(g)
  if (cacheFixo.size > CACHE_FIXO_MAX) cacheFixo.clear()
  cacheFixo.set(chave, c)
  return c
}

/**
 * O começo de um quadro, igual nas duas cenas: o fundo, a camada fixa da
 * cena com o tranco da tela, e a transformação do mundo (620 x 340) já posta.
 */
export function comecarQuadro(ctx: G, W: number, H: number, est: EstadoVisual, cena: string, desenharFixoDaCena: (g: G) => void): void {
  const s = Math.min(W / MUNDO.w, H / MUNDO.h)
  const ox = W / 2 - MUNDO.cx * s
  const oy = H / 2 - MUNDO.cy * s
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const tr = est.tremor
  const dx = tr ? 6 * tr * Math.sin(est.tReal * 51) * s : 0
  const dy = tr ? 4 * tr * Math.sin(est.tReal * 69 + 1) * s : 0
  ctx.fillStyle = '#9ec0a0'
  ctx.fillRect(0, 0, W, H)
  const fixa = camadaFixa(W, H, s, ox, oy, cena, desenharFixoDaCena)
  if (fixa !== null) ctx.drawImage(fixa, dx, dy)
  ctx.setTransform(s, 0, 0, s, ox + dx, oy + dy)
}

/** Um ponto da ponte: `u` ao longo (0 na dobradiça, 1 na ponta), `lado` de -1 a 1 na largura. */
export function pontoDaPonte(p: number, u: number, lado: number): [number, number] {
  const a = (Math.PI / 2) * p
  const h = PONTE.L * u * Math.cos(a)
  const d = PONTE.L * u * Math.sin(a)
  return [PONTE.cx + lado * PONTE.meia * (1 + d * 0.0016), PONTE.hy - h + d * 0.55]
}

function desenharPonte(g: G, p: number): void {
  const a = (Math.PI / 2) * p
  const luz = 0.9 + 0.14 * Math.sin(a)
  const [ax, ay] = pontoDaPonte(p, 0, -1)
  const [bx, by] = pontoDaPonte(p, 0, 1)
  const [cx, cy] = pontoDaPonte(p, 1, 1)
  const [dx, dy] = pontoDaPonte(p, 1, -1)
  // sombra na água
  if (p > 0.05) {
    g.save()
    g.beginPath()
    g.rect(-700, 244, 2000, 56)
    g.clip()
    g.fillStyle = `rgba(30, 44, 52, ${0.22 * Math.sin(a)})`
    g.beginPath()
    g.moveTo(ax + 6, 246)
    g.lineTo(bx + 6, 246)
    g.lineTo(cx + 10, Math.min(300, cy + 4))
    g.lineTo(dx + 10, Math.min(300, dy + 4))
    g.closePath()
    g.fill()
    g.restore()
  }
  // espessura da ponta (aparece quando ela vem para a frente)
  const esp = 7 * Math.sin(a)
  if (esp > 0.5) {
    g.fillStyle = tomDe(COR.nogueira, 0.9)
    g.beginPath()
    g.moveTo(dx, dy)
    g.lineTo(cx, cy)
    g.lineTo(cx, cy + esp)
    g.lineTo(dx, dy + esp)
    g.closePath()
    g.fill()
    g.strokeStyle = contorno(COR.nogueira)
    g.lineWidth = 1
    g.stroke()
  }
  g.fillStyle = tomDe(COR.carvalho, luz)
  g.beginPath()
  g.moveTo(ax, ay)
  g.lineTo(bx, by)
  g.lineTo(cx, cy)
  g.lineTo(dx, dy)
  g.closePath()
  g.fill()
  // tábuas
  g.strokeStyle = tomDe(COR.nogueira, luz * 0.95, 0.75)
  g.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    const l = -1 + (2 * i) / 8
    const [x0, y0] = pontoDaPonte(p, 0, l)
    const [x1, y1] = pontoDaPonte(p, 1, l)
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  // veio da madeira
  g.strokeStyle = tomDe(COR.carvalho, luz * 1.12, 0.5)
  g.lineWidth = 0.7
  for (let i = 0; i < 8; i++) {
    const l = -1 + (2 * i + 1) / 8 + 0.04
    const [x0, y0] = pontoDaPonte(p, 0.32 + (i % 3) * 0.08, l)
    const [x1, y1] = pontoDaPonte(p, 0.5 + (i % 3) * 0.08, l)
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  // cintas de ferro com rebites de latão
  for (const u of [0.14, 0.86]) {
    const [x0, y0] = pontoDaPonte(p, u, -1)
    const [x1, y1] = pontoDaPonte(p, u, 1)
    g.strokeStyle = COR.ferro
    g.lineWidth = 4.5
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
    g.fillStyle = COR.latao
    for (const l of [-0.75, -0.25, 0.25, 0.75]) {
      const [x, y] = pontoDaPonte(p, u, l)
      g.beginPath()
      g.arc(x, y, 1.5, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.strokeStyle = contorno(COR.carvalho)
  g.lineWidth = 1.3
  g.beginPath()
  g.moveTo(ax, ay)
  g.lineTo(bx, by)
  g.lineTo(cx, cy)
  g.lineTo(dx, dy)
  g.closePath()
  g.stroke()
}

export function desenharCorrente(g: G, x0: number, y0: number, x1: number, y1: number, fase: number, vib: number, t: number, semente: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0)
  if (len < 1) return
  const ux = (x1 - x0) / len
  const uy = (y1 - y0) / len
  const passo = 6.4
  const ang = Math.atan2(uy, ux)
  g.lineWidth = 0.8
  for (let s = fase % passo; s < len; s += passo) {
    const k = Math.round((s - (fase % passo)) / passo) + Math.floor(fase / passo)
    const off = vib * Math.sin((Math.PI * s) / len) * Math.sin(t * 47 + semente)
    const x = x0 + ux * s - uy * off
    const y = y0 + uy * s + ux * off
    g.fillStyle = k % 2 ? tomDe(COR.ferro, 1.18) : COR.ferro
    g.strokeStyle = contorno(COR.ferro)
    g.beginPath()
    if (k % 2) g.ellipse(x, y, 3.6, 2, ang, 0, Math.PI * 2)
    else g.ellipse(x, y, 3.4, 0.9, ang, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
}

export function chama(g: G, x: number, y: number, t: number, k = 1): void {
  const f = 1 + 0.12 * Math.sin(t * 13.1) + 0.08 * Math.sin(t * 29.7 + 1.3)
  const luz = g.createRadialGradient(x, y, 1, x, y, 30 * k * f)
  luz.addColorStop(0, 'rgba(255, 196, 120, 0.42)')
  luz.addColorStop(1, 'rgba(255, 196, 120, 0)')
  g.fillStyle = luz
  g.beginPath()
  g.arc(x, y, 30 * k * f, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = COR.laranja
  g.beginPath()
  g.ellipse(x, y - 3 * k, 3.4 * k, 6 * k * f, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = COR.amarelo
  g.beginPath()
  g.ellipse(x, y - 2 * k, 1.8 * k, 3.6 * k * f, 0, 0, Math.PI * 2)
  g.fill()
}

export function desenharSarilho(g: G, est: EstadoVisual): void {
  const S = SARILHO
  const phi = est.p * VOLTAS * Math.PI * 2
  g.save()
  g.translate(S.x, S.y)
  caminhoArredondado(g, 2, 2, S.w - 4, S.h - 4, 8)
  g.clip()
  chama(g, 23, 40, est.t, 0.9)
  // corrente subindo do tambor para a ponte
  const fase = phi * 20
  desenharCorrente(g, S.cx - 20, S.cy, S.cx - 20, -6, fase, est.vib * 0.6, est.t, 3)
  // roda da catraca
  const R = S.R
  const dente = (Math.PI * 2) / DENTES
  g.beginPath()
  for (let i = 0; i < DENTES; i++) {
    const a = phi + i * dente
    g.lineTo(S.cx + R * Math.cos(a), S.cy + R * Math.sin(a))
    g.lineTo(S.cx + (R + 8) * Math.cos(a + dente * 0.82), S.cy + (R + 8) * Math.sin(a + dente * 0.82))
    g.lineTo(S.cx + R * Math.cos(a + dente * 0.86), S.cy + R * Math.sin(a + dente * 0.86))
  }
  g.closePath()
  g.fillStyle = COR.ferro
  g.fill()
  g.strokeStyle = contorno(COR.ferro)
  g.lineWidth = 1.2
  g.stroke()
  g.fillStyle = tomDe(COR.ferro, 1.2)
  g.beginPath()
  g.arc(S.cx, S.cy, R - 6, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = tomDe(COR.ferro, 0.8)
  g.lineWidth = 1
  for (let i = 0; i < 6; i++) {
    const a = phi + (i * Math.PI) / 3
    g.beginPath()
    g.moveTo(S.cx + 22 * Math.cos(a), S.cy + 22 * Math.sin(a))
    g.lineTo(S.cx + (R - 8) * Math.cos(a), S.cy + (R - 8) * Math.sin(a))
    g.stroke()
  }
  // tambor com a corrente enrolada
  g.fillStyle = COR.latao
  g.beginPath()
  g.arc(S.cx, S.cy, 20, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = contorno(COR.latao)
  g.stroke()
  g.strokeStyle = tomDe(COR.ferro, 0.9)
  g.lineWidth = 2.2
  for (let i = 0; i < 8; i++) {
    const a = phi + (i * Math.PI) / 4
    g.beginPath()
    g.arc(S.cx, S.cy, 16, a, a + 0.42)
    g.stroke()
  }
  // lingueta: sobe dente a dente e, solta, se afasta da roda
  const frac = (((phi / dente) % 1) + 1) % 1
  const giro = est.solta > 0 ? 0.55 * est.solta : 0.13 * frac
  const piv = [S.cx + 64, S.cy - 56]
  const base = [-28, 25.8]
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const ponta = [piv[0] + base[0] * c - base[1] * s, piv[1] + base[0] * s + base[1] * c]
  const corL = est.solta > 0 ? '#c96b5f' : COR.ferro
  g.strokeStyle = contorno(corL)
  g.lineWidth = 7
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(piv[0], piv[1])
  g.lineTo(ponta[0], ponta[1])
  g.stroke()
  g.strokeStyle = corL
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(piv[0], piv[1])
  g.lineTo(ponta[0], ponta[1])
  g.stroke()
  g.fillStyle = COR.latao
  g.beginPath()
  g.arc(piv[0], piv[1], 3.4, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = contorno(COR.latao)
  g.lineWidth = 1
  g.stroke()
  // manivela
  const am = phi - Math.PI / 2
  const mx = S.cx + 52 * Math.cos(am)
  const my = S.cy + 52 * Math.sin(am)
  g.strokeStyle = contorno(COR.ferro)
  g.lineWidth = 7
  g.beginPath()
  g.moveTo(S.cx, S.cy)
  g.lineTo(mx, my)
  g.stroke()
  g.strokeStyle = tomDe(COR.ferro, 1.15)
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(S.cx, S.cy)
  g.lineTo(mx, my)
  g.stroke()
  g.lineCap = 'butt'
  for (let j = 0; j < est.flash.length; j++) {
    const f = est.flash[j]
    if (f <= 0) continue
    g.strokeStyle = tomDe(CORES_J[j], 1, 0.85 * f)
    g.lineWidth = 2.5
    g.beginPath()
    g.arc(mx, my, 9 + 7 * (1 - f) + j * 2.5, 0, Math.PI * 2)
    g.stroke()
  }
  g.fillStyle = COR.carvalho
  g.beginPath()
  g.arc(mx, my, 7.5, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = contorno(COR.carvalho)
  g.lineWidth = 1.2
  g.stroke()
  g.fillStyle = tomDe(COR.carvalho, 1.25)
  g.beginPath()
  g.arc(mx - 2, my - 2, 2.4, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = COR.latao
  g.beginPath()
  g.arc(S.cx, S.cy, 4.5, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = contorno(COR.latao)
  g.stroke()
  g.restore()
}

export function desenharPoeira(g: G, poeira: readonly Poeira[]): void {
  for (const q of poeira) {
    const a = Math.max(0, q.vida / q.max)
    g.fillStyle = tomDe(q.cor, 1, 0.55 * a)
    g.beginPath()
    g.arc(q.x, q.y, q.r * (1.6 - 0.6 * a), 0, Math.PI * 2)
    g.fill()
  }
}

function desenharAgua(g: G, t: number): void {
  g.strokeStyle = 'rgba(236, 246, 246, 0.38)'
  g.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const x = ((((i * 97 + t * 7 * (i % 2 ? 1 : -0.6)) % 900) + 900) % 900) - 140
    const y = 254 + ((i * 13) % 42)
    const w = 10 + (i % 4) * 5
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + w, y)
    g.stroke()
  }
}

/** A cena da ponte inteira num canvas de W x H pixels (a do canhão é `arteDoCanhao.ts`). */
export function desenharCena(ctx: G, W: number, H: number, est: EstadoVisual): void {
  comecarQuadro(ctx, W, H, est, 'ponte', desenharFixo)
  desenharAgua(ctx, est.t)
  // tocha dentro do portão (fica atrás da ponte erguida)
  ctx.save()
  caminhoDoVao(ctx)
  ctx.clip()
  chama(ctx, 380, 196, est.t, 0.8)
  ctx.restore()
  desenharPonte(ctx, est.p)
  const fase = est.p * 160
  for (let i = 0; i < 2; i++) {
    const [fx, fy] = FUROS[i]
    const [px, py] = pontoDaPonte(est.p, 0.93, i ? 0.86 : -0.86)
    desenharCorrente(ctx, fx, fy, px, py, fase, est.vib, est.t, i * 2.1)
    ctx.fillStyle = COR.ferro
    ctx.beginPath()
    ctx.arc(px, py, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  desenharPoeira(ctx, est.poeira)
  desenharSarilho(ctx, est)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

/** O ícone do convite (a catraca com a manivela), num canvas de 96 x 96. */
export function desenharIcone(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')
  if (g === null) return
  g.setTransform(2, 0, 0, 2, 0, 0)
  g.fillStyle = '#2a221d'
  g.fillRect(0, 0, 48, 48)
  const R = 15
  const cx = 24
  const cy = 25
  const dente = (Math.PI * 2) / 10
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = i * dente
    g.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a))
    g.lineTo(cx + (R + 4) * Math.cos(a + dente * 0.8), cy + (R + 4) * Math.sin(a + dente * 0.8))
    g.lineTo(cx + R * Math.cos(a + dente * 0.86), cy + R * Math.sin(a + dente * 0.86))
  }
  g.closePath()
  g.fillStyle = COR.ferro
  g.fill()
  g.strokeStyle = contorno(COR.ferro)
  g.lineWidth = 1
  g.stroke()
  g.fillStyle = COR.latao
  g.beginPath()
  g.arc(cx, cy, 6, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = tomDe(COR.ferro, 1.2)
  g.lineWidth = 3
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(cx, cy)
  g.lineTo(cx + 13, cy - 12)
  g.stroke()
  g.fillStyle = COR.carvalho
  g.beginPath()
  g.arc(cx + 13, cy - 12, 3.6, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = contorno(COR.carvalho)
  g.lineWidth = 1
  g.stroke()
}
