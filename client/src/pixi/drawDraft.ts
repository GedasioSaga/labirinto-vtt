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
