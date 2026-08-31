import type { Wall, Light, Region, RegionPoint, Drawing } from '../types/map'
import type { Point } from '../pixi/world'
import { simplifyToControlPoints } from './curveMath'

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

// radiusOverride: usado pelo arrasto da ferramenta "Luz" (PixiCanvas) — o
// usuario arrasta pra escolher o raio em vez do padrao proporcional ao grid.
// Omitido (clique simples, sem arrasto), cai no calculo de sempre.
export function buildLightAt(id: string, point: Point, gridSize: number, radiusOverride?: number): Light {
  return {
    id,
    x: point.x,
    y: point.y,
    radius: radiusOverride ?? gridSize * LIGHT_RADIUS_IN_CELLS,
    color: DEFAULT_LIGHT_COLOR,
    intensity: DEFAULT_LIGHT_INTENSITY,
  }
}

const DEFAULT_REGION_FILL_COLOR = '#3a7ad0'
const DEFAULT_REGION_FILL_PATTERN = 'solid'

export function buildRegionFromPoints(id: string, points: RegionPoint[], tag = 'region', fillColor = DEFAULT_REGION_FILL_COLOR, fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN): Region {
  return { id, points, tag, fillColor, fillPattern, data: {} }
}

export function isValidRoomDraft(start: Point, end: Point): boolean {
  return start.x !== end.x && start.y !== end.y
}

export function buildRoomFromDraft(
  regionId: string,
  wallIds: [string, string, string, string],
  start: Point,
  end: Point,
  fillColor = DEFAULT_REGION_FILL_COLOR,
  fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN,
): { region: Region; walls: Wall[] } {
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxX = Math.max(start.x, end.x)
  const maxY = Math.max(start.y, end.y)

  // Sentido horário em coordenada de tela (y cresce pra baixo): topo, direita,
  // baixo, esquerda — casa com a convenção regionEdgeIndex 0..3 do vínculo Sala.
  const points: RegionPoint[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]

  const region = buildRegionFromPoints(regionId, points, 'region', fillColor, fillPattern)

  const walls: Wall[] = wallIds.map((wallId, edgeIndex) => {
    const from = points[edgeIndex]
    const to = points[(edgeIndex + 1) % points.length]
    return {
      id: wallId,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId: region.id,
      regionEdgeIndex: edgeIndex,
    }
  })

  return { region, walls }
}

// Abaixo desse raio (em px de mundo) o arrasto conta como "clique sem
// arrastar" — evita criar um poligono degenerado (todos os pontos colados)
// por causa de jitter de sub-pixel do próprio evento de mouse.
const MIN_POLYGON_RADIUS = 1

export function isValidRegularPolygonDraft(center: Point, radiusPoint: Point): boolean {
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  return radius > MIN_POLYGON_RADIUS
}

/**
 * Poligono regular inscrito num círculo — base compartilhada por "Sala
 * Circular" (sides=24 fixo) e "Poligono Regular" (sides configurável, 3..12).
 * O primeiro vértice fica sob `radiusPoint` (ângulo inicial = ângulo de
 * `radiusPoint` em relação a `center`), os demais seguem em passos iguais de
 * 2π/sides — mesma convenção de arrasto "centro pra fora" da ferramenta
 * Círculo de desenho já existente.
 *
 * `wallIds.length` deve ser exatamente `sides`: cada parede vincula à região
 * pelo mesmo par `regionId`/`regionEdgeIndex` (0..sides-1) que `buildRoomFromDraft`
 * usa pro retângulo — é essa convenção compartilhada (ver roomLink.ts) que faz
 * toda a edição de vértice já construída pra Sala funcionar de graça aqui.
 */
export function buildRegularPolygonRoomFromDraft(
  regionId: string,
  wallIds: string[],
  center: Point,
  radiusPoint: Point,
  sides: number,
  fillColor = DEFAULT_REGION_FILL_COLOR,
  fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN,
): { region: Region; walls: Wall[] } {
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  const angle0 = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x)

  const points: RegionPoint[] = Array.from({ length: sides }, (_, i) => {
    const angle = angle0 + (i * 2 * Math.PI) / sides
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })

  const region = buildRegionFromPoints(regionId, points, 'region', fillColor, fillPattern)

  const walls: Wall[] = wallIds.map((wallId, edgeIndex) => {
    const from = points[edgeIndex]
    const to = points[(edgeIndex + 1) % points.length]
    return {
      id: wallId,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId: region.id,
      regionEdgeIndex: edgeIndex,
    }
  })

  return { region, walls }
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

export function isValidCurveDraft(points: Point[]): boolean {
  return points.length >= 2
}

export function buildCurveDrawing(id: string, rawPoints: Point[], color: string, width: number): Drawing {
  return { id, kind: 'curve', points: simplifyToControlPoints(rawPoints), color, width }
}

export function isValidTextDraft(): boolean {
  return true
}

// Mesmo default do PIXI.TextStyle (ver drawTextLabels.ts e o fallback de
// leitura em App.tsx) — mantém a aparência de rótulo já existente antes
// deste campo existir.
export const DEFAULT_TEXT_FONT_FAMILY = 'Arial'

export function buildTextDrawing(id: string, point: Point, color: string, fontSize: number, fontFamily = DEFAULT_TEXT_FONT_FAMILY): Drawing {
  return { id, kind: 'text', x: point.x, y: point.y, text: 'Rótulo', color, fontSize, fontFamily }
}
