import type { Wall, Light, Region, RegionPoint, Drawing, DrawingPoint, MapData } from '../types/map'
import type { Selection } from '../types/tools'
import { findTokenAt } from '../pixi/tokenInteraction'
import { findPropAt } from '../pixi/propInteraction'

export interface Point {
  x: number
  y: number
}

const WALL_HIT_TOLERANCE = 8
export const LIGHT_HIT_RADIUS = 14

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

const DRAWING_HIT_TOLERANCE = 8

function distanceToPolyline(point: Point, points: Point[]): number {
  let min = Infinity
  for (let i = 0; i < points.length - 1; i += 1) {
    min = Math.min(min, distanceToSegment(point, points[i], points[i + 1]))
  }
  return min
}

/** Aproximação de largura de texto pra hit-test — não é medida real de glyph
 * (isso só existe depois do Pixi renderizar), é heurística: `0.55 * fontSize`
 * por caractere, suficiente pra clicar em cima do rótulo com folga. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55
}

export function findDrawingAt(drawings: Drawing[], point: Point, tolerance = DRAWING_HIT_TOLERANCE): Drawing | null {
  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const drawing = drawings[i]

    if (drawing.kind === 'text') {
      const width = estimateTextWidth(drawing.text, drawing.fontSize)
      const withinX = point.x >= drawing.x - 4 && point.x <= drawing.x + width + 4
      const withinY = point.y >= drawing.y - 4 && point.y <= drawing.y + drawing.fontSize + 4
      if (withinX && withinY) return drawing
      continue
    }

    const reach = tolerance + drawing.width / 2

    if (drawing.kind === 'freehand' || drawing.kind === 'curve') {
      if (drawing.points.length >= 2 && distanceToPolyline(point, drawing.points) <= reach) return drawing
    } else if (drawing.kind === 'line') {
      if (distanceToSegment(point, { x: drawing.x1, y: drawing.y1 }, { x: drawing.x2, y: drawing.y2 }) <= reach) return drawing
    } else {
      const distanceToCenter = Math.hypot(point.x - drawing.cx, point.y - drawing.cy)
      const hit = drawing.filled ? distanceToCenter <= drawing.radius : Math.abs(distanceToCenter - drawing.radius) <= reach
      if (hit) return drawing
    }
  }
  return null
}

const VERTEX_MAGNET_TOLERANCE = 12

/**
 * Varre todos os pontos "grudáveis" já existentes no mapa — as 2 pontas de
 * cada Wall, todo RegionPoint de cada Region, e os pontos de todo Drawing do
 * tipo 'line' (as 2 pontas) ou 'curve' (todos os pontos) — e retorna o mais
 * próximo de `point` que esteja dentro de `tolerance` pixels, ou `null` se
 * nenhum estiver perto o bastante.
 *
 * Usado pelo "ímã" de vértice ao desenhar Parede/Linha (PixiCanvas): grudar
 * no vértice exato evita ponta solta boiando perto de uma estrutura já
 * desenhada sem tocar nela de verdade. 'freehand' fica de fora de propósito —
 * um traço à mão livre não tem vértice estrutural pra conectar.
 */
export function findNearestExistingVertex(map: MapData, point: Point, tolerance = VERTEX_MAGNET_TOLERANCE): Point | null {
  let nearest: Point | null = null
  let nearestDistance = Infinity

  const consider = (candidate: Point) => {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y)
    if (distance <= tolerance && distance < nearestDistance) {
      nearestDistance = distance
      nearest = candidate
    }
  }

  for (const wall of map.walls) {
    consider({ x: wall.x1, y: wall.y1 })
    consider({ x: wall.x2, y: wall.y2 })
  }

  for (const region of map.regions) {
    for (const vertex of region.points) {
      consider(vertex)
    }
  }

  for (const drawing of map.drawings) {
    if (drawing.kind === 'line') {
      consider({ x: drawing.x1, y: drawing.y1 })
      consider({ x: drawing.x2, y: drawing.y2 })
    } else if (drawing.kind === 'curve') {
      for (const vertex of drawing.points) {
        consider(vertex)
      }
    }
  }

  return nearest
}

export function findCurveControlPointAt(points: DrawingPoint[], point: Point, handleRadius = 8): number | null {
  for (let i = 0; i < points.length; i += 1) {
    if (Math.hypot(point.x - points[i].x, point.y - points[i].y) <= handleRadius) {
      return i
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

  const drawing = findDrawingAt(map.drawings, point)
  // Só 'line' tem arrasto de corpo hoje (espelha o vértice/corpo de Parede);
  // os demais kinds (freehand/circle/curve/text) continuam não-arrastáveis
  // por enquanto — 'curve' arrasta vértice por um caminho separado, direto
  // no PixiCanvas, que não passa por este `draggable`.
  if (drawing) return { kind: 'drawing', id: drawing.id, draggable: drawing.kind === 'line' }

  const wall = findWallAt(map.walls, point)
  if (wall) return { kind: 'wall', id: wall.id, draggable: false }

  const region = findRegionAt(map.regions, point)
  if (region) return { kind: 'region', id: region.id, draggable: false }

  return null
}
