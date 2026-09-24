/**
 * Área de clique das alças de edição, com o MESMO tamanho de tela do desenho.
 *
 * Desde que as alças passaram a ter tamanho fixo na TELA (`pixi/drawEditHandles.ts`,
 * `pixi/drawRoomHandles.ts`), a tolerância de clique também precisa ser de tela:
 * medida em px de mundo, a 0,25 o chip aparecia com 5,5 px de meio-lado enquanto
 * só 2,5 px dele pegavam o clique — o resto virava "arrastar o objeto". Aqui a
 * tolerância de sempre (a que valia com zoom 1) é lida como px de TELA e
 * convertida para px de mundo dividindo pelo zoom, como a alça de girar já fazia
 * (`lib/roomRotation.ts`).
 *
 * Os chips de canto ganham mais uma garantia: o quadrado desenhado inteiro
 * (amarelo + faixa escura) pega o clique, mesmo onde o raio circular da
 * tolerância não chega — a ponta diagonal do chip, ou a Sala pequena cuja
 * tolerância encolhe a 1/3 do lado (`findRoomCornerAt`). O que aparece é o que
 * funciona.
 *
 * Usado pelo pointerdown (`pixi/PixiCanvas.tsx`) e pelo hover
 * (`lib/hoverHitTest.ts`) — os dois têm de concordar, senão o cursor promete
 * um gesto que o clique não faz.
 */
import type { DrawingPoint, RegionPoint } from '../types/map'
import type { Point } from '../pixi/world'
import { findBoxCornerAt, boxCorners, RESIZE_HANDLE_TOLERANCE, type Box, type Corner } from './objectTransform'
import { findRoomCornerAt, ROOM_CORNER_HIT_TOLERANCE, type RoomCorner } from './roomOps'
import { findCurveControlPointAt } from './selectionHitTest'
import { cornerHandleExtent } from '../pixi/drawRoomHandles'
import { findLightRadiusHandleAt, LIGHT_RADIUS_HANDLE_TOLERANCE, type RadiusHandleTarget } from '../pixi/drawEditHandles'

/** Tolerância de vértice, ponto médio e ponta de parede/linha, em px de TELA —
 *  o mesmo valor padrão de `findCurveControlPointAt` com zoom 1. */
export const VERTEX_HANDLE_TOLERANCE = 8

/** Zoom inválido (0, negativo, NaN) vale 1 — mesma regra de `lib/roomRotation.ts`. */
function validScale(cameraScale: number): number {
  return Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
}

/** `screenPx` px de tela, em px de mundo no zoom atual. */
export function screenToWorldTolerance(screenPx: number, cameraScale: number): number {
  return screenPx / validScale(cameraScale)
}

/** Índices dos 4 cantos, na ordem de `Corner`/`RoomCorner` (0..3). */
const CORNER_INDICES = [0, 1, 2, 3] as const

/** O ponto cai dentro de algum dos 4 chips desenhados em `corners` (quadrado
 *  de meio-lado `half`, px de mundo)? Devolve o índice do primeiro. */
function cornerChipAt(corners: readonly Point[], point: Point, half: number): 0 | 1 | 2 | 3 | null {
  for (const i of CORNER_INDICES) {
    const corner = corners[i]
    if (Math.abs(point.x - corner.x) <= half && Math.abs(point.y - corner.y) <= half) return i
  }
  return null
}

function chipHalfSide(width: number, height: number, cameraScale: number): number {
  const { radius, keyline } = cornerHandleExtent(width, height, cameraScale)
  return radius + keyline
}

/**
 * Fração do menor lado que o raio de clique de um canto alcança — a mesma de
 * `CORNER_TOLERANCE_MAX_SIDE_RATIO` (`lib/roomOps.ts`) para a Sala. Com a
 * tolerância em px de tela, um Token de 50 px de mundo visto a 0,25 mede 12,5 px
 * na tela e o centro dele fica a 8,8 px de cada canto: sem este teto, os 10 px
 * de alcance engoliam o Token inteiro e ele não podia mais ser arrastado.
 */
const BOX_CORNER_REACH_MAX_SIDE_RATIO = 1 / 3

/** Canto de Drawing/Token/Prop sob o ponteiro, no zoom `cameraScale`. */
export function findBoxCornerHandleAt(box: Box, point: Point, cameraScale: number): Corner | null {
  const width = box.maxX - box.minX
  const height = box.maxY - box.minY
  const smallestSide = Math.min(width, height)
  const screenReach = screenToWorldTolerance(RESIZE_HANDLE_TOLERANCE, cameraScale)
  const reach = smallestSide > 0 ? Math.min(screenReach, smallestSide * BOX_CORNER_REACH_MAX_SIDE_RATIO) : screenReach
  const byReach = findBoxCornerAt(box, point, reach)
  if (byReach !== null) return byReach
  return cornerChipAt(boxCorners(box), point, chipHalfSide(width, height, cameraScale))
}

/** Canto de Sala retangular sob o ponteiro, no zoom `cameraScale`. */
export function findRoomCornerHandleAt(points: RegionPoint[], point: Point, cameraScale: number): RoomCorner | null {
  if (points.length !== 4) return null
  const byReach = findRoomCornerAt(points, point, screenToWorldTolerance(ROOM_CORNER_HIT_TOLERANCE, cameraScale))
  if (byReach !== null) return byReach
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const half = chipHalfSide(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), cameraScale)
  // `points` tem exatamente 4 vértices (guarda acima): os 4 índices existem.
  return cornerChipAt(points, point, half)
}

/** Vértice/ponto médio/ponta sob o ponteiro, no zoom `cameraScale`. */
export function findVertexHandleAt(points: DrawingPoint[], point: Point, cameraScale: number): number | null {
  return findCurveControlPointAt(points, point, screenToWorldTolerance(VERTEX_HANDLE_TOLERANCE, cameraScale))
}

/** Alça de raio (Luz, Drawing círculo) sob o ponteiro, no zoom `cameraScale`. */
export function isOnRadiusHandle(target: RadiusHandleTarget, point: Point, cameraScale: number): boolean {
  return findLightRadiusHandleAt(target, point, screenToWorldTolerance(LIGHT_RADIUS_HANDLE_TOLERANCE, cameraScale))
}
