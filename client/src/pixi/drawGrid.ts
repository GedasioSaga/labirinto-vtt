import type { Graphics } from 'pixi.js'
import type { GridLine, Viewport } from './grid'

export function drawGrid(graphics: Graphics, lines: GridLine[], viewport: Viewport, color = 0x4a4a4a, lineWidth = 1): void {
  graphics.clear()
  if (lines.length === 0) return

  for (const line of lines) {
    if (line.axis === 'x') {
      graphics.moveTo(line.position, viewport.top).lineTo(line.position, viewport.bottom)
    } else {
      graphics.moveTo(viewport.left, line.position).lineTo(viewport.right, line.position)
    }
  }
  graphics.stroke({ width: lineWidth, color })
}
