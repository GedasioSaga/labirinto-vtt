import type { RitmoDaPista } from './coreografia'
import { EASE_OUT } from './curvas'
import type { NotaEmJogo } from './partida'
import { DIF, type Julgamento, type SubdivisaoDanca } from './regras'
import type { DificuldadeDanca } from './tipos'

/**
 * PISTA: as 4 trilhas (← ↓ ↑ →), os receptores embaixo, as linhas de batida e
 * as setas descendo, coloridas pela divisão do tempo. Canvas nítido, com DPR.
 * As contas de posição são puras; `desenharPista` recebe o estado do jogo por
 * parâmetro e só pinta.
 */

/** Latão = semínima, azul = colcheia, violeta = semicolcheia. */
export const COR_SUB: Readonly<Record<SubdivisaoDanca, string>> = { 4: '#e0a44a', 8: '#79a9cc', 16: '#ab93d6' }
export const COR_JULG: Readonly<Record<Julgamento, string>> = { perfeito: '#f3ba66', bom: '#7fb48a', ok: '#79a9cc', errou: '#e2645a' }
/** Giro da seta (desenhada apontando para baixo) em cada trilha: ← ↓ ↑ →. */
const ROT: readonly number[] = [Math.PI / 2, 0, Math.PI, -Math.PI / 2]
const COR_DO_CONTORNO = '#1b1208'

export interface LayoutDaPista {
  /** Densidade de pixels usada (até 2). */
  dpr: number
  /** Caixa em px CSS. */
  w: number
  h: number
  /** Tamanho do canvas em px do aparelho. */
  larguraPx: number
  alturaPx: number
  /** Largura de cada trilha e onde a primeira começa. */
  lw: number
  x0: number
  /** Lado da seta. */
  tam: number
  /** Altura do centro dos receptores. */
  ry: number
}

const DPR_MAX = 2
const TRILHA_MAX_PX = 88
const MARGEM_LATERAL_PX = 16
const SETA_NA_TRILHA = 0.8
const MARGEM_INFERIOR_PX = 14
const MEDIDA_MINIMA_CSS = 10

/** Layout da pista para uma caixa de `larguraCss` × `alturaCss`; null se a caixa ainda não tem tamanho. */
export function medirPista(larguraCss: number, alturaCss: number, devicePixelRatio: number): LayoutDaPista | null {
  if (larguraCss < MEDIDA_MINIMA_CSS || alturaCss < MEDIDA_MINIMA_CSS) return null
  const dpr = Math.min(DPR_MAX, devicePixelRatio || 1)
  const lw = Math.min(TRILHA_MAX_PX, (larguraCss - MARGEM_LATERAL_PX) / 4)
  const tam = Math.round(lw * SETA_NA_TRILHA)
  return {
    dpr,
    w: larguraCss,
    h: alturaCss,
    larguraPx: Math.round(larguraCss * dpr),
    alturaPx: Math.round(alturaCss * dpr),
    lw,
    x0: (larguraCss - lw * 4) / 2,
    tam,
    ry: alturaCss - tam / 2 - MARGEM_INFERIOR_PX,
  }
}

export function centroDaTrilha(layout: LayoutDaPista, trilha: number): number {
  return layout.x0 + layout.lw * (trilha + 0.5)
}

/** Velocidade da seta: do topo (uma seta acima da borda) ao receptor no tempo de queda da dificuldade. */
export function pixelsPorSegundo(layout: LayoutDaPista, dif: DificuldadeDanca): number {
  return (layout.ry + layout.tam) / DIF[dif].tela
}

/** Linhas de batida visíveis acima dos receptores; `forte` = começo de compasso. */
export function linhasDeBatida(layout: LayoutDaPista, st: number, ritmo: RitmoDaPista, pps: number): { y: number; forte: boolean }[] {
  const linhas: { y: number; forte: boolean }[] = []
  const b = ritmo.batidaS
  if (!(b > 0) || !(pps > 0)) return linhas
  for (let k = Math.ceil((st - ritmo.grade0) / b); ; k += 1) {
    const t = ritmo.grade0 + k * b
    const y = layout.ry - (t - st) * pps
    if (y < -4) break
    if (y > layout.h) continue
    linhas.push({ y, forte: (((k - ritmo.fase4) % 4) + 4) % 4 === 0 })
  }
  return linhas
}

/** Seta que acabou há mais de 0,8 s não aparece mais: o desenho começa depois dela. */
const RASTRO_S = 0.8

/** Primeira seta ainda visível a partir de `cursor` (nunca volta atrás). */
export function avancarCursorDeDesenho(notas: readonly NotaEmJogo[], cursor: number, st: number): number {
  let c = cursor
  while (c < notas.length && notas[c].t + notas[c].len < st - RASTRO_S) c += 1
  return c
}

// ------------------------------------------------------------------ sprites

export type CriarCanvas = (w: number, h: number) => HTMLCanvasElement

const canvasDoDocumento: CriarCanvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export interface SpritesDaPista {
  /** Seta de cada divisão, por trilha. */
  nota: Record<SubdivisaoDanca, HTMLCanvasElement[]>
  /** Seta perdida (Errou), cinza. */
  morta: HTMLCanvasElement[]
  /** Receptor solto e apertado. */
  rec: HTMLCanvasElement[]
  recOn: HTMLCanvasElement[]
}

/** Seta grossa apontando para baixo, centrada na origem, com meio-lado `s`. */
function caminhoSeta(g: CanvasRenderingContext2D, s: number): void {
  g.beginPath()
  g.moveTo(-0.34 * s, -0.92 * s)
  g.lineTo(0.34 * s, -0.92 * s)
  g.lineTo(0.34 * s, 0.02 * s)
  g.lineTo(0.8 * s, 0.02 * s)
  g.lineTo(0, 0.9 * s)
  g.lineTo(-0.8 * s, 0.02 * s)
  g.lineTo(-0.34 * s, 0.02 * s)
  g.closePath()
}

function spriteSeta(criar: CriarCanvas, tamPx: number, rot: number, fill: string | null, stroke: string, larg: number): HTMLCanvasElement {
  const lado = Math.ceil(tamPx)
  const c = criar(lado, lado)
  const g = c.getContext('2d')
  if (g === null) throw new Error('canvas 2D indisponível: a pista da dança não tem onde desenhar')
  const s = tamPx / 2 - larg
  g.translate(tamPx / 2, tamPx / 2)
  g.rotate(rot)
  g.lineJoin = 'round'
  caminhoSeta(g, s)
  if (fill !== null) {
    g.fillStyle = fill
    g.fill()
  }
  g.lineWidth = larg
  g.strokeStyle = stroke
  g.stroke()
  return c
}

/** Espessura do contorno: 7% da seta, nunca menos de 2 px do aparelho. */
const CONTORNO_DA_SETA = 0.07
const CONTORNO_MINIMO_PX = 2

/** Pré-desenha as setas no tamanho do layout. Refaça quando o layout mudar. */
export function criarSpritesDaPista(layout: LayoutDaPista, criar: CriarCanvas = canvasDoDocumento): SpritesDaPista {
  const px = layout.tam * layout.dpr
  const lg = Math.max(CONTORNO_MINIMO_PX, px * CONTORNO_DA_SETA)
  const porTrilha = (fill: string | null, stroke: string, larg: number): HTMLCanvasElement[] => ROT.map((rt) => spriteSeta(criar, px, rt, fill, stroke, larg))
  return {
    nota: { 4: porTrilha(COR_SUB[4], COR_DO_CONTORNO, lg), 8: porTrilha(COR_SUB[8], COR_DO_CONTORNO, lg), 16: porTrilha(COR_SUB[16], COR_DO_CONTORNO, lg) },
    morta: porTrilha('#5a5853', COR_DO_CONTORNO, lg),
    rec: porTrilha(null, 'rgba(162,160,154,0.55)', lg * 0.8),
    recOn: porTrilha('rgba(224,164,74,0.22)', '#f3ba66', lg),
  }
}

// ------------------------------------------------------------------ quadro da pista

/** Anel de julgamento num receptor: começou em `inicio` (ms de performance). */
export interface EfeitoDaTrilha {
  inicio: number
  julg: Julgamento
}

export interface EstadoDaPista {
  /** Posição da música, em s. */
  st: number
  dif: DificuldadeDanca
  /** null antes da música: só trilhas e receptores. */
  notas: readonly NotaEmJogo[] | null
  ritmo: RitmoDaPista
  apertadas: readonly boolean[]
  efeitos: readonly (EfeitoDaTrilha | null)[]
  /** Primeira seta a desenhar (devolvido atualizado por `desenharPista`). */
  cursorDesenho: number
  reduzido: boolean
}

/** O anel dura 180 ms (120 com movimento reduzido) e cresce 32%. */
const ANEL_MS = 180
const ANEL_REDUZIDO_MS = 120
const ANEL_CRESCE = 0.32

/** Escala e opacidade do anel de julgamento `k` = 0-1 do caminho; null fora dele. */
export function anelDoEfeito(decorridoMs: number, reduzido: boolean): { escala: number; alfa: number } | null {
  const k = decorridoMs / (reduzido ? ANEL_REDUZIDO_MS : ANEL_MS)
  if (k >= 1 || k < 0) return null
  return { escala: reduzido ? 1 : 1 + ANEL_CRESCE * EASE_OUT(k), alfa: (1 - k) * 0.9 }
}

function desenharTrilhas(g: CanvasRenderingContext2D, L: LayoutDaPista): void {
  for (let i = 0; i < 4; i += 1) {
    g.fillStyle = i % 2 ? 'rgba(236,234,228,0.025)' : 'rgba(236,234,228,0.045)'
    g.fillRect(L.x0 + i * L.lw + 2, 0, L.lw - 4, L.h)
  }
}

function desenharSetas(g: CanvasRenderingContext2D, L: LayoutDaPista, spr: SpritesDaPista, notas: readonly NotaEmJogo[], desde: number, st: number, pps: number): void {
  const s = L.tam
  for (let i = desde; i < notas.length; i += 1) {
    const n = notas[i]
    let y = L.ry - (n.t - st) * pps
    if (y < -s) break
    const x = centroDaTrilha(L, n.lane)
    if (n.len > 0 && n.fimOk !== true) {
      // Cauda da segurada: some quando fecha inteira; fica cinza quando perdida.
      const yFim = L.ry - (n.t + n.len - st) * pps
      const morta = n.julg === 'errou' || n.fimOk === false
      if (n.segurando) y = L.ry
      const bw = s * 0.42
      g.fillStyle = morta ? 'rgba(90,88,83,0.5)' : n.segurando ? 'rgba(243,186,102,0.7)' : 'rgba(224,164,74,0.42)'
      g.fillRect(x - bw / 2, yFim, bw, Math.max(0, y - yFim))
      g.fillStyle = morta ? '#5a5853' : '#f3ba66'
      g.fillRect(x - bw / 2, yFim, bw, 3)
    }
    if (n.julg !== null && n.julg !== 'errou' && !(n.len > 0 && n.segurando)) continue
    if (n.len > 0 && n.fimOk === true) continue
    if (n.julg === 'errou') {
      g.globalAlpha = 0.4
      g.drawImage(spr.morta[n.lane], x - s / 2, y - s / 2, s, s)
      g.globalAlpha = 1
    } else g.drawImage(spr.nota[n.sub][n.lane], x - s / 2, y - s / 2, s, s)
  }
}

/** Desenha um quadro da pista. Devolve o cursor de desenho atualizado (guarde para o próximo quadro). */
export function desenharPista(g: CanvasRenderingContext2D, L: LayoutDaPista, spr: SpritesDaPista, e: EstadoDaPista, agoraMs: number): number {
  g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0)
  g.clearRect(0, 0, L.w, L.h)
  desenharTrilhas(g, L)
  const s = L.tam
  const pps = pixelsPorSegundo(L, e.dif)
  if (e.notas !== null) {
    for (const linha of linhasDeBatida(L, e.st, e.ritmo, pps)) {
      g.fillStyle = linha.forte ? 'rgba(236,234,228,0.12)' : 'rgba(236,234,228,0.05)'
      g.fillRect(L.x0 + 4, Math.round(linha.y), L.lw * 4 - 8, 1)
    }
  }
  for (let i = 0; i < 4; i += 1) g.drawImage(e.apertadas[i] ? spr.recOn[i] : spr.rec[i], centroDaTrilha(L, i) - s / 2, L.ry - s / 2, s, s)
  let cursor = e.cursorDesenho
  if (e.notas !== null) {
    cursor = avancarCursorDeDesenho(e.notas, cursor, e.st)
    desenharSetas(g, L, spr, e.notas, cursor, e.st, pps)
  }
  for (let i = 0; i < 4; i += 1) {
    const ef = e.efeitos[i]
    if (ef === null || ef === undefined) continue
    const anel = anelDoEfeito(agoraMs - ef.inicio, e.reduzido)
    if (anel === null) continue
    g.globalAlpha = anel.alfa
    g.strokeStyle = COR_JULG[ef.julg]
    g.lineWidth = 3
    g.beginPath()
    g.arc(centroDaTrilha(L, i), L.ry, s * 0.56 * anel.escala, 0, Math.PI * 2)
    g.stroke()
    g.globalAlpha = 1
  }
  return cursor
}
