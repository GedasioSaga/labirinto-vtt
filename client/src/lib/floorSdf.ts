import type { FloorPiece, FloorShape } from '../types/map'
import { blocosBounds, blocosCenter, blocosDistance } from './floorBlocks'
import { createPolygonDistance, type PolygonDistance } from './polygonSdf'

/**
 * Motor do chão por peças: cada peça vira uma função de distância assinada
 * (negativa dentro, positiva fora, zero na borda) e o chão inteiro é a
 * combinação delas NA ORDEM da lista — 'add' = min, 'subtract' = max(d, -p).
 * Buraco, arredondamento e borda irregular saem de conta simples sobre essa
 * distância, sem biblioteca de booleana de polígonos.
 */

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Folga somada ao retângulo de cada peça para o descarte por distância. */
const CULL_MARGIN = 8

export function shapeCenter(shape: FloorShape): { x: number; y: number } {
  if (shape.kind === 'blocos') return blocosCenter(shape)
  if (shape.kind !== 'corridor' && shape.kind !== 'poly') return { x: shape.cx, y: shape.cy }
  const b = pointsBounds(shape.points)
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
}

/** Retângulo dos pontos; ponto com `width` (corredor) conta o raio dele. */
function pointsBounds(points: { x: number; y: number; width?: number }[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    const r = (p.width ?? 0) / 2
    minX = Math.min(minX, p.x - r)
    minY = Math.min(minY, p.y - r)
    maxX = Math.max(maxX, p.x + r)
    maxY = Math.max(maxY, p.y + r)
  }
  return { minX, minY, maxX, maxY }
}

/** Retângulo que envolve a peça já girada, com a folga do ruído e do arredondamento. */
export function pieceBounds(piece: FloorPiece): Bounds {
  const { shape } = piece
  const extra =
    (piece.modifiers.noise?.amplitude ?? 0) +
    (shape.kind === 'rect' ? 0 : piece.modifiers.rounding ?? 0) +
    Math.max(0, piece.modifiers.grow ?? 0)
  let halfW: number
  let halfH: number
  if (shape.kind === 'blocos') {
    const b = blocosBounds(shape)
    // Forma sem célula nenhuma: retângulo degenerado no centro, sem chão.
    halfW = b ? (b.maxX - b.minX) / 2 : 0
    halfH = b ? (b.maxY - b.minY) / 2 : 0
  } else if (shape.kind === 'corridor' || shape.kind === 'poly') {
    const b = pointsBounds(shape.points)
    halfW = (b.maxX - b.minX) / 2
    halfH = (b.maxY - b.minY) / 2
  } else if (shape.kind === 'rect') {
    halfW = shape.w / 2
    halfH = shape.h / 2
  } else if (shape.kind === 'ellipse') {
    halfW = shape.rx
    halfH = shape.ry
  } else {
    halfW = shape.radius
    halfH = shape.radius
  }
  const rad = ((piece.rotation ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const rw = halfW * cos + halfH * sin + extra
  const rh = halfW * sin + halfH * cos + extra
  const c = shapeCenter(shape)
  return { minX: c.x - rw, minY: c.y - rh, maxX: c.x + rw, maxY: c.y + rh }
}

function sdBox(px: number, py: number, hw: number, hh: number): number {
  const dx = Math.abs(px) - hw
  const dy = Math.abs(py) - hh
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  const inside = Math.min(Math.max(dx, dy), 0)
  return outside + inside
}

/** Aproximação de distância à elipse (erro pequeno perto da borda, que é onde importa). */
function sdEllipse(px: number, py: number, rx: number, ry: number): number {
  const k0 = Math.hypot(px / rx, py / ry)
  const k1 = Math.hypot(px / (rx * rx), py / (ry * ry))
  if (k1 === 0) return -Math.min(rx, ry)
  return (k0 * (k0 - 1)) / k1
}

/** Vértices do polígono regular com o primeiro vértice apontando para cima. */
export function regularPolygonVertices(radius: number, sides: number): { x: number; y: number }[] {
  const n = Math.max(3, Math.round(sides))
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
  })
}

/** Distância assinada a um polígono simples qualquer (regra do número de voltas). */
function sdPolygon(px: number, py: number, vertices: { x: number; y: number }[]): number {
  let best = Infinity
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[j]
    const b = vertices[i]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const wx = px - a.x
    const wy = py - a.y
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
    best = Math.min(best, Math.hypot(wx - ex * t, wy - ey * t))
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside ? -best : best
}

function sdCorridor(px: number, py: number, points: { x: number; y: number; width: number }[]): number {
  if (points.length === 0) return Infinity
  if (points.length === 1) return Math.hypot(px - points[0].x, py - points[0].y) - points[0].width / 2
  let best = Infinity
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const lengthSq = ex * ex + ey * ey
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * ex + (py - a.y) * ey) / lengthSq))
    const radius = (a.width + (b.width - a.width) * t) / 2
    best = Math.min(best, Math.hypot(px - a.x - ex * t, py - a.y - ey * t) - radius)
  }
  return best
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/** Ruído de valor 2D suavizado, em [-1, 1], duas oitavas. */
export function valueNoise(x: number, y: number, seed: number): number {
  const octave = (fx: number, fy: number, s: number) => {
    const ix = Math.floor(fx)
    const iy = Math.floor(fy)
    const tx = fx - ix
    const ty = fy - iy
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const top = hash2(ix, iy, s) + (hash2(ix + 1, iy, s) - hash2(ix, iy, s)) * sx
    const bottom = hash2(ix, iy + 1, s) + (hash2(ix + 1, iy + 1, s) - hash2(ix, iy + 1, s)) * sx
    return top + (bottom - top) * sy
  }
  return (octave(x, y, seed) * 2 + octave(x * 2.3, y * 2.3, seed + 7919)) / 3
}

/**
 * Índice espacial por forma. A store é imutável — forma editada é objeto novo —
 * então a própria referência da forma é a chave do cache, sem invalidação manual.
 */
const polygonDistanceCache = new WeakMap<object, PolygonDistance>()

function polygonDistanceFor(shape: Extract<FloorShape, { kind: 'poly' }>): PolygonDistance {
  let distance = polygonDistanceCache.get(shape)
  if (!distance) {
    distance = createPolygonDistance(shape.points)
    polygonDistanceCache.set(shape, distance)
  }
  return distance
}

/** Distância assinada de uma peça isolada (sem combinar com as outras). */
export function pieceDistance(piece: FloorPiece, x: number, y: number): number {
  const { shape, modifiers } = piece
  const center = shapeCenter(shape)
  let px = x - center.x
  let py = y - center.y
  const rotation = piece.rotation ?? 0
  if (rotation !== 0) {
    const rad = (-rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const rx = px * cos - py * sin
    py = px * sin + py * cos
    px = rx
  }
  const rounding = Math.max(0, modifiers.rounding ?? 0)
  let d: number
  if (shape.kind === 'rect') {
    // Arredondamento de retângulo encolhe antes e expande depois: o tamanho externo não muda.
    const r = Math.min(rounding, shape.w / 2, shape.h / 2)
    d = sdBox(px, py, shape.w / 2 - r, shape.h / 2 - r) - r
  } else if (shape.kind === 'ellipse') {
    d = sdEllipse(px, py, shape.rx, shape.ry) - rounding
  } else if (shape.kind === 'polygon') {
    d = sdPolygon(px, py, regularPolygonVertices(shape.radius, shape.sides)) - rounding
  } else if (shape.kind === 'poly') {
    d = polygonDistanceFor(shape)(px + center.x, py + center.y) - rounding
  } else if (shape.kind === 'blocos') {
    d = blocosDistance(shape, px + center.x, py + center.y) - rounding
  } else {
    d = sdCorridor(px + center.x, py + center.y, shape.points) - rounding
  }
  const noise = modifiers.noise
  if (noise && noise.amplitude > 0 && noise.scale > 0) {
    d += valueNoise(x / noise.scale, y / noise.scale, noise.seed) * noise.amplitude
  }
  return d - (modifiers.grow ?? 0)
}

export interface CompiledFloor {
  /** Distância assinada do chão inteiro no ponto. Sinal exato; módulo exato só perto da borda. */
  sample: (x: number, y: number) => number
  /** Retângulo das peças 'add' visíveis, ou `null` se não há chão. */
  bounds: Bounds | null
  /**
   * Quanto `sample` pode variar por px andado (constante de Lipschitz, com
   * folga). Sem ruído é ~1; o ruído aumenta. Permite pular regiões inteiras
   * longe da borda na amostragem (`sampleFloorGrid`).
   */
  lipschitz: number
}

/** Inclinação máxima de `valueNoise` por unidade de entrada (duas oitavas, smoothstep), com folga. */
const NOISE_SLOPE = 6.5
/** Folga para a aproximação de distância da elipse, que não é exatamente 1-Lipschitz. */
const LIPSCHITZ_SAFETY = 1.25

function distanceToBounds(b: Bounds, x: number, y: number): number {
  const dx = Math.max(b.minX - x, 0, x - b.maxX)
  const dy = Math.max(b.minY - y, 0, y - b.maxY)
  return Math.hypot(dx, dy)
}

/**
 * Prepara as peças para amostragem repetida. Fora do retângulo de uma peça
 * (mais `CULL_MARGIN`) a distância dela é trocada pela distância ao retângulo,
 * que é um limite inferior: o sinal do resultado nunca muda e, perto da
 * borda (|d| < margem), o valor também é exato.
 */
export function compileFloor(pieces: FloorPiece[]): CompiledFloor {
  const visible = pieces.filter((piece) => !piece.hidden)
  const entries = visible.map((piece) => {
    const b = pieceBounds(piece)
    return {
      piece,
      bounds: b,
      culled: { minX: b.minX - CULL_MARGIN, minY: b.minY - CULL_MARGIN, maxX: b.maxX + CULL_MARGIN, maxY: b.maxY + CULL_MARGIN },
    }
  })

  let bounds: Bounds | null = null
  for (const entry of entries) {
    if (entry.piece.op !== 'add') continue
    bounds = bounds
      ? {
          minX: Math.min(bounds.minX, entry.bounds.minX),
          minY: Math.min(bounds.minY, entry.bounds.minY),
          maxX: Math.max(bounds.maxX, entry.bounds.maxX),
          maxY: Math.max(bounds.maxY, entry.bounds.maxY),
        }
      : { ...entry.bounds }
  }

  const sample = (x: number, y: number): number => {
    let d = Infinity
    for (const entry of entries) {
      const c = entry.culled
      const outside = x < c.minX || x > c.maxX || y < c.minY || y > c.maxY
      const p = outside ? Math.max(distanceToBounds(entry.bounds, x, y), CULL_MARGIN) : pieceDistance(entry.piece, x, y)
      d = entry.piece.op === 'add' ? Math.min(d, p) : Math.max(d, -p)
    }
    return d
  }

  let noiseSlope = 0
  for (const entry of entries) {
    const noise = entry.piece.modifiers.noise
    if (noise && noise.amplitude > 0 && noise.scale > 0) noiseSlope = Math.max(noiseSlope, (NOISE_SLOPE * noise.amplitude) / noise.scale)
  }

  return { sample, bounds, lipschitz: (1 + noiseSlope) * LIPSCHITZ_SAFETY }
}
