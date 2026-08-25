import type { Token } from '../types/map'
import type { Point } from './world'

export function snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
  if (gridSize <= 0) return { x, y }
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  }
}

export function findTokenAt(tokens: Token[], point: Point, gridSize: number): Token | null {
  const baseRadius = gridSize / 2
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i]
    const hitRadius = baseRadius * token.size
    const dx = point.x - token.x
    const dy = point.y - token.y
    if (Math.hypot(dx, dy) <= hitRadius) {
      return token
    }
  }
  return null
}
