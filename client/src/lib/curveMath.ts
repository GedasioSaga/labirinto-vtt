export interface Point {
  x: number
  y: number
}

export interface BezierSegment {
  c1: Point
  c2: Point
  end: Point
}

/** Reduz uma captura bruta de mouse a um punhado de pontos de controle,
 * mantendo só pontos a pelo menos `minDistance` do último mantido. */
export function simplifyToControlPoints(points: Point[], minDistance = 24): Point[] {
  if (points.length <= 2) return points

  const first = points[0]
  const last = points[points.length - 1]
  const kept: Point[] = [first]

  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i]
    const previous = kept[kept.length - 1]
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= minDistance) {
      kept.push(point)
    }
  }

  kept.push(last)
  return kept
}

/** Converte uma sequência de pontos (que a curva deve atravessar) numa
 * cadeia de segmentos Bézier cúbicos via Catmull-Rom — passagem suave por
 * cada ponto, sem pontos de controle "soltos" fora da curva. */
export function catmullRomToBezierSegments(points: Point[]): BezierSegment[] {
  const segments: BezierSegment[] = []

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? points[i + 1]

    const c1: Point = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2: Point = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    segments.push({ c1, c2, end: p2 })
  }

  return segments
}
