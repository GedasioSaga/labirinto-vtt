import type { FloorPiece, RegionPoint } from '../types/map'
import { marchingSquares, pointInRing, signedArea } from './floorContour'
import { simplifyPolygon } from './regionSmoothing'

/**
 * Ferramenta "Chão a partir de imagem": vetoriza uma imagem de referência em
 * peças de chão editáveis (polígonos livres). Cada contorno vira uma peça; a
 * profundidade de aninhamento decide a operação — contorno externo soma,
 * buraco dentro dele subtrai, ilha dentro do buraco soma de novo — e as peças
 * saem na ordem de profundidade, que é a ordem em que o motor as combina.
 */

export interface TraceRect {
  x: number
  y: number
  w: number
  h: number
}

export interface TraceOptions {
  /** Desvio máximo da simplificação, em px. Menor = mais vértices, mais fiel. */
  tolerance?: number
  /** Contorno com área menor que isso (px²) é descartado como ruído. */
  minArea?: number
  /** Só vetoriza dentro deste retângulo. Padrão: a imagem inteira. */
  rect?: TraceRect
  isFloor?: (r: number, g: number, b: number, a: number) => boolean
  /**
   * Cobertura contínua do pixel em [0, 1] (0 = fundo, 1 = chão). Com ela o
   * marching squares interpola a borda DENTRO do pixel, usando o
   * antisserrilhado da imagem — contorno subpixel em vez de borda na aresta.
   * Tem precedência sobre `isFloor`.
   */
  coverage?: (r: number, g: number, b: number, a: number) => number
  /**
   * Recuo da borda, em px (positivo = chão menor, buraco maior). A máscara
   * conta o traço de contorno como chão, então a borda vetorizada fica na
   * face externa do traço; o recuo leva a borda para o centro dele.
   */
  inset?: number
}

export interface TracedRing {
  points: RegionPoint[]
  area: number
  depth: number
}

// Abaixo do chanfro de 0,5 px que o marching squares corta em canto de pixel:
// com 0,75 a simplificação trocava o canto pelo chanfro e entortava o lado
// inteiro (borda reta em x=5 virava diagonal de 5 a 5,5 — medido no teste de recuo).
const DEFAULT_TOLERANCE = 0.3
const DEFAULT_MIN_AREA = 12

/** Chão de minimapa: qualquer pixel que não seja fundo quase preto. */
export function isMinimapFloorPixel(r: number, g: number, b: number, a: number): boolean {
  return a > 0 && (g >= 40 || r + g + b >= 120)
}

/** Brilho do traço cinza de contorno nos mapas de referência (#858585) e do verde do chão (#006b00). */
const MINIMAP_GRAY_FULL = 0x85
const MINIMAP_GREEN_FULL = 0x6b
const GRAY_CHANNEL_SPREAD = 14

/**
 * Cobertura de minimapa: pixel cinza neutro é traço de contorno misturado com
 * o fundo preto (brilho / brilho cheio); qualquer outro é chão (verde / verde
 * cheio). Chão e traço contam os dois como "dentro".
 */
export function minimapCoverage(r: number, g: number, b: number, a: number): number {
  if (a === 0) return 0
  const neutral = Math.abs(r - g) <= GRAY_CHANNEL_SPREAD && Math.abs(g - b) <= GRAY_CHANNEL_SPREAD
  return neutral ? Math.max(r, g, b) / MINIMAP_GRAY_FULL : g / MINIMAP_GREEN_FULL
}

export function traceFloorRings(pixels: ArrayLike<number>, width: number, height: number, options: TraceOptions = {}): TracedRing[] {
  const rect = options.rect ?? { x: 0, y: 0, w: width, h: height }
  const isFloor = options.isFloor ?? isMinimapFloorPixel
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE
  const minArea = options.minArea ?? DEFAULT_MIN_AREA

  // Amostra no centro do pixel com moldura de 1 amostra "fora": a borda interpolada cai na aresta do pixel.
  const cols = rect.w + 2
  const rows = rect.h + 2
  const values = new Float32Array(cols * rows).fill(1)
  for (let y = 0; y < rect.h; y += 1) {
    for (let x = 0; x < rect.w; x += 1) {
      const sx = rect.x + x
      const sy = rect.y + y
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
      const i = (sy * width + sx) * 4
      if (options.coverage) {
        const c = options.coverage(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
        values[(y + 1) * cols + x + 1] = 0.5 - Math.max(0, Math.min(1, c))
      } else if (isFloor(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) {
        values[(y + 1) * cols + x + 1] = -1
      }
    }
  }

  const rings = marchingSquares(values, cols, rows, rect.x - 0.5, rect.y - 0.5, 1)
    .map((ring) => ({ ring, area: Math.abs(signedArea(ring)) }))
    .filter((r) => r.area >= minArea)
    .sort((a, b) => b.area - a.area)

  return rings.map(({ ring, area }, index) => {
    let depth = 0
    for (let k = 0; k < index; k += 1) {
      if (pointInRing(ring[0], rings[k].ring)) depth += 1
    }
    const xs = ring.map((p) => p.x)
    const ys = ring.map((p) => p.y)
    const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    const points = tolerance > 0 && diagonal > 0 ? simplifyPolygon(ring, tolerance / diagonal) : ring
    return { points, area, depth }
  })
}

export function traceFloorPieces(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: TraceOptions,
  makeId: (index: number) => string,
): FloorPiece[] {
  const inset = options.inset ?? 0
  return traceFloorRings(pixels, width, height, options)
    .map((ring, index) => ({ ring, index }))
    .sort((a, b) => a.ring.depth - b.ring.depth || a.index - b.index)
    .map(({ ring }, index) => ({
      id: makeId(index),
      shape: { kind: 'poly', points: ring.points.map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })) },
      op: ring.depth % 2 === 0 ? 'add' : 'subtract',
      // Peça que subtrai é buraco: recuar o chão significa engordar o buraco.
      modifiers: inset !== 0 ? { grow: ring.depth % 2 === 0 ? -inset : inset } : {},
    }))
}
