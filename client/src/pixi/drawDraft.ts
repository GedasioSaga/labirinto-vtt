import { Color, type Graphics } from 'pixi.js'
import type { Point } from './world'
import type { DrawingCap } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { computeStairSteps } from '../lib/stairs'
import { computeMarkerStroke, computePencilSegments, type BrushTexture } from '../lib/brushTexture'

export function drawWallDraft(graphics: Graphics, start: Point, end: Point): void {
  graphics.clear()
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 4, color: SELECTION_COLOR, alpha: 0.8 })
}

// start/end = clique inicial e ponto de arrasto atual do lance de escada.
// Mesmo esqueleto de drawWallDraft, mas já mostra os degraus procedurais
// (computeStairSteps, mesma função pura que drawStairs.ts usa no render
// final) em vez de uma linha única — o preview do arrasto já parece uma
// escada, não só um traço reto que "vira" escada de surpresa ao soltar.
export function drawStairDraft(graphics: Graphics, start: Point, end: Point, stepWidth: number): void {
  graphics.clear()
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 1, color: SELECTION_COLOR, alpha: 0.5 })
  for (const step of computeStairSteps({ x1: start.x, y1: start.y, x2: end.x, y2: end.y }, stepWidth)) {
    graphics.moveTo(step.x1, step.y1).lineTo(step.x2, step.y2).stroke({ width: 3, color: SELECTION_COLOR, alpha: 0.8 })
  }
}

export function drawRegionDraft(graphics: Graphics, points: Point[], cursor: Point | null): void {
  graphics.clear()
  if (points.length === 0) return

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) {
    graphics.lineTo(point.x, point.y)
  }
  if (cursor) {
    graphics.lineTo(cursor.x, cursor.y)
  }
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })

  for (const point of points) {
    graphics.circle(point.x, point.y, 4).fill({ color: SELECTION_COLOR })
  }
}

// cap: preferência de ferramenta (Bug B2, "ponta reta/arredondada"). Opcional
// com default 'round' — mesmo valor que estava hardcoded antes desta mudança
// — pra não exigir que o call site em PixiCanvas.tsx (fora do meu escopo)
// passe o parâmetro novo; a aparência do draft não muda pra quem ainda não
// tem a preferência ligada. Ver CONTRATO no relatório do agente B2 pra como
// ligar isso na preferência real de "próxima forma" da store.
// texture: preferência de ferramenta (N1, "pincel: caneta/lápis/marcador").
// Opcional com default 'pen' — mesmo comportamento de antes desta mudança —
// pra não exigir que o call site em PixiCanvas.tsx (fora do meu escopo)
// passe o parâmetro novo; o preview do pincel não muda pra quem ainda não
// tem a preferência ligada. Ver CONTRATO no relatório do agente pra como
// ligar isso na preferência real de "próxima textura" da store.
export function drawFreehandDraft(graphics: Graphics, points: Point[], color: string, width: number, cap: DrawingCap = 'round', texture: BrushTexture = 'pen'): void {
  graphics.clear()
  if (points.length < 2) return
  const numericColor = new Color(color).toNumber()

  if (texture === 'pencil') {
    for (const segment of computePencilSegments(points, width)) {
      graphics.moveTo(segment.from.x, segment.from.y).lineTo(segment.to.x, segment.to.y)
      graphics.stroke({ width: segment.width, color: numericColor, alpha: segment.alpha, cap, join: 'round' })
    }
    return
  }

  if (texture === 'marker') {
    const { width: markerWidth, alpha } = computeMarkerStroke(width)
    const [first, ...rest] = points
    graphics.moveTo(first.x, first.y)
    for (const point of rest) graphics.lineTo(point.x, point.y)
    graphics.stroke({ width: markerWidth, color: numericColor, alpha, cap, join: 'round' })
    return
  }

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.stroke({ width, color: numericColor, alpha: 0.8, cap, join: 'round' })
}

export function drawCurveDraft(graphics: Graphics, points: Point[], color: string, width: number, cap: DrawingCap = 'round'): void {
  graphics.clear()
  if (points.length < 2) return
  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8, cap, join: 'round' })
}

export function drawLineDraft(graphics: Graphics, start: Point, end: Point, color: string, width: number, cap: DrawingCap = 'round'): void {
  graphics.clear()
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width, color: new Color(color).toNumber(), alpha: 0.8, cap })
}

export function drawCircleDraft(graphics: Graphics, center: Point, radius: number, color: string, width: number, filled: boolean): void {
  graphics.clear()
  graphics.circle(center.x, center.y, radius)
  if (filled) graphics.fill({ color: new Color(color).toNumber(), alpha: 0.35 })
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8 })
}

// start/end = os dois cantos do arrasto (qualquer ordem) — mesma normalização
// de buildRectDrawing. fillAlpha vem da preferência "próxima forma"
// (drawFillAlpha), pra o preview já mostrar a opacidade real do resultado.
export function drawRectDraft(graphics: Graphics, start: Point, end: Point, color: string, width: number, filled: boolean, fillAlpha: number): void {
  graphics.clear()
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const w = Math.abs(end.x - start.x)
  const h = Math.abs(end.y - start.y)
  graphics.rect(x, y, w, h)
  if (filled) graphics.fill({ color: new Color(color).toNumber(), alpha: fillAlpha })
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8 })
}

// center = clique inicial (fixo); end = ponto de arrasto atual — rx/ry
// calculados aqui dentro (ao contrário de buildEllipseDrawing, que já os
// recebe prontos) porque o chamador do draft só tem os dois pontos brutos,
// ainda sem checagem de validade.
export function drawEllipseDraft(graphics: Graphics, center: Point, end: Point, color: string, width: number, filled: boolean, fillAlpha: number): void {
  graphics.clear()
  const rx = Math.abs(end.x - center.x)
  const ry = Math.abs(end.y - center.y)
  graphics.ellipse(center.x, center.y, rx, ry)
  if (filled) graphics.fill({ color: new Color(color).toNumber(), alpha: fillAlpha })
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8 })
}

/**
 * Preview do polígono livre (Drawing, não Region) durante o clique-por-vértice
 * — mesmo esqueleto de drawRegionDraft (contorno aberto até o cursor + pontos
 * grudáveis), mas com a cor/espessura do desenho em vez de SELECTION_COLOR, e
 * com preview de preenchimento (fechado) quando `filled` e já há 3+ vértices,
 * igual ao restante das formas preenchíveis deste arquivo.
 */
export function drawPolygonDraft(graphics: Graphics, points: Point[], cursor: Point | null, color: string, width: number, filled: boolean, fillAlpha: number): void {
  graphics.clear()
  if (points.length === 0) return
  const numericColor = new Color(color).toNumber()

  if (filled && points.length >= 3) {
    graphics.poly(points).fill({ color: numericColor, alpha: fillAlpha })
  }

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  if (cursor) graphics.lineTo(cursor.x, cursor.y)
  graphics.stroke({ width, color: numericColor, alpha: 0.8, cap: 'round', join: 'round' })

  for (const point of points) {
    graphics.circle(point.x, point.y, 4).fill({ color: SELECTION_COLOR })
  }
}

/**
 * Preview do raio da ferramenta "Luz" durante o arrasto — mesmo estilo visual
 * de drawCircleDraft (fill translúcido + stroke), sem os parâmetros de cor/
 * largura de desenho porque a luz não tem esses controles no toolbar; usa
 * SELECTION_COLOR, igual ao restante dos drafts de forma nesse arquivo.
 */
export function drawLightDraft(graphics: Graphics, center: Point, radius: number): void {
  graphics.clear()
  graphics.circle(center.x, center.y, radius)
  graphics.fill({ color: SELECTION_COLOR, alpha: 0.2 })
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })
}

/**
 * Preview do poligono regular inscrito no círculo definido por `center` (fixo,
 * clique inicial) e `radiusPoint` (cursor atual) — mesma trigonometria de
 * `buildRegularPolygonRoomFromDraft`, só que sem materializar Region/Wall
 * ainda. `sides=24` (Sala Circular) já aproxima um círculo suave; `sides`
 * baixo (Polígono Regular) mostra o polígono de fato.
 */
export function drawRegularPolygonDraft(graphics: Graphics, center: Point, radiusPoint: Point, sides: number, fillColor: string): void {
  graphics.clear()
  if (sides < 3) return

  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  const angle0 = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x)
  const points: Point[] = Array.from({ length: sides }, (_, i) => {
    const angle = angle0 + (i * 2 * Math.PI) / sides
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.closePath()
  graphics.fill({ color: new Color(fillColor).toNumber(), alpha: 0.35 })
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })
}

export function drawRoomDraft(graphics: Graphics, start: Point, end: Point, fillColor: string): void {
  graphics.clear()
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  graphics.rect(minX, minY, width, height)
  graphics.fill({ color: new Color(fillColor).toNumber(), alpha: 0.35 })
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })
}
