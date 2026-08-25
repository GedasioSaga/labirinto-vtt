import type { Wall } from '../types/map'
import type { Point } from '../pixi/world'

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a.x, b.x) <= p.x &&
    p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y &&
    p.y <= Math.max(a.y, b.y)
  )
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)

  if (o1 === 0 && onSegment(a, b, c)) return true
  if (o2 === 0 && onSegment(a, b, d)) return true
  if (o3 === 0 && onSegment(c, d, a)) return true
  if (o4 === 0 && onSegment(c, d, b)) return true

  return o1 * o2 < 0 && o3 * o4 < 0
}

export function moveCrossesWall(from: Point, to: Point, wall: Wall): boolean {
  if (!wall.blocksMove) return false
  return segmentsIntersect(from, to, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 })
}

export function resolveTokenMove(from: Point, to: Point, walls: Wall[]): Point {
  const blocked = walls.some((wall) => moveCrossesWall(from, to, wall))
  return blocked ? from : to
}
