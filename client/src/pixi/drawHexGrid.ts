import type { Graphics } from 'pixi.js'
import { hexCorners, type Point } from './hexGrid'

export function drawHexGrid(graphics: Graphics, centers: Point[], size: number, color = 0x4a4a4a, lineWidth = 1): void {
  graphics.clear()
  if (centers.length === 0) return

  for (const center of centers) {
    const corners = hexCorners(center, size)
    const [first, ...rest] = corners
    graphics.moveTo(first.x, first.y)
    for (const corner of rest) {
      graphics.lineTo(corner.x, corner.y)
    }
    graphics.closePath()
  }
  graphics.stroke({ width: lineWidth, color })
}
