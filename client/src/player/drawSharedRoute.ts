import type { Graphics } from 'pixi.js'
import type { Point } from '../pixi/world'

/**
 * CAMINHO que um colega mostrou com a régua, desenhado em espaço de TELA como a
 * régua (espessura igual em qualquer zoom). Tracejado na cor da ficha dele,
 * para não se confundir com a régua do próprio jogador, que é linha cheia e
 * clara. Estilo do minimapa: traço fino, pontas pequenas, sem contorno grosso.
 */
const LINE_WIDTH = 2
const LINE_ALPHA = 0.95
const SHADOW_COLOR = 0x111111
const SHADOW_ALPHA = 0.35
const SHADOW_WIDTH = 4
/** Traço e vão do tracejado, em px de tela. */
export const ROUTE_DASH_PX = 8
export const ROUTE_GAP_PX = 6
/** Ponto cheio na saída, anel na chegada: dá o sentido do caminho. */
const START_DOT_RADIUS = 3
const END_RING_RADIUS = 4.5
/** Menor avanço do tracejado, em px: bem abaixo do que se vê. */
const MIN_STEP_PX = 1e-6

export interface DashSegment {
  from: Point
  to: Point
}

/** Etiqueta do caminho no mapa. */
export function sharedRouteLabel(from: string): string {
  return `caminho do ${from}`
}

/** O ponto `distance` px adiante de `a`, na direção unitária `(ux, uy)`. */
const pointAt = (a: Point, ux: number, uy: number, distance: number): Point => ({ x: a.x + ux * distance, y: a.y + uy * distance })

/**
 * Corta a linha quebrada `points` em traços de `dash` px separados por vãos de
 * `gap` px. O ritmo segue pelas dobras (um traço que cruza a dobra sai em dois
 * pedaços), e trecho de comprimento zero não vira nada.
 */
export function dashedSegments(points: readonly Point[], dash: number, gap: number): DashSegment[] {
  const out: DashSegment[] = []
  if (dash <= 0 || gap < 0) return out
  const period = dash + gap
  // Distância percorrida desde o começo do caminho: decide se o trecho cai em traço ou em vão.
  let walked = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    if (a === undefined || b === undefined) continue
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length === 0) continue
    const ux = (b.x - a.x) / length
    const uy = (b.y - a.y) / length
    let along = 0
    while (along < length) {
      const phase = (walked + along) % period
      const inDash = phase < dash
      // Piso no passo: um resto de ponto flutuante menor que o ulp de `along` travaria o laço.
      const step = Math.max(Math.min((inDash ? dash : period) - phase, length - along), MIN_STEP_PX)
      if (inDash) out.push({ from: pointAt(a, ux, uy, along), to: along + step >= length ? { x: b.x, y: b.y } : pointAt(a, ux, uy, along + step) })
      along += step
    }
    walked += length
  }
  return out
}

export function drawSharedRoute(g: Graphics, points: readonly Point[], color: string): void {
  g.clear()
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined || points.length < 2) return
  const dashes = dashedSegments(points, ROUTE_DASH_PX, ROUTE_GAP_PX)
  for (const { from, to } of dashes) g.moveTo(from.x, from.y).lineTo(to.x, to.y)
  g.stroke({ width: SHADOW_WIDTH, color: SHADOW_COLOR, alpha: SHADOW_ALPHA, cap: 'round' })
  for (const { from, to } of dashes) g.moveTo(from.x, from.y).lineTo(to.x, to.y)
  g.stroke({ width: LINE_WIDTH, color, alpha: LINE_ALPHA, cap: 'round' })
  g.circle(first.x, first.y, START_DOT_RADIUS).fill({ color, alpha: LINE_ALPHA })
  g.circle(last.x, last.y, END_RING_RADIUS).stroke({ width: LINE_WIDTH, color, alpha: LINE_ALPHA })
}
