import type { Graphics } from 'pixi.js'
import type { Region } from '../types/map'
import { isDegenerateRegion } from './shapes'

export function drawRegions(graphics: Graphics, regions: Region[]): void {
  graphics.clear()
  for (const region of regions) {
    if (isDegenerateRegion(region.points)) continue
    const [first, ...rest] = region.points
    graphics.moveTo(first.x, first.y)
    for (const point of rest) {
      graphics.lineTo(point.x, point.y)
    }
    graphics.closePath()
    graphics.fill({ color: 0x3a7ad0, alpha: 0.15 })
    graphics.stroke({ width: 2, color: 0x3a7ad0 })
  }
}
