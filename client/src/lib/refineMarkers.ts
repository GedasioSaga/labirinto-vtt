import type { TracedMarker } from './traceMarkers'

/**
 * Ajuste subpixel de marcador (porta) vetorizado por `traceMarkers.ts`, que
 * mede centro e tamanho pela caixa dos pixels acesos. Com antisserrilhado, a
 * fração de laranja em cada pixel é a cobertura dele: os momentos ponderados
 * por essa cobertura dão centro e eixo exatos, e o tamanho sai da variância —
 * retângulo uniforme de lado L tem variância L²/12, e o filtro de caixa do
 * pixel soma 1/12, então L = √(12·var − 1).
 */

export interface RefineMarkerOptions {
  /** Cobertura do marcador no pixel, em [0, 1]. */
  weight: (r: number, g: number, b: number, a: number) => number
  /** Margem (px) em volta da caixa do marcador varrida no ajuste. */
  margin?: number
}

const DEFAULT_MARGIN = 2
const MIN_TOTAL_WEIGHT = 2
/** Mudança de tamanho acima disso é ajuste ruim (vizinho laranja entrou): fica o original. */
const MAX_SIZE_RATIO = 1.6

/** Laranja #cc9933 sobre verde, preto ou cinza: só o laranja tem vermelho alto com azul baixo. */
export function orangeMarkerWeight(r: number, g: number, b: number, a: number): number {
  if (a === 0) return 0
  const neutral = Math.abs(r - g) <= 14 && Math.abs(g - b) <= 14
  if (neutral || b > r * 0.5 + 10) return 0
  return Math.min(1, r / 204)
}

export function refineMarker(marker: TracedMarker, pixels: ArrayLike<number>, width: number, height: number, options: RefineMarkerOptions): TracedMarker {
  const margin = options.margin ?? DEFAULT_MARGIN
  const reach = Math.hypot(marker.w, marker.h) / 2 + margin
  const x0 = Math.max(0, Math.floor(marker.cx - reach))
  const x1 = Math.min(width - 1, Math.ceil(marker.cx + reach))
  const y0 = Math.max(0, Math.floor(marker.cy - reach))
  const y1 = Math.min(height - 1, Math.ceil(marker.cy + reach))

  let sw = 0
  let sx = 0
  let sy = 0
  const samples: { x: number; y: number; w: number }[] = []
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const i = (py * width + px) * 4
      const w = options.weight(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
      if (w <= 0) continue
      const x = px + 0.5
      const y = py + 0.5
      samples.push({ x, y, w })
      sw += w
      sx += w * x
      sy += w * y
    }
  }
  if (sw < MIN_TOTAL_WEIGHT) return marker

  const cx = sx / sw
  const cy = sy / sw
  let cxx = 0
  let cyy = 0
  let cxy = 0
  for (const s of samples) {
    cxx += s.w * (s.x - cx) ** 2
    cyy += s.w * (s.y - cy) ** 2
    cxy += s.w * (s.x - cx) * (s.y - cy)
  }
  cxx /= sw
  cyy /= sw
  cxy /= sw
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const varU = cxx * ux * ux + 2 * cxy * ux * uy + cyy * uy * uy
  const varV = cxx * uy * uy - 2 * cxy * ux * uy + cyy * ux * ux
  const w = Math.sqrt(Math.max(0, 12 * varU - 1))
  const h = Math.sqrt(Math.max(0, 12 * varV - 1))

  const sizeOk = (next: number, old: number) => next > 0 && next <= old * MAX_SIZE_RATIO && next >= old / MAX_SIZE_RATIO
  if (!sizeOk(w, marker.w) || !sizeOk(h, Math.max(marker.h, 1))) return marker
  return { ...marker, cx, cy, w, h, rotation: (angle * 180) / Math.PI }
}
