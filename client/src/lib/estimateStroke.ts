import type { FloorPiece, RegionPoint } from '../types/map'
import { compileFloor } from './floorSdf'
import { extractFloorRings, sampleFloorGrid } from './floorContour'
import { grayStrokeWeight } from './refineLines'
import type { TraceRect } from './traceImage'

/**
 * Mede na própria imagem de referência a largura efetiva do traço — varia de
 * mapa para mapa (medido: ~0,64 px no contorno do mapa2, ~1,66 px no Mapa3).
 * Largura = soma da intensidade do traço perto da borda ÷ comprimento da
 * borda: um traço de largura L e comprimento C deposita L·C de "tinta".
 */

type Weight = (r: number, g: number, b: number, a: number) => number

/** Faixa (px) de cada lado da borda onde a tinta do contorno é somada. */
const FLOOR_BAND = 2.5
/** Distância máxima (px) do centro do pixel à linha para somar a tinta dela. */
const LINE_RADIUS = 1.6

function ringLength(ring: RegionPoint[]): number {
  let total = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    total += Math.hypot(ring[i].x - ring[j].x, ring[i].y - ring[j].y)
  }
  return total
}

/**
 * Largura do contorno do chão. `pieces` deve seguir a borda EXTERNA do traço
 * ou o centro dele — a faixa de ±2,5 px cobre os dois casos.
 * `null` quando não há borda para medir.
 */
export function estimateFloorStrokeWidth(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  pieces: FloorPiece[],
  rect: TraceRect,
  weight: Weight = grayStrokeWeight,
): number | null {
  const compiled = compileFloor(pieces)
  if (!compiled.bounds) return null
  const perimeter = extractFloorRings(pieces, { step: 1 }).reduce((sum, ring) => sum + ringLength(ring), 0)
  if (perimeter === 0) return null
  const values = sampleFloorGrid(compiled, rect.x + 0.5, rect.y + 0.5, rect.w, rect.h, 1)
  let ink = 0
  for (let y = 0; y < rect.h; y += 1) {
    for (let x = 0; x < rect.w; x += 1) {
      if (Math.abs(values[y * rect.w + x]) > FLOOR_BAND) continue
      const sx = rect.x + x
      const sy = rect.y + y
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
      const i = (sy * width + sx) * 4
      ink += weight(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
    }
  }
  return ink / perimeter
}

export interface MeasurableLine {
  points: RegionPoint[]
  closed: boolean
  dotted: boolean
}

/**
 * Largura das linhas contínuas. Só soma pixel cuja projeção cai DENTRO de um
 * segmento (sem as pontas) e cada pixel uma vez só, dividindo pelo
 * comprimento total dos segmentos. `null` sem linha contínua.
 */
export function estimateLineWidth(pixels: ArrayLike<number>, width: number, height: number, lines: MeasurableLine[], weight: Weight = grayStrokeWeight): number | null {
  const counted = new Uint8Array(width * height)
  let ink = 0
  let length = 0
  for (const line of lines) {
    if (line.dotted) continue
    const pts = line.points
    const segments = line.closed && pts.length > 2 ? pts.length : pts.length - 1
    for (let k = 0; k < segments; k += 1) {
      const a = pts[k]
      const b = pts[(k + 1) % pts.length]
      const segLength = Math.hypot(b.x - a.x, b.y - a.y)
      if (segLength < 3) continue
      const ux = (b.x - a.x) / segLength
      const uy = (b.y - a.y) / segLength
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - LINE_RADIUS - 1))
      const x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + LINE_RADIUS + 1))
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - LINE_RADIUS - 1))
      const y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + LINE_RADIUS + 1))
      // Mesma margem nas duas pontas: o comprimento medido é o do miolo do segmento.
      const trim = 1
      length += segLength - 2 * trim
      for (let py = y0; py <= y1; py += 1) {
        for (let px = x0; px <= x1; px += 1) {
          const cx = px + 0.5 - a.x
          const cy = py + 0.5 - a.y
          const u = cx * ux + cy * uy
          if (u < trim || u > segLength - trim) continue
          if (Math.abs(-cx * uy + cy * ux) > LINE_RADIUS) continue
          const p = py * width + px
          if (counted[p]) continue
          counted[p] = 1
          const i = p * 4
          ink += weight(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
        }
      }
    }
  }
  return length > 0 ? ink / length : null
}
