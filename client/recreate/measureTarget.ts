import { marchingSquares, signedArea } from '../src/lib/floorContour'
import { simplifyPolygon } from '../src/lib/regionSmoothing'
import { loadPixels, toMask, type Crop } from './compareMasks'

/**
 * Régua do harness: extrai o contorno do chão da imagem do OBJETIVO (não da
 * tentativa) em anéis simplificados, para medir onde ficam bordas, cantos e
 * larguras de corredor antes de posicionar as peças. Roda no browser.
 */
export interface MeasuredRing {
  area: number
  hole: boolean
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  points: [number, number][]
}

export async function measureTarget(url: string, width: number, height: number, crop: Crop, tolerance: number): Promise<MeasuredRing[]> {
  const mask = toMask(await loadPixels(url, width, height), width, height, crop)
  // Moldura de 1 amostra fora do chão; amostra no centro do pixel, então a borda interpolada cai na aresta do pixel.
  const cols = crop.w + 2
  const rows = crop.h + 2
  const values = new Float32Array(cols * rows).fill(1)
  for (let y = 0; y < crop.h; y += 1) {
    for (let x = 0; x < crop.w; x += 1) {
      if (mask[y * crop.w + x]) values[(y + 1) * cols + x + 1] = -1
    }
  }
  const rings = marchingSquares(values, cols, rows, crop.x - 0.5, crop.y - 0.5, 1)
  const areas = rings.map((ring) => signedArea(ring))
  const outerSign = Math.sign(areas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0))
  return rings
    .map((ring, i) => {
      const xs = ring.map((p) => p.x)
      const ys = ring.map((p) => p.y)
      const bounds = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
      const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
      const simplified = diagonal > 0 ? simplifyPolygon(ring, tolerance / diagonal) : ring
      return {
        area: Math.abs(areas[i]),
        hole: Math.sign(areas[i]) !== outerSign,
        bounds,
        points: simplified.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number]),
      }
    })
    .filter((ring) => ring.area >= 12)
    .sort((a, b) => b.area - a.area)
}
