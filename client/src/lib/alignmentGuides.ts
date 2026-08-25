export interface Point {
  x: number
  y: number
}

export interface AlignmentCandidate {
  x: number
  y: number
}

export interface AlignmentGuide {
  axis: 'x' | 'y'
  position: number
}

export interface AlignmentResult {
  point: Point
  guides: AlignmentGuide[]
}

export const ALIGNMENT_THRESHOLD = 6

export function computeAlignment(
  point: Point,
  candidates: AlignmentCandidate[],
  threshold = ALIGNMENT_THRESHOLD,
): AlignmentResult {
  const result: Point = { ...point }
  const guides: AlignmentGuide[] = []

  for (const axis of ['x', 'y'] as const) {
    let bestDistance = Infinity
    let bestPosition: number | null = null
    for (const candidate of candidates) {
      const distance = Math.abs(candidate[axis] - point[axis])
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance
        bestPosition = candidate[axis]
      }
    }
    if (bestPosition !== null) {
      result[axis] = bestPosition
      guides.push({ axis, position: bestPosition })
    }
  }

  return { point: result, guides }
}
