export interface ResampleResult {
  width: number
  height: number
  needsResample: boolean
}

export function computeResampleDimensions(width: number, height: number, maxSide: number): ResampleResult {
  const largest = Math.max(width, height)
  if (largest <= maxSide) {
    return { width, height, needsResample: false }
  }
  const scale = maxSide / largest
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    needsResample: true,
  }
}
