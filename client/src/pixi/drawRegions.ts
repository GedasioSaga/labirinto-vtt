import type { Graphics } from 'pixi.js'
import type { Region } from '../types/map'
import { isDegenerateRegion } from './shapes'
import { SELECTION_COLOR } from './constants'

export function drawRegions(graphics: Graphics, regions: Region[], selectedRegionId: string | null = null): void {
  graphics.clear()
  for (const region of regions) {
    if (isDegenerateRegion(region.points)) continue
    const [first, ...rest] = region.points
    graphics.moveTo(first.x, first.y)
    for (const point of rest) {
      graphics.lineTo(point.x, point.y)
    }
    graphics.closePath()
    const isSelected = region.id === selectedRegionId
    graphics.fill({ color: isSelected ? SELECTION_COLOR : 0x3a7ad0, alpha: isSelected ? 0.25 : 0.15 })
    graphics.stroke({ width: isSelected ? 4 : 2, color: isSelected ? SELECTION_COLOR : 0x3a7ad0 })
  }
}
