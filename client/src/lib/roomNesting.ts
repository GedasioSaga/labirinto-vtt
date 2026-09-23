import type { Region, RegionPoint, Wall } from '../types/map'

/**
 * Salas dentro de sala (quarto dentro da casa). Lib pura, sem Pixi nem store:
 * a hierarquia mora em `Region.parentId` (`types/map.ts`) e o array
 * `map.regions` guarda a ordem de desenho (último por cima, e
 * `findRegionAt` dá o clique para o último). Por isso a filha entra logo
 * depois da subárvore da mãe (`insertIndexAfterSubtree`).
 */

/** Folga, em px de mundo, para "ponto na borda" e "aresta sobre a parede". */
export const NESTING_TOLERANCE = 0.5

function distanceToSegment(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Ponto sobre alguma aresta do polígono (com folga).
 *
 * EXPORTADO para o TETO DE CONSTRUÇÃO (`lib/fogFilter.ts`): "está dentro do
 * prédio" e "é o contorno do prédio" são perguntas diferentes, e a segunda é a
 * única que separa a divisória interna encostada no muro (que tem de sumir do
 * pacote do jogador) da parede do muro em si (que é a silhueta e tem de ficar).
 */
export function pointOnPolygonBorder(point: RegionPoint, polygon: readonly RegionPoint[], tolerance = NESTING_TOLERANCE): boolean {
  const n = polygon.length
  for (let i = 0; i < n; i += 1) {
    if (distanceToSegment(point, polygon[i], polygon[(i + 1) % n]) <= tolerance) return true
  }
  return false
}

/** Ponto dentro do polígono; ponto sobre a borda (com folga) conta como dentro. */
export function pointInPolygonInclusive(point: RegionPoint, polygon: readonly RegionPoint[], tolerance = NESTING_TOLERANCE): boolean {
  const n = polygon.length
  if (n < 3) return false
  if (pointOnPolygonBorder(point, polygon, tolerance)) return true
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Mãe que existe no mapa; `parentId` órfão conta como sala de topo. */
function parentOf(regions: readonly Region[], region: Region): Region | undefined {
  return region.parentId === undefined ? undefined : regions.find((r) => r.id === region.parentId)
}

/** Ancestrais do mais perto ao mais longe. Para em ciclo (arquivo corrompido). */
export function ancestorsOf(regions: readonly Region[], id: string): Region[] {
  const out: Region[] = []
  const seen = new Set<string>([id])
  let current = regions.find((r) => r.id === id)
  while (current) {
    const parent = parentOf(regions, current)
    if (!parent || seen.has(parent.id)) break
    seen.add(parent.id)
    out.push(parent)
    current = parent
  }
  return out
}

/** Todos os descendentes (filhas, netas…), na ordem do array. Não inclui a própria. */
export function descendantsOf(regions: readonly Region[], id: string): Region[] {
  const ids = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const r of regions) {
      if (!ids.has(r.id) && r.parentId !== undefined && ids.has(r.parentId)) {
        ids.add(r.id)
        grew = true
      }
    }
  }
  ids.delete(id)
  return regions.filter((r) => ids.has(r.id))
}

/** Id da sala e de toda a subárvore dela. */
export function subtreeIds(regions: readonly Region[], id: string): Set<string> {
  return new Set([id, ...descendantsOf(regions, id).map((r) => r.id)])
}

/**
 * Sala mais funda cujo polígono contém todos os `points` (borda conta como
 * dentro). Só Salas (`room` definido) viram mãe. Empate de profundidade: a que
 * está mais por cima (maior índice), igual ao clique.
 */
export function findContainingRoom(regions: readonly Region[], points: readonly RegionPoint[]): Region | null {
  if (points.length === 0) return null
  let best: Region | null = null
  let bestDepth = -1
  for (const region of regions) {
    if (region.room === undefined || region.points.length < 3) continue
    if (!points.every((p) => pointInPolygonInclusive(p, region.points))) continue
    const depth = ancestorsOf(regions, region.id).length
    if (depth >= bestDepth) {
      best = region
      bestDepth = depth
    }
  }
  return best
}

/** Índice logo depois da última sala da subárvore de `parentId` (fim do array se a mãe não existe). */
export function insertIndexAfterSubtree(regions: readonly Region[], parentId: string): number {
  const ids = subtreeIds(regions, parentId)
  let last = -1
  regions.forEach((r, i) => {
    if (ids.has(r.id)) last = i
  })
  return last === -1 ? regions.length : last + 1
}

/**
 * Arestas da filha (índice `i` = de `points[i]` a `points[i+1]`) que ficam
 * inteiras sobre paredes da mãe: colineares e cobertas pela união das paredes
 * (a parede da mãe pode estar partida por porta). Essas arestas não ganham
 * parede própria, senão a linha fica dupla. Cobertura parcial gera parede.
 */
export function edgesOnParentWalls(childPoints: readonly RegionPoint[], parentWalls: readonly Wall[], tolerance = NESTING_TOLERANCE): Set<number> {
  const out = new Set<number>()
  const n = childPoints.length
  for (let i = 0; i < n; i += 1) {
    const a = childPoints[i]
    const b = childPoints[(i + 1) % n]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len === 0) continue
    const intervals: [number, number][] = []
    for (const w of parentWalls) {
      const p1 = { x: w.x1, y: w.y1 }
      const p2 = { x: w.x2, y: w.y2 }
      if (distanceToLine(p1, a, b) > tolerance || distanceToLine(p2, a, b) > tolerance) continue
      const t1 = projectParam(p1, a, b, len)
      const t2 = projectParam(p2, a, b, len)
      intervals.push([Math.min(t1, t2), Math.max(t1, t2)])
    }
    if (coversUnit(intervals, tolerance / len)) out.add(i)
  }
  return out
}

/**
 * Arestas de `points` que já estão sobre parede de `parent`: toda parede
 * vinculada a ela (pedaços de porta inclusive) e toda parede solta sobre a
 * borda dela (mapa antigo). Essas arestas não ganham parede própria.
 */
export function edgesCoveredByParent(points: readonly RegionPoint[], walls: readonly Wall[], parent: Region): Set<number> {
  const onParentBorder = (w: Wall) =>
    w.regionId === parent.id ||
    (w.regionId === undefined &&
      pointOnPolygonBorder({ x: w.x1, y: w.y1 }, parent.points) &&
      pointOnPolygonBorder({ x: w.x2, y: w.y2 }, parent.points))
  return edgesOnParentWalls(points, walls.filter(onParentBorder))
}

export interface NestedRoomPlacement {
  region: Region
  walls: Wall[]
  /** "Criar sala dentro" armado, mas a sala ficou fora dessa mãe (vira sala normal ou filha de outra). */
  missedParent: Region | null
}

/**
 * Decide onde entra a Sala recém-desenhada. Com `pendingParentId` (botão "Criar
 * sala dentro") a mãe é essa sala, se a nova couber nela; senão vale a
 * contenção automática (sala mais funda que contém todos os vértices). Achou
 * mãe: `parentId`, a cor da mãe e sem parede nas arestas que já estão sobre
 * parede da mãe (e sem porta duplicada).
 */
export function placeNewRoom(
  regions: readonly Region[],
  walls: readonly Wall[],
  draft: { region: Region; walls: Wall[] },
  pendingParentId: string | null,
): NestedRoomPlacement {
  const points = draft.region.points
  const pending = pendingParentId === null ? undefined : regions.find((r) => r.id === pendingParentId && r.room !== undefined)
  const pendingFits = pending !== undefined && points.every((p) => pointInPolygonInclusive(p, pending.points))
  const parent = pendingFits ? pending : findContainingRoom(regions, points)
  const missedParent = pending !== undefined && !pendingFits ? pending : null
  if (!parent) return { region: draft.region, walls: draft.walls, missedParent }
  const skip = edgesCoveredByParent(points, walls, parent)
  return {
    region: { ...draft.region, parentId: parent.id, fillColor: parent.fillColor },
    walls: draft.walls.filter((w) => w.regionEdgeIndex === undefined || !skip.has(w.regionEdgeIndex)),
    missedParent,
  }
}

function distanceToLine(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / Math.hypot(dx, dy)
}

function projectParam(p: RegionPoint, a: RegionPoint, b: RegionPoint, len: number): number {
  return ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)
}

function coversUnit(intervals: [number, number][], slack: number): boolean {
  const sorted = [...intervals].sort((x, y) => x[0] - y[0])
  let reach = 0
  for (const [start, end] of sorted) {
    if (start > reach + slack) return false
    reach = Math.max(reach, end)
    if (reach >= 1 - slack) return true
  }
  return false
}
