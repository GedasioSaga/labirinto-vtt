import type { Graphics } from 'pixi.js'
import type { GridSettings } from '../types/map'
import { hexCorners, type Point } from './hexGrid'
import { strokeDashedSegment } from './grid'

/** Ver o comentário equivalente em `drawGrid.ts` — mesmo motivo pra não ter default. */
export function drawHexGrid(graphics: Graphics, centers: Point[], size: number, settings: GridSettings): void {
  graphics.clear()
  if (centers.length === 0) return

  for (const center of centers) {
    const corners = hexCorners(center, size)
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i]
      const b = corners[(i + 1) % corners.length]
      strokeDashedSegment(graphics, a.x, a.y, b.x, b.y, settings.lineStyle)
    }
  }

  graphics.stroke({
    width: settings.lineWidth,
    color: settings.color,
    alpha: settings.opacity,
    cap: settings.lineStyle === 'dotted' ? 'round' : 'butt',
  })
}
