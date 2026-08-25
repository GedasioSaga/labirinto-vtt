import type { Wall, Light, Region, RegionPoint, Drawing } from '../types/map'
import type { Point } from '../pixi/world'

export function isValidWallDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

export function buildWallFromDraft(id: string, start: Point, end: Point): Wall {
  return {
    id,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    blocksLight: true,
    blocksMove: true,
    door: null,
  }
}

const LIGHT_RADIUS_IN_CELLS = 8
const DEFAULT_LIGHT_COLOR = '#ffaa33'
const DEFAULT_LIGHT_INTENSITY = 0.8

export function buildLightAt(id: string, point: Point, gridSize: number): Light {
  return {
    id,
    x: point.x,
    y: point.y,
    radius: gridSize * LIGHT_RADIUS_IN_CELLS,
    color: DEFAULT_LIGHT_COLOR,
    intensity: DEFAULT_LIGHT_INTENSITY,
  }
}

export function buildRegionFromPoints(id: string, points: RegionPoint[], tag = 'region'): Region {
  return { id, points, tag, data: {} }
}

export function isValidFreehandDraft(points: Point[]): boolean {
  return points.length >= 2
}

export function buildFreehandDrawing(id: string, points: Point[], color: string, width: number): Drawing {
  return { id, kind: 'freehand', points, color, width }
}

export function isValidLineDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

export function buildLineDrawing(id: string, start: Point, end: Point, color: string, width: number): Drawing {
  return { id, kind: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y, color, width }
}

export function isValidCircleDraft(radius: number): boolean {
  return radius > 0
}

export function buildCircleDrawing(id: string, center: Point, radius: number, color: string, width: number, filled: boolean): Drawing {
  return { id, kind: 'circle', cx: center.x, cy: center.y, radius, color, width, filled }
}
