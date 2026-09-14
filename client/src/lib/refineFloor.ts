import type { FloorPiece, RegionPoint } from '../types/map'
import { grayStrokeWeight, refineLine } from './refineLines'

/**
 * Ajuste subpixel do contorno do chão vetorizado: o anel sai do marching
 * squares na face externa do traço cinza (cobertura 0,5 da união chão+traço)
 * e com passos de meio pixel. Aqui cada anel é simplificado para segmentos
 * longos o bastante para um ajuste estável e cada segmento vira a reta de
 * mínimos quadrados ponderada pela intensidade do traço — o anel passa a
 * seguir o CENTRO do traço, que é a borda verdadeira do chão (recuo ≈ 0).
 */

type Weight = (r: number, g: number, b: number, a: number) => number

export interface RefineFloorOptions {
  /** Tolerância (px) da simplificação antes do ajuste: maior = segmentos mais longos e estáveis, menos detalhe. */
  coarseTolerance?: number
  weight?: Weight
  radius?: number
  maxShift?: number
}

const DEFAULT_COARSE_TOLERANCE = 0.8
const DEFAULT_RADIUS = 1.6
const DEFAULT_MAX_SHIFT = 1.5

function pointLineDistance(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length
}

function simplifyOpen(points: RegionPoint[], tolerance: number): RegionPoint[] {
  if (points.length < 3) return points
  const first = points[0]
  const last = points[points.length - 1]
  let farthest = 0
  let farthestDistance = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = pointLineDistance(points[i], first, last)
    if (d > farthestDistance) {
      farthestDistance = d
      farthest = i
    }
  }
  if (farthestDistance <= tolerance) return [first, last]
  const left = simplifyOpen(points.slice(0, farthest + 1), tolerance)
  const right = simplifyOpen(points.slice(farthest), tolerance)
  return [...left.slice(0, -1), ...right]
}

/** Douglas-Peucker de anel fechado: corta no ponto mais distante do primeiro e simplifica as duas metades. */
export function simplifyRing(points: RegionPoint[], tolerance: number): RegionPoint[] {
  if (points.length <= 3) return points
  let far = 0
  let farDistance = -1
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - points[0].x, p.y - points[0].y)
    if (d > farDistance) {
      farDistance = d
      far = i
    }
  })
  const first = simplifyOpen(points.slice(0, far + 1), tolerance)
  const second = simplifyOpen([...points.slice(far), points[0]], tolerance)
  const ring = [...first.slice(0, -1), ...second.slice(0, -1)]
  return ring.length >= 3 ? ring : points
}

export function refineFloorPieces(pieces: FloorPiece[], pixels: ArrayLike<number>, width: number, height: number, options: RefineFloorOptions = {}): FloorPiece[] {
  const tolerance = options.coarseTolerance ?? DEFAULT_COARSE_TOLERANCE
  return pieces.map((piece) => {
    if (piece.shape.kind !== 'poly') return piece
    const coarse = simplifyRing(piece.shape.points, tolerance)
    if (coarse.length < 3) return piece
    const refined = refineLine({ points: coarse, closed: true }, pixels, width, height, {
      weight: options.weight ?? grayStrokeWeight,
      radius: options.radius ?? DEFAULT_RADIUS,
      maxShift: options.maxShift ?? DEFAULT_MAX_SHIFT,
    })
    return { ...piece, shape: { kind: 'poly', points: refined } }
  })
}
