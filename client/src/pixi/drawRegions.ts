import type { Graphics } from 'pixi.js'
import type { Region } from '../types/map'
import { isDegenerateRegion } from './shapes'

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
    graphics.fill({ color: isSelected ? 0xffdd55 : 0x3a7ad0, alpha: isSelected ? 0.25 : 0.15 })
    graphics.stroke({ width: isSelected ? 4 : 2, color: isSelected ? 0xffdd55 : 0x3a7ad0 })
  }
}
