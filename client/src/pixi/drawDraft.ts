import { Color, type Graphics } from 'pixi.js'
import type { Point } from './world'
import { SELECTION_COLOR } from './constants'

export function drawWallDraft(graphics: Graphics, start: Point, end: Point): void {
  graphics.clear()
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 4, color: SELECTION_COLOR, alpha: 0.8 })
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

export function drawFreehandDraft(graphics: Graphics, points: Point[], color: string, width: number): void {
  graphics.clear()
  if (points.length < 2) return
  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8, cap: 'round', join: 'round' })
}

export function drawCurveDraft(graphics: Graphics, points: Point[], color: string, width: number): void {
  graphics.clear()
  if (points.length < 2) return
  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8, cap: 'round', join: 'round' })
}

export function drawLineDraft(graphics: Graphics, start: Point, end: Point, color: string, width: number): void {
  graphics.clear()
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width, color: new Color(color).toNumber(), alpha: 0.8, cap: 'round' })
}

export function drawCircleDraft(graphics: Graphics, center: Point, radius: number, color: string, width: number, filled: boolean): void {
  graphics.clear()
  graphics.circle(center.x, center.y, radius)
  if (filled) graphics.fill({ color: new Color(color).toNumber(), alpha: 0.35 })
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8 })
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
