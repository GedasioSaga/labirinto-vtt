import type { FloorPiece, MapData, RegionPoint } from '../types/map'
import { buildFloorOutline } from './floorContour'
import { simplifyRing } from './refineFloor'

/**
 * Polígono de visão (modo jogador): varredura angular clássica. Um raio é
 * lançado para cada extremidade de segmento e ligeiramente antes/depois dela
 * (para "escorregar" pela quina e achar o que está atrás), mais raios
 * uniformes que desenham o círculo de alcance. Cada raio para no segmento
 * mais próximo ou no raio de visão, o que vier antes.
 */

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Desvio angular dos raios auxiliares em volta de cada extremidade, em radianos. */
const ENDPOINT_ANGLE_OFFSET = 1e-4
/** Raios uniformes que aproximam o arco do círculo de alcance. */
const CIRCLE_RAYS = 64
/** Abaixo disto o raio é tratado como paralelo ao segmento. */
const PARALLEL_EPSILON = 1e-12
/** Intersecção colada na origem é ignorada: token em cima de uma linha não fica cego. */
const MIN_HIT_DISTANCE = 1e-6
/** Desvio máximo da simplificação do contorno do chão, em px de mundo. */
const FLOOR_SIMPLIFY_TOLERANCE = 1.0

function distanceToSegment(px: number, py: number, s: Segment): number {
  const ex = s.x2 - s.x1
  const ey = s.y2 - s.y1
  const lengthSq = ex * ex + ey * ey
  const t = lengthSq > 0 ? Math.min(1, Math.max(0, ((px - s.x1) * ex + (py - s.y1) * ey) / lengthSq)) : 0
  return Math.hypot(px - (s.x1 + ex * t), py - (s.y1 + ey * t))
}

const TWO_PI = Math.PI * 2
/**
 * Folga do arco angular de cada segmento. Só amplia o conjunto de raios
 * testados (nunca muda o resultado); cobre o erro de ponto flutuante do
 * atan2 e do teste u ∈ [0, 1] na quina, que fica ordens abaixo disto
 * enquanto a distância origem-segmento passar de NEAR_ORIGIN_DISTANCE.
 */
const SPAN_MARGIN = 1e-6
/** Segmento colado na origem subtende arco mal-condicionado: testa contra todos os raios. */
const NEAR_ORIGIN_DISTANCE = 1e-3
/** Arco acima disto (quase π) tem sinal instável: também testa contra todos os raios. */
const MAX_TRUSTED_SPAN = 3

/** Primeiro índice de `sorted` com valor >= `value`. */
function lowerBound(sorted: Float64Array, length: number, value: number): number {
  let lo = 0
  let hi = length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Invariante de performance: em vez de lançar cada raio contra todos os
 * segmentos (O(raios × segmentos)), cada segmento é testado só contra os raios
 * dentro do arco angular que ele cobre visto da origem. Um raio que acerta o
 * segmento com t > 0 necessariamente aponta para dentro desse arco, então a
 * poda é conservadora. A conta de intersecção é a mesma da varredura ingênua
 * e o mínimo não depende da ordem dos testes: o polígono sai idêntico.
 */
export function computeVisibility(origin: RegionPoint, segments: Segment[], radius: number): RegionPoint[] {
  if (radius <= 0) return []
  const ox = origin.x
  const oy = origin.y

  // Segmentos próximos empacotados em arrays tipados: x1, y1, ex, ey.
  const segData = new Float64Array(segments.length * 4)
  const spanLo = new Float64Array(segments.length)
  const spanHi = new Float64Array(segments.length)
  const angles = new Float64Array(CIRCLE_RAYS + segments.length * 6)
  let rayCount = 0
  for (let i = 0; i < CIRCLE_RAYS; i += 1) angles[rayCount++] = (i / CIRCLE_RAYS) * Math.PI * 2 - Math.PI

  let nearCount = 0
  for (const s of segments) {
    // Segmento inteiro fora do alcance nunca corta um raio antes de `radius`.
    const distance = distanceToSegment(ox, oy, s)
    if (!(distance <= radius)) continue
    const a1 = Math.atan2(s.y1 - oy, s.x1 - ox)
    const a2 = Math.atan2(s.y2 - oy, s.x2 - ox)
    angles[rayCount++] = a1 - ENDPOINT_ANGLE_OFFSET
    angles[rayCount++] = a1
    angles[rayCount++] = a1 + ENDPOINT_ANGLE_OFFSET
    angles[rayCount++] = a2 - ENDPOINT_ANGLE_OFFSET
    angles[rayCount++] = a2
    angles[rayCount++] = a2 + ENDPOINT_ANGLE_OFFSET

    const base = nearCount * 4
    segData[base] = s.x1
    segData[base + 1] = s.y1
    segData[base + 2] = s.x2 - s.x1
    segData[base + 3] = s.y2 - s.y1

    let delta = a2 - a1
    if (delta > Math.PI) delta -= TWO_PI
    else if (delta < -Math.PI) delta += TWO_PI
    if (distance < NEAR_ORIGIN_DISTANCE || Math.abs(delta) > MAX_TRUSTED_SPAN) {
      spanLo[nearCount] = Number.NEGATIVE_INFINITY
      spanHi[nearCount] = Number.POSITIVE_INFINITY
    } else {
      const lo = delta >= 0 ? a1 : a1 + delta
      spanLo[nearCount] = lo - SPAN_MARGIN
      spanHi[nearCount] = lo + Math.abs(delta) + SPAN_MARGIN
    }
    nearCount += 1
  }

  const sorted = angles.subarray(0, rayCount).sort()
  const dirX = new Float64Array(rayCount)
  const dirY = new Float64Array(rayCount)
  const nearest = new Float64Array(rayCount).fill(radius)
  for (let r = 0; r < rayCount; r += 1) {
    dirX[r] = Math.cos(sorted[r])
    dirY[r] = Math.sin(sorted[r])
  }
  const minAngle = sorted[0]
  const maxAngle = sorted[rayCount - 1]

  for (let j = 0; j < nearCount; j += 1) {
    const base = j * 4
    const sx = segData[base]
    const sy = segData[base + 1]
    const ex = segData[base + 2]
    const ey = segData[base + 3]
    const wx = sx - ox
    const wy = sy - oy
    const tNumerator = wx * ey - wy * ex
    const lo = spanLo[j]
    const hi = spanHi[j]
    // Ângulos vão de -π-offset a π+offset: o arco é procurado também deslocado de ±2π.
    for (let shift = -TWO_PI; shift <= TWO_PI; shift += TWO_PI) {
      const from = lo + shift
      const to = hi + shift
      if (to < minAngle || from > maxAngle) continue
      for (let r = from === Number.NEGATIVE_INFINITY ? 0 : lowerBound(sorted, rayCount, from); r < rayCount && sorted[r] <= to; r += 1) {
        const dx = dirX[r]
        const dy = dirY[r]
        const denom = dx * ey - dy * ex
        if (Math.abs(denom) < PARALLEL_EPSILON) continue
        const t = tNumerator / denom
        if (t < MIN_HIT_DISTANCE || t >= nearest[r]) continue
        const u = (wx * dy - wy * dx) / denom
        if (u >= 0 && u <= 1) nearest[r] = t
      }
      if (from === Number.NEGATIVE_INFINITY) break // arco total: já cobriu todos os raios
    }
  }

  const polygon: RegionPoint[] = new Array(rayCount)
  for (let r = 0; r < rayCount; r += 1) {
    polygon[r] = { x: ox + dirX[r] * nearest[r], y: oy + dirY[r] * nearest[r] }
  }
  return polygon
}

function ringToSegments(ring: RegionPoint[]): Segment[] {
  const out: Segment[] = []
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  }
  return out
}

/** Contorno do chão é caro (marching squares): cacheado pela referência do array imutável `map.floor`. */
const floorSegmentsCache = new WeakMap<FloorPiece[], Segment[]>()

function floorSegments(floor: FloorPiece[]): Segment[] {
  const cached = floorSegmentsCache.get(floor)
  if (cached) return cached
  const segments: Segment[] = []
  for (const polygon of buildFloorOutline(floor)) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      segments.push(...ringToSegments(simplifyRing(ring, FLOOR_SIMPLIFY_TOLERANCE)))
    }
  }
  floorSegmentsCache.set(floor, segments)
  return segments
}

/** Obstáculos de visão: paredes que bloqueiam luz (porta aberta não bloqueia) + borda do chão. */
export function visionSegments(map: MapData): Segment[] {
  const walls = map.walls
    .filter((w) => w.blocksLight && !w.door?.open)
    .map((w) => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }))
  return [...walls, ...floorSegments(map.floor)]
}
