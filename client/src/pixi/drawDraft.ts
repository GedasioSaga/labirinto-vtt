import type { Graphics } from 'pixi.js'
import type { Point } from './world'

export function drawWallDraft(graphics: Graphics, start: Point, end: Point): void {
  graphics.clear()
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 4, color: 0xffdd55, alpha: 0.8 })
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
  graphics.stroke({ width: 2, color: 0xffdd55, alpha: 0.8 })

  for (const point of points) {
    graphics.circle(point.x, point.y, 4).fill({ color: 0xffdd55 })
  }
}
