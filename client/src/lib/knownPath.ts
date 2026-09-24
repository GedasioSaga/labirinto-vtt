import type { MapData, RegionPoint, Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { isDoorPassable, segmentsIntersect } from './collision'
import { isPointExplored, type Exploration } from './exploration'
import { compileFloor } from './floorSdf'
import { pointInRing } from './floorContour'

/**
 * ANDAR ATÉ AQUI: o caminho da ficha do jogador até um ponto, dobrando as
 * esquinas, usando SÓ o que a tela dele já tem — a memória explorada e a
 * visão de agora, tirando as zonas ocultas do mestre. Nada vem do host para
 * isto: o que a névoa esconde não entra no cálculo, então nunca vira atalho
 * (se a única rua passa pelo escuro, não há caminho).
 *
 * O host continua sendo a autoridade: cada trecho devolvido aqui sai como um
 * `token.move` comum, validado sozinho (`validateTokenMove`). Por isso cada
 * trecho segue as mesmas regras de lá — não cruza parede (porta aberta e
 * destrancada deixa passar) e fica no chão, amostrado no mesmo passo.
 */

export interface KnownArea {
  /** Memória do que o jogador já viu; ausente = só a visão de agora. */
  explored: Exploration | undefined
  /** Anéis da visão de agora. */
  vision: readonly RegionPoint[][]
  /** Zonas ocultas ativas: escuro, mesmo que já exploradas. */
  concealed: readonly RegionPoint[][]
}

type PathMap = Pick<MapData, 'width' | 'height' | 'grid' | 'walls' | 'floor'>

/** Nós do caminho a cada meia célula: corredor de uma célula tem nó no meio, fora da linha da parede. */
const NODES_PER_GRID = 2
/** Passo mínimo entre nós, em px de mundo (grade inválida ou minúscula). */
const MIN_NODE_STEP = 8
/** Teto de nós da busca: mapa gigante engrossa o passo em vez de travar a tela. */
const MAX_NODES = 250_000
/** Amostras do trecho por célula da grade: o mesmo passo com que o host confere o chão. */
const SAMPLES_PER_GRID = 4
/** Teto de amostras de um trecho, como no host (`MAX_PATH_SAMPLES`). */
const MAX_SEGMENT_SAMPLES = 10_000
/** Vizinhos: 4 retos e 4 diagonais. */
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
/** Distância (em passos de nó) para ligar a origem e o destino, que não caem no centro de um nó. */
const LINK_RADIUS_STEPS = 1.5

function inRings(point: RegionPoint, rings: readonly RegionPoint[][]): boolean {
  return rings.some((ring) => ring.length >= 3 && pointInRing(point, ring))
}

/** O jogador conhece o ponto: está na visão de agora ou na memória, e fora de zona oculta. */
export function isPointKnown(area: KnownArea, point: RegionPoint): boolean {
  if (inRings(point, area.concealed)) return false
  if (inRings(point, area.vision)) return true
  return area.explored !== undefined && isPointExplored(area.explored, point)
}

/** Paredes que barram a ficha agora, com a caixa pronta para descartar rápido. */
interface Barrier {
  a: Point
  b: Point
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function barriersOf(walls: readonly Wall[]): Barrier[] {
  return walls
    .filter((w) => w.blocksMove && !isDoorPassable(w.door))
    .map((w) => ({
      a: { x: w.x1, y: w.y1 },
      b: { x: w.x2, y: w.y2 },
      minX: Math.min(w.x1, w.x2),
      minY: Math.min(w.y1, w.y2),
      maxX: Math.max(w.x1, w.x2),
      maxY: Math.max(w.y1, w.y2),
    }))
}

/** Tudo que a busca consulta, montado uma vez por pedido. */
interface Terrain {
  width: number
  height: number
  sampleStep: number
  barriers: Barrier[]
  onFloor: (x: number, y: number) => boolean
  area: KnownArea
}

function createTerrain(map: PathMap, area: KnownArea): Terrain {
  const compiled = compileFloor(map.floor)
  const grid = Number.isFinite(map.grid) && map.grid > 0 ? map.grid : MIN_NODE_STEP
  return {
    width: map.width * grid,
    height: map.height * grid,
    sampleStep: Math.max(grid / SAMPLES_PER_GRID, 1),
    barriers: barriersOf(map.walls),
    // Sem peça de chão visível não há chão para restringir (mesma regra do host).
    onFloor: (x, y) => compiled.bounds === null || compiled.sample(x, y) <= 0,
    area,
  }
}

function insideMap(t: Terrain, p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= t.width && p.y <= t.height
}

/** Lugar onde a ficha pode estar: dentro do mapa, no chão e conhecido. */
function isStandable(t: Terrain, p: Point): boolean {
  return insideMap(t, p) && t.onFloor(p.x, p.y) && isPointKnown(t.area, p)
}

function crossesBarrier(t: Terrain, a: Point, b: Point): boolean {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x, b.x)
  const maxY = Math.max(a.y, b.y)
  return t.barriers.some((w) => w.maxX >= minX && w.minX <= maxX && w.maxY >= minY && w.minY <= maxY && segmentsIntersect(a, b, w.a, w.b))
}

/**
 * Trecho que o host aceita e que o jogador conhece: não cruza parede e toda
 * amostra (pontas incluídas, menos a origem, onde a ficha já está) fica no
 * chão conhecido.
 */
function isLegWalkable(t: Terrain, a: Point, b: Point): boolean {
  if (crossesBarrier(t, a, b)) return false
  const wanted = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / t.sampleStep)
  const samples = Math.min(MAX_SEGMENT_SAMPLES, Math.max(1, wanted))
  for (let i = 1; i <= samples; i += 1) {
    const s = i / samples
    if (!isStandable(t, { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s })) return false
  }
  return true
}

/** Fila de prioridade mínima (heap binário) de índices de nó por custo estimado. */
class MinHeap {
  private readonly items: number[] = []
  private readonly keys: number[] = []

  get size(): number {
    return this.items.length
  }

  push(item: number, key: number): void {
    this.items.push(item)
    this.keys.push(key)
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.key(parent) <= key) break
      this.swap(i, parent)
      i = parent
    }
  }

  /** Índice de menor custo; -1 se vazia. */
  pop(): number {
    const top = this.items[0]
    if (top === undefined) return -1
    const lastItem = this.items.pop()
    const lastKey = this.keys.pop()
    if (this.items.length > 0 && lastItem !== undefined && lastKey !== undefined) {
      this.items[0] = lastItem
      this.keys[0] = lastKey
      this.siftDown()
    }
    return top
  }

  private key(i: number): number {
    return this.keys[i] ?? Number.POSITIVE_INFINITY
  }

  private swap(i: number, j: number): void {
    const item = this.items[i]
    const key = this.keys[i]
    const otherItem = this.items[j]
    const otherKey = this.keys[j]
    if (item === undefined || key === undefined || otherItem === undefined || otherKey === undefined) return
    this.items[i] = otherItem
    this.keys[i] = otherKey
    this.items[j] = item
    this.keys[j] = key
  }

  private siftDown(): void {
    let i = 0
    for (;;) {
      const left = i * 2 + 1
      const right = left + 1
      let smallest = i
      if (left < this.items.length && this.key(left) < this.key(smallest)) smallest = left
      if (right < this.items.length && this.key(right) < this.key(smallest)) smallest = right
      if (smallest === i) return
      this.swap(i, smallest)
      i = smallest
    }
  }
}

interface NodeGrid {
  step: number
  cols: number
  rows: number
}

function nodeGrid(t: Terrain, grid: number): NodeGrid {
  let step = Math.max(MIN_NODE_STEP, grid / NODES_PER_GRID)
  while (Math.ceil(t.width / step) * Math.ceil(t.height / step) > MAX_NODES) step *= 2
  return { step, cols: Math.max(1, Math.ceil(t.width / step)), rows: Math.max(1, Math.ceil(t.height / step)) }
}

function nodeCenter(g: NodeGrid, index: number): Point {
  const col = index % g.cols
  const row = Math.floor(index / g.cols)
  return { x: (col + 0.5) * g.step, y: (row + 0.5) * g.step }
}

/** Nós perto de `p` (até `LINK_RADIUS_STEPS` passos) ligados a ele por um trecho andável. */
function linkedNodes(t: Terrain, g: NodeGrid, p: Point, walkable: (i: number) => boolean, fromNode: boolean): number[] {
  const col = Math.floor(p.x / g.step)
  const row = Math.floor(p.y / g.step)
  const reach = g.step * LINK_RADIUS_STEPS
  const found: number[] = []
  for (let dr = -2; dr <= 2; dr += 1) {
    for (let dc = -2; dc <= 2; dc += 1) {
      const c = col + dc
      const r = row + dr
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue
      const index = r * g.cols + c
      if (!walkable(index)) continue
      const center = nodeCenter(g, index)
      if (Math.hypot(center.x - p.x, center.y - p.y) > reach) continue
      if (fromNode ? isLegWalkable(t, center, p) : isLegWalkable(t, p, center)) found.push(index)
    }
  }
  return found
}

/**
 * A* nos nós de meia célula, da origem ao destino. Devolve a sequência de
 * pontos (origem e destino incluídos) ou `null`.
 */
function searchNodes(t: Terrain, g: NodeGrid, from: Point, to: Point): Point[] | null {
  const total = g.cols * g.rows
  // 0 = não visto, 1 = andável, 2 = bloqueado.
  const standable = new Uint8Array(total)
  const walkable = (i: number): boolean => {
    if (standable[i] === 0) standable[i] = isStandable(t, nodeCenter(g, i)) ? 1 : 2
    return standable[i] === 1
  }
  const goals = new Set(linkedNodes(t, g, to, walkable, true))
  if (goals.size === 0) return null

  const cost = new Float64Array(total).fill(Number.POSITIVE_INFINITY)
  const cameFrom = new Int32Array(total).fill(-1)
  const closed = new Uint8Array(total)
  const heap = new MinHeap()
  const estimate = (p: Point) => Math.hypot(to.x - p.x, to.y - p.y)
  for (const start of linkedNodes(t, g, from, walkable, false)) {
    const center = nodeCenter(g, start)
    const g0 = Math.hypot(center.x - from.x, center.y - from.y)
    if (g0 >= (cost[start] ?? Number.POSITIVE_INFINITY)) continue
    cost[start] = g0
    heap.push(start, g0 + estimate(center))
  }

  while (heap.size > 0) {
    const current = heap.pop()
    if (current < 0 || closed[current] === 1) continue
    closed[current] = 1
    if (goals.has(current)) return tracePath(g, cameFrom, current, from, to)
    const here = nodeCenter(g, current)
    const col = current % g.cols
    const row = Math.floor(current / g.cols)
    const base = cost[current] ?? Number.POSITIVE_INFINITY
    for (const [dc, dr] of NEIGHBORS) {
      const c = col + dc
      const r = row + dr
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue
      const next = r * g.cols + c
      if (closed[next] === 1 || !walkable(next)) continue
      const there = nodeCenter(g, next)
      if (crossesBarrier(t, here, there)) continue
      const tentative = base + Math.hypot(dc, dr) * g.step
      if (tentative >= (cost[next] ?? Number.POSITIVE_INFINITY)) continue
      cost[next] = tentative
      cameFrom[next] = current
      heap.push(next, tentative + estimate(there))
    }
  }
  return null
}

function tracePath(g: NodeGrid, cameFrom: Int32Array, end: number, from: Point, to: Point): Point[] {
  const nodes: Point[] = []
  for (let i = end; i >= 0; i = cameFrom[i] ?? -1) nodes.push(nodeCenter(g, i))
  nodes.reverse()
  return [from, ...nodes, to]
}

/**
 * Puxa o barbante: de cada esquina, vai direto ao ponto mais adiante que um
 * trecho andável alcança. Sobram só as esquinas de verdade.
 */
function straighten(t: Terrain, points: readonly Point[]): Point[] {
  const legs: Point[] = []
  let anchor = points[0]
  let i = 1
  while (anchor !== undefined && i < points.length) {
    let reach = i
    for (let j = i + 1; j < points.length; j += 1) {
      const candidate = points[j]
      if (candidate === undefined || !isLegWalkable(t, anchor, candidate)) break
      reach = j
    }
    const corner = points[reach]
    if (corner === undefined) break
    legs.push(corner)
    anchor = corner
    i = reach + 1
  }
  return legs
}

/**
 * Trechos de `from` até `to` pelo que o jogador conhece: cada ponto devolvido
 * é o fim de um trecho reto (o último é `to`). `null` quando o destino está no
 * escuro, fora do chão, ou nenhum caminho conhecido chega lá.
 */
export function findKnownPath(map: PathMap, from: Point, target: Point, area: KnownArea): Point[] | null {
  if (![from.x, from.y, target.x, target.y].every(Number.isFinite)) return null
  // O pedido ao host sai em px inteiros (como o arrasto): o caminho é conferido já arredondado.
  const to = roundPoint(target)
  const terrain = createTerrain(map, area)
  if (!isStandable(terrain, to)) return null
  if (isLegWalkable(terrain, from, to)) return [to]
  const grid = Number.isFinite(map.grid) && map.grid > 0 ? map.grid : MIN_NODE_STEP
  const nodes = searchNodes(terrain, nodeGrid(terrain, grid), from, to)
  if (nodes === null) return null
  const [origin, ...rest] = nodes
  if (origin === undefined) return null
  return straighten(terrain, [origin, ...rest.map(roundPoint)])
}

function roundPoint(p: Point): Point {
  return { x: Math.round(p.x), y: Math.round(p.y) }
}
