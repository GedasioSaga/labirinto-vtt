import type { Wall, Light, Region, RegionPoint, MapData } from '../types/map'
import type { Selection } from '../types/tools'
import { findTokenAt } from '../pixi/tokenInteraction'
import { findPropAt } from '../pixi/propInteraction'

export interface Point {
  x: number
  y: number
}

const WALL_HIT_TOLERANCE = 8
const LIGHT_HIT_RADIUS = 14

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  const closestX = a.x + t * dx
  const closestY = a.y + t * dy
  return Math.hypot(point.x - closestX, point.y - closestY)
}

export function findWallAt(walls: Wall[], point: Point, tolerance = WALL_HIT_TOLERANCE): Wall | null {
  for (let i = walls.length - 1; i >= 0; i -= 1) {
    const wall = walls[i]
    if (distanceToSegment(point, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }) <= tolerance) {
      return wall
    }
  }
  return null
}

export function findLightAt(lights: Light[], point: Point, handleRadius = LIGHT_HIT_RADIUS): Light | null {
  for (let i = lights.length - 1; i >= 0; i -= 1) {
    const light = lights[i]
    if (Math.hypot(point.x - light.x, point.y - light.y) <= handleRadius) {
      return light
    }
  }
  return null
}

export function isPointInPolygon(point: Point, points: RegionPoint[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersects = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export function findRegionAt(regions: Region[], point: Point): Region | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const region = regions[i]
    if (region.points.length >= 3 && isPointInPolygon(point, region.points)) {
      return region
    }
  }
  return null
}

export interface SelectableHit extends Selection {
  draggable: boolean
}

/**
 * Cadeia de prioridade única de hit-test, usada pela ferramenta "Selecionar":
 * token/prop primeiro (pequenos, em primeiro plano, arrastáveis), depois
 * luz/parede (marcáveis mas não arrastáveis nesta versão), região por último
 * (área grande, não deve "engolir" clique destinado a algo menor por cima).
 */
export function findSelectableAt(map: MapData, point: Point): SelectableHit | null {
  const token = findTokenAt(map.tokens, point, map.grid)
  if (token) return { kind: 'token', id: token.id, draggable: true }

  const prop = findPropAt(map.props, point)
  if (prop) return { kind: 'prop', id: prop.id, draggable: true }

  const light = findLightAt(map.lights, point)
  if (light) return { kind: 'light', id: light.id, draggable: false }

  const wall = findWallAt(map.walls, point)
  if (wall) return { kind: 'wall', id: wall.id, draggable: false }

  const region = findRegionAt(map.regions, point)
  if (region) return { kind: 'region', id: region.id, draggable: false }

  return null
}
