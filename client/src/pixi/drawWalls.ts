import type { Graphics } from 'pixi.js'
import type { Wall } from '../types/map'

export function drawWalls(graphics: Graphics, walls: Wall[]): void {
  graphics.clear()
  for (const wall of walls) {
    graphics.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2)
    const color = wall.door ? 0xd08c3a : 0xe0e0e0
    graphics.stroke({ width: 4, color })
  }
}
