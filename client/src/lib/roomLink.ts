import type { Region, RegionPoint, Wall } from '../types/map'

/**
 * Vínculo Sala ↔ Parede. Uma aresta `i` (de `points[i]` a `points[i+1]`) pode
 * ter NENHUMA, UMA ou VÁRIAS paredes vinculadas: a porta parte a parede em
 * pedaços colineares que continuam com o mesmo `regionEdgeIndex`
 * (`addDoorOnWall`, mapFactory.ts). Por isso toda conta aqui trata cada parede
 * pelo trecho que ela ocupa na aresta (parâmetros t0,t1 de 0 a 1), nunca
 * como "a parede da aresta".
 */

/** Folga, em px de mundo, para achar parede solta sobre aresta de Sala (migração). */
const LINK_TOLERANCE = 0.5

/** Folga do parâmetro t (0..1) para "a parede cobre a aresta inteira". */
const FULL_EDGE_EPSILON = 1e-6

/**
 * Índice da aresta anterior a `index` num polígono de `n` vértices, com wrap
 * (o caso armadilha é `index === 0`, que aponta pra última aresta, `n - 1`).
 */
export function previousEdgeIndex(index: number, n: number): number {
  return (index - 1 + n) % n
}

/** Ponto médio de cada aresta `i -> (i+1) % n` de um polígono. */
export function regionEdgeMidpoints(points: RegionPoint[]): RegionPoint[] {
  const n = points.length
  return points.map((point, i) => {
    const next = points[(i + 1) % n]
    return { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
  })
}

function lerp(a: RegionPoint, b: RegionPoint, t: number): RegionPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Parâmetro (0..1, com clamp) de `p` projetado na aresta a→b. Aresta de comprimento zero: `fallback`. */
function edgeParam(p: RegionPoint, a: RegionPoint, b: RegionPoint, fallback: number): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return fallback
  return Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
}

/** Trecho (t1, t2) que a parede ocupa na aresta a→b, na ordem x1→x2 da própria parede. */
function wallParams(wall: Wall, a: RegionPoint, b: RegionPoint): [number, number] {
  return [edgeParam({ x: wall.x1, y: wall.y1 }, a, b, 0), edgeParam({ x: wall.x2, y: wall.y2 }, a, b, 1)]
}

function samePoint(p: RegionPoint, q: RegionPoint): boolean {
  return p.x === q.x && p.y === q.y
}

/**
 * Reposiciona as paredes vinculadas a `regionId` quando os vértices da Sala
 * mudam de `oldPoints` para `newPoints` (mesmo tamanho): arrastar vértice,
 * redimensionar por canto ou por largura/altura. Cada pedaço mantém a posição
 * RELATIVA na aresta — a porta continua no mesmo ponto proporcional e com o
 * mesmo comprimento relativo. Parede de aresta que não mudou, de outro
 * `regionId` ou sem vínculo volta pela MESMA referência.
 */
export function syncLinkedWallsToPoints(
  walls: Wall[],
  regionId: string,
  oldPoints: readonly RegionPoint[],
  newPoints: readonly RegionPoint[],
): Wall[] {
  const n = oldPoints.length
  if (n !== newPoints.length || n === 0) return walls
  return walls.map((wall) => {
    if (wall.regionId !== regionId || wall.regionEdgeIndex === undefined || wall.regionEdgeIndex >= n) return wall
    const i = wall.regionEdgeIndex
    const a = oldPoints[i]
    const b = oldPoints[(i + 1) % n]
    const na = newPoints[i]
    const nb = newPoints[(i + 1) % n]
    if (samePoint(a, na) && samePoint(b, nb)) return wall
    // Arrasto ao vivo com o vértice exatamente sobre o vizinho: esmagar os
    // pedaços num ponto apagaria a posição deles. Ficam como estão (sobre a
    // última aresta boa) até o vértice sair de cima.
    if (samePoint(na, nb)) return wall
    const params = samePoint(a, b) ? paramsOnCollapsedEdge(wall, walls, regionId, i, a, na, nb, b) : wallParams(wall, a, b)
    if (params === null) return wall
    const [t1, t2] = params
    const p1 = lerp(na, nb, t1)
    const p2 = lerp(na, nb, t2)
    return { ...wall, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
  })
}

/**
 * Aresta antiga de comprimento zero (o frame anterior deixou o vértice sobre o
 * vizinho, e os pedaços ficaram na última aresta boa, ver acima). O parâmetro
 * sai da extensão dos próprios pedaços, medida a partir do vértice que NÃO se
 * mexeu (`collapsed`, onde os dois pontos antigos estão). Os dois vértices
 * mexeram, ou a aresta não tem extensão: `null` (mantém a parede).
 */
function paramsOnCollapsedEdge(
  wall: Wall,
  walls: readonly Wall[],
  regionId: string,
  edge: number,
  collapsed: RegionPoint,
  newStart: RegionPoint,
  newEnd: RegionPoint,
  oldEnd: RegionPoint,
): [number, number] | null {
  const startFixed = samePoint(newStart, collapsed)
  const endFixed = samePoint(newEnd, oldEnd)
  if (!startFixed && !endFixed) return null
  const dist = (x: number, y: number) => Math.hypot(x - collapsed.x, y - collapsed.y)
  const length = walls
    .filter((w) => w.regionId === regionId && w.regionEdgeIndex === edge)
    .reduce((max, w) => Math.max(max, dist(w.x1, w.y1), dist(w.x2, w.y2)), 0)
  if (length === 0) return null
  const t = (x: number, y: number) => (startFixed ? dist(x, y) / length : 1 - dist(x, y) / length)
  return [t(wall.x1, wall.y1), t(wall.x2, wall.y2)]
}

/**
 * Remapeia as paredes de `regionId` para a inserção de um vértice novo `p`
 * logo depois da aresta `afterEdgeIndex` (que ia de `edgeStart` a `edgeEnd`).
 * A aresta vira duas: edgeStart→p (mesmo índice) e p→edgeEnd (índice+1);
 * índices maiores andam +1. Cada pedaço da aresta vai para a metade onde está,
 * proporcionalmente (o corte fica na fração de comprimento |start→p| /
 * (|start→p| + |p→end|)). O pedaço que atravessa o corte faz SPLIT: a parte
 * do início dele mantém id e porta; a outra nasce com `newWallId`, `door: null`.
 * Aresta sem parede (buraco): só remapeia índices.
 */
export function remapForInsert(
  walls: Wall[],
  regionId: string,
  afterEdgeIndex: number,
  newWallId: string,
  newX: number,
  newY: number,
  edgeStart: RegionPoint,
  edgeEnd: RegionPoint,
): Wall[] {
  const p = { x: newX, y: newY }
  const l1 = Math.hypot(p.x - edgeStart.x, p.y - edgeStart.y)
  const l2 = Math.hypot(edgeEnd.x - p.x, edgeEnd.y - p.y)
  const ts = l1 + l2 === 0 ? 0.5 : l1 / (l1 + l2)
  // Parâmetro t da aresta antiga → ponto e índice na aresta nova.
  const place = (t: number, side: 0 | 1): RegionPoint =>
    side === 0 ? lerp(edgeStart, p, ts === 0 ? 0 : t / ts) : lerp(p, edgeEnd, ts === 1 ? 1 : (t - ts) / (1 - ts))
  const sideOf = (t: number, other: number): 0 | 1 => (t < ts || (t === ts && other < ts) ? 0 : 1)

  const out: Wall[] = []
  let usedNewId = false
  for (const wall of walls) {
    if (wall.regionId !== regionId || wall.regionEdgeIndex === undefined) {
      out.push(wall)
      continue
    }
    if (wall.regionEdgeIndex > afterEdgeIndex) {
      out.push({ ...wall, regionEdgeIndex: wall.regionEdgeIndex + 1 })
      continue
    }
    if (wall.regionEdgeIndex < afterEdgeIndex) {
      out.push(wall)
      continue
    }
    const [t1, t2] = wallParams(wall, edgeStart, edgeEnd)
    const s1 = sideOf(t1, t2)
    const s2 = sideOf(t2, t1)
    if (s1 === s2) {
      const a = place(t1, s1)
      const b = place(t2, s2)
      out.push({ ...wall, x1: a.x, y1: a.y, x2: b.x, y2: b.y, regionEdgeIndex: afterEdgeIndex + s1 })
      continue
    }
    if (wall.door !== null) {
      // Porta não se parte (metade do vão viraria parede): vai inteira para o
      // lado onde tem mais comprimento, na mesma reta.
      const side: 0 | 1 = ts - Math.min(t1, t2) >= Math.max(t1, t2) - ts ? 0 : 1
      const a = place(t1, side)
      const b = place(t2, side)
      out.push({ ...wall, x1: a.x, y1: a.y, x2: b.x, y2: b.y, regionEdgeIndex: afterEdgeIndex + side })
      continue
    }
    const a = place(t1, s1)
    const b = place(t2, s2)
    out.push({ ...wall, x1: a.x, y1: a.y, x2: p.x, y2: p.y, regionEdgeIndex: afterEdgeIndex + s1 })
    out.push({
      ...wall,
      id: usedNewId ? crypto.randomUUID() : newWallId,
      x1: p.x,
      y1: p.y,
      x2: b.x,
      y2: b.y,
      door: null,
      regionEdgeIndex: afterEdgeIndex + s2,
    })
    usedNewId = true
  }
  return out
}

/**
 * Remapeia as paredes de `regionId` para a remoção do vértice `index` (`n` é
 * o tamanho do polígono ANTES da remoção; o chamador garante `n > 3`).
 * As arestas `prev` (prevPoint→removedPoint) e `index` (removedPoint→nextPoint)
 * se fundem numa só, prevPoint→nextPoint.
 *
 * Caso simples (no máximo uma parede em cada aresta e nenhuma porta): uma
 * sobrevivente — a da aresta `prev`, ou a da `index` promovida — estica sobre
 * a aresta fundida e a outra some. Com pedaços ou porta, nada some: cada pedaço
 * vai para a aresta fundida na mesma posição proporcional (a porta fica onde
 * estava ao longo do contorno).
 */
export function remapForRemove(
  walls: Wall[],
  regionId: string,
  index: number,
  n: number,
  prevPoint: RegionPoint,
  nextPoint: RegionPoint,
  removedPoint?: RegionPoint,
): Wall[] {
  const prev = previousEdgeIndex(index, n)
  const newIndex = prev > index ? prev - 1 : prev
  const shift = (wall: Wall): Wall =>
    wall.regionEdgeIndex !== undefined && wall.regionEdgeIndex > index ? { ...wall, regionEdgeIndex: wall.regionEdgeIndex - 1 } : wall

  const prevWalls = walls.filter((wall) => wall.regionId === regionId && wall.regionEdgeIndex === prev)
  const indexWalls = walls.filter((wall) => wall.regionId === regionId && wall.regionEdgeIndex === index)
  // Simples só quando cada parede cobre a aresta inteira: um vão deixado de
  // propósito (porta apagada, pedaço 0..0,4) não pode ser fechado esticando.
  const coversEdge = (w: Wall, a: RegionPoint, b: RegionPoint) => {
    const [t1, t2] = wallParams(w, a, b)
    return Math.min(t1, t2) <= FULL_EDGE_EPSILON && Math.max(t1, t2) >= 1 - FULL_EDGE_EPSILON
  }
  const simple =
    removedPoint === undefined ||
    (prevWalls.length <= 1 &&
      indexWalls.length <= 1 &&
      [...prevWalls, ...indexWalls].every((w) => w.door === null) &&
      prevWalls.every((w) => coversEdge(w, prevPoint, removedPoint)) &&
      indexWalls.every((w) => coversEdge(w, removedPoint, nextPoint)))

  if (!simple && removedPoint !== undefined) {
    const l1 = Math.hypot(removedPoint.x - prevPoint.x, removedPoint.y - prevPoint.y)
    const l2 = Math.hypot(nextPoint.x - removedPoint.x, nextPoint.y - removedPoint.y)
    const total = l1 + l2
    const onMerged = (t: number, fromPrev: boolean): RegionPoint => {
      const s = total === 0 ? t : fromPrev ? (t * l1) / total : (l1 + t * l2) / total
      return lerp(prevPoint, nextPoint, s)
    }
    return walls.map((wall) => {
      if (wall.regionId !== regionId) return wall
      const fromPrev = wall.regionEdgeIndex === prev
      if (!fromPrev && wall.regionEdgeIndex !== index) return shift(wall)
      const [t1, t2] = fromPrev ? wallParams(wall, prevPoint, removedPoint) : wallParams(wall, removedPoint, nextPoint)
      const a = onMerged(t1, fromPrev)
      const b = onMerged(t2, fromPrev)
      return { ...wall, x1: a.x, y1: a.y, x2: b.x, y2: b.y, regionEdgeIndex: newIndex }
    })
  }

  const prevWall = prevWalls[0]
  const indexWall = indexWalls[0]
  const survivor = prevWall ?? indexWall

  return walls
    .filter((wall) => {
      if (wall.regionId !== regionId) return true
      if (wall === survivor) return true
      return wall.regionEdgeIndex !== index
    })
    .map((wall) => {
      if (wall.regionId !== regionId) return wall

      if (wall === survivor) {
        if (prevWall) return { ...wall, x2: nextPoint.x, y2: nextPoint.y, regionEdgeIndex: newIndex }
        return { ...wall, x1: prevPoint.x, y1: prevPoint.y, x2: nextPoint.x, y2: nextPoint.y, regionEdgeIndex: newIndex }
      }

      return shift(wall)
    })
}

/**
 * Desloca todas as paredes vinculadas a `regionId` por `(dx, dy)` — usado
 * quando o corpo inteiro da região é arrastado. Pega todos os pedaços da
 * aresta (porta inclusive). Paredes de outro `regionId` voltam pela mesma
 * referência (`toBe`).
 */
export function translateLinkedWalls(walls: Wall[], regionId: string, dx: number, dy: number): Wall[] {
  return walls.map((wall) =>
    wall.regionId === regionId
      ? { ...wall, x1: wall.x1 + dx, y1: wall.y1 + dy, x2: wall.x2 + dx, y2: wall.y2 + dy }
      : wall,
  )
}

function distanceToLine(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / len
}

/** Parede inteira sobre a aresta a→b: colinear e dentro do trecho, com folga. */
function wallOnEdge(wall: Wall, a: RegionPoint, b: RegionPoint): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  if (len === 0) return false
  const slack = LINK_TOLERANCE / len
  return [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }].every((p) => {
    if (distanceToLine(p, a, b) > LINK_TOLERANCE) return false
    const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)
    return t >= -slack && t <= 1 + slack
  })
}

/**
 * Migração de mapa salvo antes de a porta manter o vínculo: parede SEM
 * `regionId` inteira sobre UMA aresta de UMA Sala (tolerância 0,5 px) volta a
 * ser vinculada àquela Sala e aresta. Sobre arestas de duas Salas (parede
 * compartilhada, sala dentro de sala) ou de duas arestas: fica solta. Nada a
 * vincular devolve `walls` pela mesma referência.
 */
export function linkLooseWallsToRooms(regions: readonly Region[], walls: Wall[]): Wall[] {
  const rooms = regions.filter((r) => r.room !== undefined && r.points.length >= 3)
  if (rooms.length === 0) return walls
  let changed = false
  const out = walls.map((wall) => {
    if (wall.regionId !== undefined) return wall
    const hits: { regionId: string; edge: number }[] = []
    for (const room of rooms) {
      const n = room.points.length
      for (let i = 0; i < n; i += 1) {
        if (wallOnEdge(wall, room.points[i], room.points[(i + 1) % n])) hits.push({ regionId: room.id, edge: i })
      }
    }
    if (hits.length !== 1) return wall
    changed = true
    return { ...wall, regionId: hits[0].regionId, regionEdgeIndex: hits[0].edge }
  })
  return changed ? out : walls
}
