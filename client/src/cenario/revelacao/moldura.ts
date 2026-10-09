/**
 * MOLDURA desenhada por código (sem arquivo de imagem): madeira por fora, em
 * quatro tábuas com esquadria a 45°, e aro de metal escovado por dentro, com
 * parafusos nos cantos e rebites nos lados. Luz do alto à esquerda. A mesma
 * moldura veste a imagem e o postigo. Porte de `moldura.js` do protótipo v3.
 *
 * Desenha uma vez por tamanho (fora da tela) e compõe no canvas visível: nada
 * disso roda por quadro.
 */

import { mulberry32 } from './tempo'

type Ponto = readonly [number, number]
/** Matriz 2D (a, b, c, d, e, f) que leva a tábua para o espaço "ao longo dela". */
type Matriz = readonly [number, number, number, number, number, number]

interface Tabua {
  pts: readonly Ponto[]
  local: Matriz
  comprimento: number
  /** 1 = de frente para a luz; menor = mais na sombra. */
  luz: number
}

/** Teto da densidade de pixels: tela 3x pintaria 9x os pixels de uma 1x sem ganho visível. */
const DPR_MAX = 2

function novaTela(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** As quatro tábuas de um anel que começa `fora` px da borda e tem `largura` px. */
function tabuas(w: number, h: number, fora: number, largura: number): Tabua[] {
  const a = fora
  const b = fora + largura
  return [
    { pts: [[a, a], [w - a, a], [w - b, b], [b, b]], local: [1, 0, 0, 1, 0, a], comprimento: w, luz: 1 },
    { pts: [[w - a, a], [w - a, h - a], [w - b, h - b], [w - b, b]], local: [0, 1, -1, 0, w - a, 0], comprimento: h, luz: 0.5 },
    { pts: [[w - a, h - a], [a, h - a], [b, h - b], [w - b, h - b]], local: [1, 0, 0, -1, 0, h - a], comprimento: w, luz: 0.38 },
    { pts: [[a, h - a], [a, a], [b, b], [b, h - b]], local: [0, 1, 1, 0, a, 0], comprimento: h, luz: 0.8 },
  ]
}

function caminho(c: CanvasRenderingContext2D, pts: readonly Ponto[]): void {
  c.beginPath()
  c.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1])
  c.closePath()
}

function entrarNaTabua(c: CanvasRenderingContext2D, tabua: Tabua, dpr: number): void {
  c.save()
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  caminho(c, tabua.pts)
  c.clip()
  const [m11, m12, m21, m22, dx, dy] = tabua.local
  c.setTransform(m11 * dpr, m12 * dpr, m21 * dpr, m22 * dpr, dx * dpr, dy * dpr)
}

function madeira(c: CanvasRenderingContext2D, tabua: Tabua, espessura: number, dpr: number, rnd: () => number): void {
  entrarNaTabua(c, tabua, dpr)
  const L = tabua.comprimento
  const perfil = c.createLinearGradient(0, 0, 0, espessura)
  perfil.addColorStop(0, '#24150b')
  perfil.addColorStop(0.14, '#5a3920')
  perfil.addColorStop(0.42, '#7b4f2b')
  perfil.addColorStop(0.78, '#5b3820')
  perfil.addColorStop(1, '#2b1a0e')
  c.fillStyle = perfil
  c.fillRect(-2, -2, L + 4, espessura + 4)
  const linhas = Math.round(espessura * 2.2)
  for (let k = 0; k < linhas; k++) {
    const v0 = rnd() * espessura
    const amp1 = 0.3 + rnd() * 1.2
    const lam1 = 50 + rnd() * 130
    const fase1 = rnd() * 6.283
    const amp2 = rnd() * 0.6
    const lam2 = 9 + rnd() * 16
    const escura = rnd() < 0.68
    c.strokeStyle = escura ? `rgba(28, 14, 6, ${0.18 + rnd() * 0.32})` : `rgba(186, 134, 86, ${0.08 + rnd() * 0.16})`
    c.lineWidth = 0.5 + rnd() * 0.9
    c.beginPath()
    for (let u = -4; u <= L + 4; u += 4) {
      const v = v0 + amp1 * Math.sin(u / lam1 + fase1) + amp2 * Math.sin(u / lam2 + fase1 * 2)
      if (u === -4) c.moveTo(u, v)
      else c.lineTo(u, v)
    }
    c.stroke()
  }
  c.fillStyle = tabua.luz >= 0.75 ? `rgba(255, 214, 170, ${0.07 * tabua.luz})` : `rgba(0, 0, 0, ${(0.75 - tabua.luz) * 0.5})`
  c.fillRect(-2, -2, L + 4, espessura + 4)
  c.restore()
}

function metal(c: CanvasRenderingContext2D, tabua: Tabua, espessura: number, dpr: number, rnd: () => number): void {
  entrarNaTabua(c, tabua, dpr)
  const L = tabua.comprimento
  const perfil = c.createLinearGradient(0, 0, 0, espessura)
  perfil.addColorStop(0, '#3e454b')
  perfil.addColorStop(0.16, '#c7d1d9')
  perfil.addColorStop(0.46, '#8a949c')
  perfil.addColorStop(0.8, '#5a636a')
  perfil.addColorStop(1, '#23282c')
  c.fillStyle = perfil
  c.fillRect(-2, -2, L + 4, espessura + 4)
  for (let k = 0; k < 34; k++) {
    const v = rnd() * espessura
    c.strokeStyle = rnd() < 0.5 ? `rgba(255, 255, 255, ${0.03 + rnd() * 0.05})` : `rgba(0, 0, 0, ${0.04 + rnd() * 0.06})`
    c.lineWidth = 0.5
    const inicio = rnd() * L * 0.3
    c.beginPath()
    c.moveTo(inicio, v)
    c.lineTo(inicio + L * (0.4 + rnd() * 0.7), v + (rnd() - 0.5) * 0.4)
    c.stroke()
  }
  c.fillStyle = tabua.luz >= 0.75 ? `rgba(214, 232, 255, ${0.1 * tabua.luz})` : `rgba(0, 6, 14, ${(0.75 - tabua.luz) * 0.55})`
  c.fillRect(-2, -2, L + 4, espessura + 4)
  c.restore()
}

function esquadrias(c: CanvasRenderingContext2D, w: number, h: number, de: number, ate: number): void {
  const cantos: ReadonlyArray<readonly [number, number, number, number]> = [
    [de, de, ate, ate],
    [w - de, de, w - ate, ate],
    [w - de, h - de, w - ate, h - ate],
    [de, h - de, ate, h - ate],
  ]
  for (const [x1, y1, x2, y2] of cantos) {
    c.strokeStyle = 'rgba(0, 0, 0, 0.6)'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(x1, y1)
    c.lineTo(x2, y2)
    c.stroke()
    c.strokeStyle = 'rgba(255, 226, 190, 0.12)'
    c.beginPath()
    c.moveTo(x1 + 1, y1)
    c.lineTo(x2 + 1, y2)
    c.stroke()
  }
}

/** Cabeça de parafuso (com fenda) ou de rebite (sem). */
function cabeca(c: CanvasRenderingContext2D, x: number, y: number, r: number, fenda: number | null): void {
  c.fillStyle = 'rgba(0, 0, 0, 0.55)'
  c.beginPath()
  c.arc(x + r * 0.28, y + r * 0.34, r * 1.05, 0, 6.283)
  c.fill()
  const brilho = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.1, x, y, r)
  brilho.addColorStop(0, '#f1f6fa')
  brilho.addColorStop(0.45, '#9ba5ad')
  brilho.addColorStop(1, '#3a4146')
  c.fillStyle = brilho
  c.beginPath()
  c.arc(x, y, r, 0, 6.283)
  c.fill()
  if (fenda !== null) {
    c.strokeStyle = 'rgba(16, 20, 24, 0.85)'
    c.lineWidth = Math.max(0.8, r * 0.28)
    c.beginPath()
    c.moveTo(x - Math.cos(fenda) * r * 0.72, y - Math.sin(fenda) * r * 0.72)
    c.lineTo(x + Math.cos(fenda) * r * 0.72, y + Math.sin(fenda) * r * 0.72)
    c.stroke()
  }
}

/** Distância entre rebites ao longo do aro (px). */
const PASSO_DOS_REBITES = 78

function rebites(c: CanvasRenderingContext2D, w: number, h: number, linha: number, espessuraMetal: number, rnd: () => number): void {
  const cantos: ReadonlyArray<Ponto> = [
    [linha, linha],
    [w - linha, linha],
    [w - linha, h - linha],
    [linha, h - linha],
  ]
  for (const [x, y] of cantos) cabeca(c, x, y, espessuraMetal * 0.34, rnd() * Math.PI)
  const lados: ReadonlyArray<readonly [number, number, number, number]> = [
    [linha, linha, w - linha, linha],
    [w - linha, linha, w - linha, h - linha],
    [linha, h - linha, w - linha, h - linha],
    [linha, linha, linha, h - linha],
  ]
  for (const [x1, y1, x2, y2] of lados) {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / PASSO_DOS_REBITES))
    for (let k = 1; k < n; k++) cabeca(c, x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n, espessuraMetal * 0.25, null)
  }
}

export interface MolduraPronta {
  w: number
  h: number
  dpr: number
  madeira: HTMLCanvasElement
  metal: HTMLCanvasElement
}

/**
 * Desenha madeira e metal de uma moldura `w` x `h` px, cada um no seu canvas
 * fora da tela. `null` quando o navegador não dá contexto 2D (o painel fica
 * sem moldura, mas a revelação continua).
 */
export function prepararMoldura(w: number, h: number, madeiraPx: number, metalPx: number, semente: number): MolduraPronta | null {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX)
  const W = Math.max(1, Math.round(w * dpr))
  const H = Math.max(1, Math.round(h * dpr))
  const rnd = mulberry32(semente)
  const cm = novaTela(W, H)
  const c1 = cm.getContext('2d')
  const ct = novaTela(W, H)
  const c2 = ct.getContext('2d')
  if (!c1 || !c2) return null
  for (const tabua of tabuas(w, h, 0, madeiraPx)) madeira(c1, tabua, madeiraPx, dpr, rnd)
  c1.setTransform(dpr, 0, 0, dpr, 0, 0)
  esquadrias(c1, w, h, 0, madeiraPx)
  c1.lineWidth = 1
  c1.strokeStyle = 'rgba(0, 0, 0, 0.7)'
  c1.strokeRect(0.5, 0.5, w - 1, h - 1)
  for (const tabua of tabuas(w, h, madeiraPx, metalPx)) metal(c2, tabua, metalPx, dpr, rnd)
  c2.setTransform(dpr, 0, 0, dpr, 0, 0)
  esquadrias(c2, w, h, madeiraPx, madeiraPx + metalPx)
  c2.lineWidth = 1
  c2.strokeStyle = 'rgba(0, 0, 0, 0.6)'
  c2.strokeRect(madeiraPx + 0.5, madeiraPx + 0.5, w - 2 * madeiraPx - 1, h - 2 * madeiraPx - 1)
  c2.strokeStyle = 'rgba(0, 0, 0, 0.85)'
  const dentro = madeiraPx + metalPx
  c2.strokeRect(dentro - 0.5, dentro - 0.5, w - 2 * dentro + 1, h - 2 * dentro + 1)
  rebites(c2, w, h, madeiraPx + metalPx / 2, metalPx, rnd)
  return { w, h, dpr, madeira: cm, metal: ct }
}

/** Compõe a moldura inteira (madeira e metal) no canvas visível. */
export function comporMoldura(canvas: HTMLCanvasElement, pronta: MolduraPronta): void {
  const W = Math.max(1, Math.round(pronta.w * pronta.dpr))
  const H = Math.max(1, Math.round(pronta.h * pronta.dpr))
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  const c = canvas.getContext('2d')
  if (!c) return
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, W, H)
  c.drawImage(pronta.madeira, 0, 0)
  c.drawImage(pronta.metal, 0, 0)
}
