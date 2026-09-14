import type { FloorPiece, FloorShape, LayerId, MapData } from '../types/map'
import { pieceDistance } from './floorSdf'
import { isLayerLocked, isLayerVisible } from './layers'

/**
 * Ferramenta "Chão" — a parte PURA do gesto: de "pressionou aqui, soltou ali"
 * (ou "clicou nestes pontos") para a `FloorShape` que a peça guarda, mais o
 * hit-test de seleção. Fora de `pixi/PixiCanvas.tsx` pelo mesmo motivo de
 * `lib/shapeConstraint.ts`/`lib/dimensionText.ts`: testável sem Pixi nem DOM.
 */

interface Point {
  x: number
  y: number
}

/** Forma que a ferramenta cria — `poly` fica de fora: só nasce de imagem (`lib/traceImage.ts`). */
export type FloorShapeKind = 'rect' | 'ellipse' | 'polygon' | 'corridor'

/** Chão por peças mora na camada das Regiões (ver `redrawShapes` em PixiCanvas.tsx). */
export const FLOOR_LAYER: LayerId = 'salas'

/**
 * Abaixo disso (px de mundo, em qualquer eixo) o gesto conta como clique
 * parado, não arrasto — sem este piso, um clique vira uma peça de 0 px que
 * ninguém enxerga nem consegue selecionar.
 */
export const MIN_FLOOR_DRAG_SIZE = 2

export const FLOOR_POLYGON_SIDES_MIN = 3
export const FLOOR_POLYGON_SIDES_MAX = 12

export interface FloorDragResult {
  shape: FloorShape
  /** Graus; só o polígono gira (para o primeiro vértice cair sob o cursor). */
  rotation: number
}

export function clampFloorPolygonSides(sides: number): number {
  return Math.min(FLOOR_POLYGON_SIDES_MAX, Math.max(FLOOR_POLYGON_SIDES_MIN, Math.round(sides)))
}

function normalizeDegrees(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360
  // 2 casas bastam para o vértice cair sob o cursor e deixam o campo do painel legível.
  return Math.round(wrapped * 100) / 100
}

/**
 * Retângulo: de canto a canto (mesmo gesto da Sala e do Retângulo).
 * Elipse e polígono: centro no `start`, borda no `end` (mesmo gesto da Elipse
 * e do Polígono Regular). `null` = arrasto pequeno demais para virar peça.
 */
export function buildFloorShapeFromDrag(
  kind: Exclude<FloorShapeKind, 'corridor'>,
  start: Point,
  end: Point,
  sides: number,
): FloorDragResult | null {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (kind === 'rect') {
    const w = Math.abs(dx)
    const h = Math.abs(dy)
    if (w < MIN_FLOOR_DRAG_SIZE || h < MIN_FLOOR_DRAG_SIZE) return null
    return { shape: { kind: 'rect', cx: (start.x + end.x) / 2, cy: (start.y + end.y) / 2, w, h }, rotation: 0 }
  }

  if (kind === 'ellipse') {
    const rx = Math.abs(dx)
    const ry = Math.abs(dy)
    if (rx < MIN_FLOOR_DRAG_SIZE || ry < MIN_FLOOR_DRAG_SIZE) return null
    return { shape: { kind: 'ellipse', cx: start.x, cy: start.y, rx, ry }, rotation: 0 }
  }

  const radius = Math.hypot(dx, dy)
  if (radius < MIN_FLOOR_DRAG_SIZE) return null
  // O motor desenha o primeiro vértice para cima (-90°, `regularPolygonVertices`);
  // girar por ângulo+90 põe esse vértice sob o cursor, igual ao Polígono Regular.
  const rotation = normalizeDegrees((Math.atan2(dy, dx) * 180) / Math.PI + 90)
  return {
    shape: { kind: 'polygon', cx: start.x, cy: start.y, radius, sides: clampFloorPolygonSides(sides) },
    rotation,
  }
}

/**
 * Corredor a partir dos cliques. Duplo clique entrega o último ponto duas
 * vezes (dois pointerdown antes do dblclick) — repetição consecutiva é
 * descartada. Menos de 2 pontos distintos não é corredor.
 */
export function buildCorridorShape(points: readonly Point[], width: number): FloorShape | null {
  if (!(width > 0)) return null
  const distinct: Point[] = []
  for (const point of points) {
    const last = distinct[distinct.length - 1]
    if (!last || last.x !== point.x || last.y !== point.y) distinct.push(point)
  }
  if (distinct.length < 2) return null
  return { kind: 'corridor', points: distinct.map((p) => ({ x: p.x, y: p.y, width })) }
}

export function buildFloorPiece(id: string, shape: FloorShape, op: FloorPiece['op'], rotation = 0): FloorPiece {
  // `rotation` ausente === 0 (types/map.ts) — não grava o campo à toa.
  return rotation === 0 ? { id, shape, op, modifiers: {} } : { id, shape, op, rotation, modifiers: {} }
}

/**
 * Peça sob o ponto: a MAIS RECENTE (fim da lista) cujo interior contém o
 * ponto — é a que foi aplicada por último, logo a que o usuário vê "por
 * cima". Uma peça 'subtract' é achada dentro do próprio buraco, que é o
 * único lugar onde dá para clicar nela. Camada 'salas' oculta ou travada, e
 * peça `hidden`/`locked`, não são selecionáveis — mesma regra de
 * `hitTestMap` em PixiCanvas.tsx para as outras entidades.
 */
export function findFloorPieceAt(map: Pick<MapData, 'floor' | 'hiddenLayers' | 'lockedLayers'>, point: Point): FloorPiece | null {
  if (!isLayerVisible(map.hiddenLayers, FLOOR_LAYER) || isLayerLocked(map.lockedLayers, FLOOR_LAYER)) return null
  for (let i = map.floor.length - 1; i >= 0; i -= 1) {
    const piece = map.floor[i]
    if (piece.hidden || piece.locked) continue
    if (pieceDistance(piece, point.x, point.y) < 0) return piece
  }
  return null
}
