import type { Wall, RegionPoint } from '../types/map'

export function wallLength(wall: Wall): number {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
}

export function isDegenerateRegion(points: RegionPoint[]): boolean {
  return points.length < 3
}
