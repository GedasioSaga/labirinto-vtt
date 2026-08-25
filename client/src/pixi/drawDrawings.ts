import { Color, type Graphics } from 'pixi.js'
import type { Drawing } from '../types/map'
import { SELECTION_COLOR } from './constants'

export function drawDrawings(graphics: Graphics, drawings: Drawing[], selectedDrawingId: string | null = null): void {
  graphics.clear()
  for (const drawing of drawings) {
    const isSelected = drawing.id === selectedDrawingId
    const color = isSelected ? SELECTION_COLOR : new Color(drawing.color).toNumber()
    const width = isSelected ? drawing.width + 2 : drawing.width

    if (drawing.kind === 'freehand') {
      if (drawing.points.length < 2) continue
      const [first, ...rest] = drawing.points
      graphics.moveTo(first.x, first.y)
      for (const point of rest) graphics.lineTo(point.x, point.y)
      graphics.stroke({ width, color, cap: 'round', join: 'round' })
    } else if (drawing.kind === 'line') {
      graphics.moveTo(drawing.x1, drawing.y1).lineTo(drawing.x2, drawing.y2).stroke({ width, color, cap: 'round' })
    } else {
      graphics.circle(drawing.cx, drawing.cy, drawing.radius)
      if (drawing.filled) graphics.fill({ color, alpha: isSelected ? 0.35 : 0.5 })
      graphics.stroke({ width, color })
    }
  }
}
