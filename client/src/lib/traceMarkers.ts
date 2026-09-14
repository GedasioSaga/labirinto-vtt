import type { TraceRect } from './traceImage'

/**
 * Vetoriza manchas pequenas de cor sólida (portas laranjas dos mapas de
 * referência) em retângulos girados: cada componente conexo vira o menor
 * retângulo alinhado ao eixo principal da mancha (momentos de segunda ordem).
 */

export interface TracedMarker {
  cx: number
  cy: number
  /** Extensão ao longo do eixo principal, em px. */
  w: number
  /** Extensão perpendicular ao eixo principal, em px. */
  h: number
  /** Graus, sentido horário (y para baixo), do eixo principal. */
  rotation: number
  /** Cor média, `#rrggbb`. */
  color: string
  pixelCount: number
}

export interface TraceMarkersOptions {
  rect?: TraceRect
  isMarker?: (r: number, g: number, b: number, a: number) => boolean
  /** Mancha com menos pixels que isso é descartada. */
  minPixels?: number
}

const DEFAULT_MIN_PIXELS = 3

/** Laranja das portas dos mapas de referência (#cc9933 e antisserrilhado em volta). */
export function isOrangeMarkerPixel(r: number, g: number, b: number, a: number): boolean {
  return a > 0 && r >= 120 && r > g + 25 && g > b + 25
}

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0')
}

export function traceMarkers(pixels: ArrayLike<number>, width: number, height: number, options: TraceMarkersOptions = {}): TracedMarker[] {
  const rect = options.rect ?? { x: 0, y: 0, w: width, h: height }
  const isMarker = options.isMarker ?? isOrangeMarkerPixel
  const minPixels = options.minPixels ?? DEFAULT_MIN_PIXELS
  const w = rect.w
  const h = rect.h
  const pixelIndex = (x: number, y: number) => ((rect.y + y) * width + rect.x + x) * 4

  const on = new Uint8Array(w * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = rect.x + x
      const sy = rect.y + y
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
      const i = pixelIndex(x, y)
      if (isMarker(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) on[y * w + x] = 1
    }
  }

  const seen = new Uint8Array(w * h)
  const markers: TracedMarker[] = []
  for (let start = 0; start < on.length; start += 1) {
    if (!on[start] || seen[start]) continue
    const component: number[] = []
    const stack = [start]
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop() as number
      component.push(p)
      const x = p % w
      const y = (p - x) / w
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (on[q] && !seen[q]) {
            seen[q] = 1
            stack.push(q)
          }
        }
      }
    }
    if (component.length < minPixels) continue
    markers.push(fitRotatedRect(component, w, rect, pixels, pixelIndex))
  }
  return markers
}

function fitRotatedRect(
  component: number[],
  w: number,
  rect: TraceRect,
  pixels: ArrayLike<number>,
  pixelIndex: (x: number, y: number) => number,
): TracedMarker {
  const n = component.length
  let sumX = 0
  let sumY = 0
  let r = 0
  let g = 0
  let b = 0
  const centers = component.map((p) => {
    const x = p % w
    const y = (p - x) / w
    const i = pixelIndex(x, y)
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
    const center = { x: rect.x + x + 0.5, y: rect.y + y + 0.5 }
    sumX += center.x
    sumY += center.y
    return center
  })
  const meanX = sumX / n
  const meanY = sumY / n
  let cxx = 0
  let cyy = 0
  let cxy = 0
  for (const c of centers) {
    cxx += (c.x - meanX) ** 2
    cyy += (c.y - meanY) ** 2
    cxy += (c.x - meanX) * (c.y - meanY)
  }
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const c of centers) {
    const du = (c.x - meanX) * ux + (c.y - meanY) * uy
    const dv = -(c.x - meanX) * uy + (c.y - meanY) * ux
    minU = Math.min(minU, du)
    maxU = Math.max(maxU, du)
    minV = Math.min(minV, dv)
    maxV = Math.max(maxV, dv)
  }
  const midU = (minU + maxU) / 2
  const midV = (minV + maxV) / 2
  return {
    cx: meanX + midU * ux - midV * uy,
    cy: meanY + midU * uy + midV * ux,
    // Centros de pixel nas pontas: soma 1 px para cobrir o pixel inteiro.
    w: maxU - minU + 1,
    h: maxV - minV + 1,
    rotation: (angle * 180) / Math.PI,
    color: `#${toHex(r / n)}${toHex(g / n)}${toHex(b / n)}`,
    pixelCount: n,
  }
}
