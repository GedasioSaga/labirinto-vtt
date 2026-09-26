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

function blocksPassage(wall: Wall): boolean {
  return wall.blocksMove && !isDoorPassable(wall.door)
}

/**
 * Toque do traço em UMA parede, sem olhar as vizinhas: raspar a ponta conta
 * aqui como cruzar. Quem decide se a ficha passa é `findTokenPath`, que olha
 * as paredes emendadas na ponta raspada.
 */
export function moveCrossesWall(from: Point, to: Point, wall: Wall): boolean {
  if (!blocksPassage(wall)) return false
  return segmentsIntersect(from, to, { x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 })
}

/** Pontas a menos disso (px de mundo) contam como emendadas: a junta desenhada não abre fresta por arredondamento. */
const JOINT_TOLERANCE = 0.5

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/**
 * Folga do raspão, em fração da célula: o traço que corta a parede a até 1/4
 * de casa da ponta ainda conta como raspar a ponta. A ficha do jogador cai onde
 * o dedo soltou (sem encaixe no centro da casa), então exigir o pixel exato da
 * diagonal recusava quase todo gesto real.
 */
const GRAZE_CELL_FRACTION = 1 / 4
/** Nunca mais que 1/4 do comprimento da parede: o meio de um toco curto continua barrando. */
const GRAZE_WALL_FRACTION = 1 / 4

/**
 * Como o traço toca a parede: `null` não toca; `'crosses'` cruza ou encosta
 * de verdade; um Ponto = só raspa a PONTA da parede (corta a parede a até
 * `graze` px da ponta). Terminar o passo em cima da parede ou andar ao longo
 * dela continua sendo `'crosses'`.
 */
function wallContact(from: Point, to: Point, wall: Wall, graze: number): Point | 'crosses' | null {
  const a = { x: wall.x1, y: wall.y1 }
  const b = { x: wall.x2, y: wall.y2 }
  if (!segmentsIntersect(from, to, a, b)) return null
  const sideA = orientation(from, to, a)
  const sideB = orientation(from, to, b)
  // Ao longo da parede (colinear) ou começando/terminando em cima dela.
  if (sideA === sideB) return 'crosses'
  if (orientation(a, b, from) === 0 || orientation(a, b, to) === 0) return 'crosses'
  // Onde o traço corta a parede, medido a partir de `a` ao longo dela.
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const fromA = (sideA / (sideA - sideB)) * length
  const tolerance = Math.min(graze, length * GRAZE_WALL_FRACTION)
  if (fromA <= tolerance) return a
  if (length - fromA <= tolerance) return b
  return 'crosses'
}

/**
 * Pontas das paredes que saem da quina `tip`: a outra ponta de quem termina
 * ali, ou as duas de quem passa por ela.
 */
function armsAt(tip: Point, wall: Wall): Point[] {
  const a = { x: wall.x1, y: wall.y1 }
  const b = { x: wall.x2, y: wall.y2 }
  if (Math.hypot(a.x - tip.x, a.y - tip.y) <= JOINT_TOLERANCE) return [b]
  if (Math.hypot(b.x - tip.x, b.y - tip.y) <= JOINT_TOLERANCE) return [a]
  if (distanceToSegment(tip, a, b) <= JOINT_TOLERANCE) return [a, b]
  return []
}

/**
 * Raspar a quina `tip` fecha a passagem quando as paredes que saem dela ficam
 * dos DOIS lados do traço (parede que continua, canto de sala) ou uma delas
 * segue ao longo do traço. Todas de um lado só = ponta solta: a ficha passa.
 */
function tipClosesPassage(from: Point, to: Point, tip: Point, blockers: readonly Wall[]): boolean {
  let left = false
  let right = false
  for (const wall of blockers) {
    for (const arm of armsAt(tip, wall)) {
      const side = orientation(from, to, arm) - orientation(from, to, tip)
      if (side === 0) return true
      if (side > 0) left = true
      else right = true
    }
  }
  return left && right
}

/** Folga padrão (px de mundo) quando o chamador não informa a célula: 1 célula do mapa novo (64 px). */
export const DEFAULT_DOOR_SLACK = 64
/** Distância das pontas do vão até o ponto de passagem: longe da junta com o pedaço de parede vizinho. */
const DOOR_EDGE_INSET = 2

/**
 * O traço reto passa sem cruzar parede que barra. Raspar a ponta de uma
 * parede passa (a diagonal entre células vizinhas cai EXATAMENTE na quina da
 * grade, onde as paredes terminam), a menos que outra parede emendada naquela
 * quina feche o outro lado.
 */
function isPathClear(from: Point, to: Point, walls: readonly Wall[], graze: number): boolean {
  const blockers = walls.filter(blocksPassage)
  const tips: Point[] = []
  for (const wall of blockers) {
    const contact = wallContact(from, to, wall, graze)
    if (contact === 'crosses') return false
    if (contact !== null) tips.push(contact)
  }
  return !tips.some((tip) => tipClosesPassage(from, to, tip, blockers))
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
 * célula do mapa); a folga do raspão na ponta da parede sai dela também.
 */
export function findTokenPath(from: Point, to: Point, walls: readonly Wall[], doorSlack: number = DEFAULT_DOOR_SLACK): Point[] | null {
  const graze = doorSlack * GRAZE_CELL_FRACTION
  if (isPathClear(from, to, walls, graze)) return [from, to]
  for (const wall of walls) {
    if (!isDoorPassable(wall.door)) continue
    const via = doorWaypoint(from, to, wall, doorSlack)
    if (via !== null && isPathClear(from, via, walls, graze) && isPathClear(via, to, walls, graze)) return [from, via, to]
  }
  return null
}

export function resolveTokenMove(from: Point, to: Point, walls: Wall[], doorSlack: number = DEFAULT_DOOR_SLACK): Point {
  return findTokenPath(from, to, walls, doorSlack) === null ? from : to
}
