import type { DoorState, Wall } from '../types/map'
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

/**
 * Porta deixa passar token e visão só aberta E destrancada. Trancada sempre
 * barra, mesmo com `open: true` (mapa salvo antes da regra "aberta+trancada
 * não existe", ver `mapFactory.setWallDoor`/`setDoorLocked`).
 */
export function isDoorPassable(door: DoorState | null): boolean {
  // Porta secreta é parede até o mestre revelar: nem aberta ela deixa passar
  // (senão a ficha do jogador atravessaria uma "parede" que ele nem sabe que é porta).
  return door !== null && door.open && !door.locked && door.secret !== true
}

export function moveCrossesWall(from: Point, to: Point, wall: Wall): boolean {
  if (!wall.blocksMove) return false
  if (isDoorPassable(wall.door)) return false
  return segmentsIntersect(from, to, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 })
}

/** Folga padrão (px de mundo) quando o chamador não informa a célula: 1 célula do mapa novo (64 px). */
export const DEFAULT_DOOR_SLACK = 64
/** Distância das pontas do vão até o ponto de passagem: longe da junta com o pedaço de parede vizinho. */
const DOOR_EDGE_INSET = 2

function isPathClear(from: Point, to: Point, walls: readonly Wall[]): boolean {
  return !walls.some((wall) => moveCrossesWall(from, to, wall))
}

/**
 * Ponto de passagem pelo vão de uma porta aberta, ou `null` se o traço não
 * atravessa a linha da porta perto do vão. O traço reto do centro do token
 * que cruza a linha da parede até `slack` px além da ponta do vão (entrada em
 * diagonal, ou exatamente na junta com a parede vizinha) passa a ir até o vão
 * e de lá ao destino.
 */
function doorWaypoint(from: Point, to: Point, door: Wall, slack: number): Point | null {
  const a = { x: door.x1, y: door.y1 }
  const b = { x: door.x2, y: door.y2 }
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  if (length === 0) return null
  const sideFrom = orientation(a, b, from)
  const sideTo = orientation(a, b, to)
  // Origem e destino precisam ficar em lados opostos da linha da porta.
  if (!(sideFrom * sideTo < 0)) return null
  // Onde o traço cruza a linha da porta, medido ao longo da porta a partir de `a`.
  const t = sideFrom / (sideFrom - sideTo)
  const cross = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
  const ux = (b.x - a.x) / length
  const uy = (b.y - a.y) / length
  const along = (cross.x - a.x) * ux + (cross.y - a.y) * uy
  if (along < -slack || along > length + slack) return null
  const inset = Math.min(length / 2, DOOR_EDGE_INSET)
  const clamped = Math.max(inset, Math.min(length - inset, along))
  return { x: a.x + ux * clamped, y: a.y + uy * clamped }
}

/**
 * Trajeto do token: `[from, to]` se o traço reto está livre; `[from, vão, to]`
 * se passa pelo vão de uma porta aberta sem cruzar parede nos dois trechos;
 * `null` se bloqueado. `doorSlack` é a folga além da ponta do vão (use a
 * célula do mapa).
 */
export function findTokenPath(from: Point, to: Point, walls: readonly Wall[], doorSlack: number = DEFAULT_DOOR_SLACK): Point[] | null {
  if (isPathClear(from, to, walls)) return [from, to]
  for (const wall of walls) {
    if (!isDoorPassable(wall.door)) continue
    const via = doorWaypoint(from, to, wall, doorSlack)
    if (via !== null && isPathClear(from, via, walls) && isPathClear(via, to, walls)) return [from, via, to]
  }
  return null
}

export function resolveTokenMove(from: Point, to: Point, walls: Wall[], doorSlack: number = DEFAULT_DOOR_SLACK): Point {
  return findTokenPath(from, to, walls, doorSlack) === null ? from : to
}
