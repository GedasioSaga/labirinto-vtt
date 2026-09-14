import type { RegionPoint } from '../types/map'

/**
 * Ajuste subpixel de polilinha vetorizada (`traceLines.ts` devolve vértices em
 * centro de pixel). Numa imagem com antisserrilhado a intensidade do traço
 * espalhada pelos pixels vizinhos diz onde o centro da linha passa de verdade:
 * cada segmento vira a reta de mínimos quadrados ponderada pela intensidade
 * dos pixels em volta dele, e cada vértice interno vira a interseção das
 * retas vizinhas.
 */

export interface RefinableLine {
  points: RegionPoint[]
  closed: boolean
}

export interface RefineOptions {
  /** Intensidade do traço no pixel, em [0, 1]. */
  weight: (r: number, g: number, b: number, a: number) => number
  /** Distância máxima (px) do centro do pixel à reta para entrar no ajuste. */
  radius?: number
  /** Deslocamento máximo aceito de um vértice; acima disso fica o original. */
  maxShift?: number
}

interface FittedLine {
  cx: number
  cy: number
  dx: number
  dy: number
}

const DEFAULT_RADIUS = 1.6
const DEFAULT_MAX_SHIFT = 1.5
/** Fração de cada ponta do segmento ignorada no ajuste: perto do vértice os pixels são do segmento vizinho. */
const END_TRIM = 0.2
const MIN_WEIGHT = 1.5
const PARALLEL_EPSILON = 0.15

/** Intensidade de traço cinza sobre fundo preto ou verde: os dois têm vermelho zero, o cinza #858585 tem 133. */
export function grayStrokeWeight(r: number, g: number, b: number, a: number): number {
  if (a === 0) return 0
  // Laranja de porta também tem vermelho alto: fica de fora.
  if (r > g + 25 && g > b + 25) return 0
  return Math.min(1, r / 133)
}

function fitSegment(
  a: RegionPoint,
  b: RegionPoint,
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: Required<RefineOptions>,
): FittedLine | null {
  const ex = b.x - a.x
  const ey = b.y - a.y
  const length = Math.hypot(ex, ey)
  if (length < 2) return null
  const ux = ex / length
  const uy = ey / length
  const trim = length > 5 ? END_TRIM : 0
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - options.radius - 1))
  const x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + options.radius + 1))
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - options.radius - 1))
  const y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + options.radius + 1))

  let sw = 0
  let sx = 0
  let sy = 0
  const samples: { x: number; y: number; w: number }[] = []
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const cx = px + 0.5
      const cy = py + 0.5
      const t = ((cx - a.x) * ux + (cy - a.y) * uy) / length
      if (t < trim || t > 1 - trim) continue
      const across = Math.abs(-(cx - a.x) * uy + (cy - a.y) * ux)
      if (across > options.radius) continue
      const i = (py * width + px) * 4
      const w = options.weight(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
      if (w <= 0) continue
      samples.push({ x: cx, y: cy, w })
      sw += w
      sx += w * cx
      sy += w * cy
    }
  }
  if (sw < MIN_WEIGHT) return null
  const mx = sx / sw
  const my = sy / sw
  let cxx = 0
  let cyy = 0
  let cxy = 0
  for (const s of samples) {
    cxx += s.w * (s.x - mx) ** 2
    cyy += s.w * (s.y - my) ** 2
    cxy += s.w * (s.x - mx) * (s.y - my)
  }
  let angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
  // Poucos pixels num segmento curto dão direção instável: fica a do segmento original.
  if (samples.length < 4) angle = Math.atan2(uy, ux)
  let dx = Math.cos(angle)
  let dy = Math.sin(angle)
  if (dx * ux + dy * uy < 0) {
    dx = -dx
    dy = -dy
  }
  return { cx: mx, cy: my, dx, dy }
}

function project(p: RegionPoint, line: FittedLine): RegionPoint {
  const t = (p.x - line.cx) * line.dx + (p.y - line.cy) * line.dy
  return { x: line.cx + line.dx * t, y: line.cy + line.dy * t }
}

function intersect(l1: FittedLine, l2: FittedLine): RegionPoint | null {
  const cross = l1.dx * l2.dy - l1.dy * l2.dx
  if (Math.abs(cross) < PARALLEL_EPSILON) return null
  const t = ((l2.cx - l1.cx) * l2.dy - (l2.cy - l1.cy) * l2.dx) / cross
  return { x: l1.cx + l1.dx * t, y: l1.cy + l1.dy * t }
}

function accept(original: RegionPoint, candidate: RegionPoint | null, maxShift: number): RegionPoint {
  if (!candidate) return original
  return Math.hypot(candidate.x - original.x, candidate.y - original.y) <= maxShift ? candidate : original
}

export function refineLine(line: RefinableLine, pixels: ArrayLike<number>, width: number, height: number, options: RefineOptions): RegionPoint[] {
  const opts: Required<RefineOptions> = {
    weight: options.weight,
    radius: options.radius ?? DEFAULT_RADIUS,
    maxShift: options.maxShift ?? DEFAULT_MAX_SHIFT,
  }
  const pts = line.points
  const n = pts.length
  if (n < 2) return pts
  const segmentCount = line.closed && n > 2 ? n : n - 1
  const fits = Array.from({ length: segmentCount }, (_, i) => fitSegment(pts[i], pts[(i + 1) % n], pixels, width, height, opts))

  return pts.map((p, i) => {
    const before = line.closed && n > 2 ? fits[(i - 1 + segmentCount) % segmentCount] : i > 0 ? fits[i - 1] : null
    const after = i < segmentCount ? fits[i] : null
    if (before && after) {
      const meet = intersect(before, after)
      // Quase paralelas: vértice no meio das duas projeções.
      if (!meet) {
        const pa = project(p, before)
        const pb = project(p, after)
        return accept(p, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, opts.maxShift)
      }
      return accept(p, meet, opts.maxShift)
    }
    const only = before ?? after
    return only ? accept(p, project(p, only), opts.maxShift) : p
  })
}
