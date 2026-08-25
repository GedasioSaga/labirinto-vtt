import type { Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { SELECTION_COLOR } from './constants'

export function drawWalls(graphics: Graphics, walls: Wall[], selectedWallId: string | null = null): void {
  graphics.clear()
  for (const wall of walls) {
    graphics.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2)
    const isSelected = wall.id === selectedWallId
    const color = isSelected ? SELECTION_COLOR : wall.door ? 0xd08c3a : 0xe0e0e0
    graphics.stroke({ width: isSelected ? 6 : 4, color })
  }
}
