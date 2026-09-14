import type { RegionPoint } from '../types/map'
import type { TraceRect } from './traceImage'

/**
 * Vetoriza traços finos (1 px) de uma imagem de referência em polilinhas:
 * linhas cinzas de contorno de prédio e divisória, contínuas ou pontilhadas.
 * Os pixels do traço viram um grafo (vizinhança 8); ponto de pontilhado sem
 * vizinho encosta no próximo ponto a 2 px. Cada caminho entre pontas/junções
 * vira uma polilinha simplificada; o pontilhado é marcado quando a maioria
 * dos pixels do caminho não tinha vizinho direto.
 */

export interface TracedLine {
  /** Centros de pixel (x + 0.5, y + 0.5) dos vértices, já simplificados. */
  points: RegionPoint[]
  closed: boolean
  dotted: boolean
  /** Cor média dos pixels do traço, `#rrggbb`. */
  color: string
  /** Quantidade de pixels do traço original (antes de simplificar). */
  pixelCount: number
}

export interface TraceLinesOptions {
  rect?: TraceRect
  isLine?: (r: number, g: number, b: number, a: number) => boolean
  /** Desvio máximo da simplificação, em px. */
  tolerance?: number
  /** Caminho com menos pixels que isso é descartado. */
  minPixels?: number
  /**
   * Descarta pixel de traço a até `radius` px de um pixel de fundo — é o
   * contorno do próprio chão, que o render do chão já desenha.
   */
  excludeNearBackground?: { radius: number; isBackground: (r: number, g: number, b: number, a: number) => boolean }
  /**
   * Afina a máscara para esqueleto de 1 px (Zhang-Suen) antes de vetorizar.
   * Linha antisserrilhada de ~1,8 px detectada por intensidade vira faixa de 2 px,
   * e o vetorizador (que espera traço de 1 px) gerava escadinha e junção falsa.
   */
  thin?: boolean
}

/** Afinamento Zhang-Suen in-place de máscara binária (1 = traço). */
export function thinMask(on: Uint8Array, w: number, h: number): void {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? on[y * w + x] : 0)
  let changed = true
  while (changed) {
    changed = false
    for (const pass of [0, 1]) {
      const remove: number[] = []
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (!on[y * w + x]) continue
          // Vizinhos em sentido horário a partir de cima: P2..P9.
          const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)]
          const count = p.reduce((a, b) => a + b, 0)
          if (count < 2 || count > 6) continue
          let transitions = 0
          for (let k = 0; k < 8; k += 1) if (p[k] === 0 && p[(k + 1) % 8] === 1) transitions += 1
          if (transitions !== 1) continue
          const [p2, , p4, , p6, , p8] = p
          if (pass === 0 ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0 : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue
          remove.push(y * w + x)
        }
      }
      for (const i of remove) on[i] = 0
      if (remove.length > 0) changed = true
    }
  }
}

const DEFAULT_TOLERANCE = 0.6
const DEFAULT_MIN_PIXELS = 3

/** Cinza neutro claro o bastante para não ser fundo: o traço dos mapas de referência (#7f857f e vizinhos). */
export function isGrayLinePixel(r: number, g: number, b: number, a: number): boolean {
  return a > 0 && Math.abs(r - g) <= 24 && Math.abs(g - b) <= 24 && Math.abs(r - b) <= 24 && r + g + b >= 150
}

const NEAR = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
] as const

/** Anel de distância 2 (Chebyshev) — alcance do próximo ponto num pontilhado. */
const FAR = [
  [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
  [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1],
  [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
] as const

function toHex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0')
}

export function traceLines(pixels: ArrayLike<number>, width: number, height: number, options: TraceLinesOptions = {}): TracedLine[] {
  const rect = options.rect ?? { x: 0, y: 0, w: width, h: height }
  const isLine = options.isLine ?? isGrayLinePixel
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE
  const minPixels = options.minPixels ?? DEFAULT_MIN_PIXELS
  const w = rect.w
  const h = rect.h

  const on = new Uint8Array(w * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = rect.x + x
      const sy = rect.y + y
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
      const i = (sy * width + sx) * 4
      if (isLine(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) on[y * w + x] = 1
    }
  }
  const exclude = options.excludeNearBackground
  if (exclude && exclude.radius > 0) {
    const isBackgroundAt = (sx: number, sy: number) => {
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) return true
      const i = (sy * width + sx) * 4
      return exclude.isBackground(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
    }
    const r = Math.ceil(exclude.radius)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (!on[y * w + x]) continue
        search: for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            if (isBackgroundAt(rect.x + x + dx, rect.y + y + dy)) {
              on[y * w + x] = 0
              break search
            }
          }
        }
      }
    }
  }
  if (options.thin) thinMask(on, w, h)
  const isOn = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && on[y * w + x] === 1

  // Vizinhos de cada pixel: diretos (8) ou, para ponto isolado de pontilhado, os pontos a 2 px.
  const neighbors = new Map<number, number[]>()
  const isolated = new Uint8Array(w * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!on[y * w + x]) continue
      const list: number[] = []
      for (const [dx, dy] of NEAR) {
        if (!isOn(x + dx, y + dy)) continue
        // Diagonal só quando não há caminho ortogonal: senão todo canto de traço vira junção falsa de grau 3.
        if (dx !== 0 && dy !== 0 && (isOn(x + dx, y) || isOn(x, y + dy))) continue
        list.push((y + dy) * w + x + dx)
      }
      if (list.length === 0) isolated[y * w + x] = 1
      neighbors.set(y * w + x, list)
    }
  }
  // Ligação de 2 px não pode passar por cima de fundo: ligava pontos dos dois lados de
  // uma fresta preta e a linha desenhada fundia ilhas de chão separadas (Mapa3, detecção por peso).
  const gapIsBackground = (x: number, y: number, dx: number, dy: number): boolean => {
    if (!exclude) return false
    const mids = [
      [x + Math.floor(dx / 2), y + Math.floor(dy / 2)],
      [x + Math.ceil(dx / 2), y + Math.ceil(dy / 2)],
    ]
    return mids.some(([mx, my]) => {
      const sx = rect.x + mx
      const sy = rect.y + my
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) return true
      const i = (sy * width + sx) * 4
      return exclude.isBackground(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
    })
  }
  for (const [p, list] of neighbors) {
    if (!isolated[p]) continue
    const x = p % w
    const y = (p - x) / w
    for (const [dx, dy] of FAR) {
      const q = (y + dy) * w + x + dx
      if (isOn(x + dx, y + dy) && isolated[q] && !gapIsBackground(x, y, dx, dy)) list.push(q)
    }
  }
  // Grafo simétrico: a ligação de 2 px só vale nos dois sentidos.
  for (const [p, list] of neighbors) {
    neighbors.set(p, list.filter((q) => neighbors.get(q)?.includes(p)))
  }

  const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)
  const usedEdges = new Set<string>()
  const lines: TracedLine[] = []

  const emit = (path: number[], closed: boolean) => {
    if (path.length < minPixels) return
    let r = 0
    let g = 0
    let b = 0
    let lonely = 0
    const points = path.map((p) => {
      const x = p % w
      const y = (p - x) / w
      const i = ((rect.y + y) * width + rect.x + x) * 4
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      lonely += isolated[p]
      return { x: rect.x + x + 0.5, y: rect.y + y + 0.5 }
    })
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    const simplified = tolerance > 0 && diagonal > 0 ? simplifyChain(points, tolerance, closed) : points
    lines.push({
      points: simplified,
      closed,
      dotted: lonely * 2 > path.length,
      color: `#${toHex(r / path.length)}${toHex(g / path.length)}${toHex(b / path.length)}`,
      pixelCount: path.length,
    })
  }

  const walk = (start: number, next: number): number[] => {
    const path = [start]
    let previous = start
    let current = next
    usedEdges.add(edgeKey(start, next))
    for (;;) {
      path.push(current)
      const list = neighbors.get(current) ?? []
      if (list.length !== 2) break
      const candidate = list[0] === previous ? list[1] : list[0]
      const key = edgeKey(current, candidate)
      if (usedEdges.has(key)) break
      usedEdges.add(key)
      previous = current
      current = candidate
    }
    return path
  }

  // Primeiro os caminhos que começam em ponta ou junção; depois sobram só laços fechados.
  for (const [p, list] of neighbors) {
    if (list.length === 2) continue
    if (list.length === 0) {
      emit([p], false)
      continue
    }
    for (const q of list) {
      if (!usedEdges.has(edgeKey(p, q))) emit(walk(p, q), false)
    }
  }
  for (const [p, list] of neighbors) {
    if (list.length !== 2 || usedEdges.has(edgeKey(p, list[0]))) continue
    const path = walk(p, list[0])
    if (path[path.length - 1] === p) path.pop()
    emit(path, true)
  }
  return lines
}

/** Douglas-Peucker com tolerância absoluta; em laço fechado corta no ponto mais distante do início. */
function simplifyChain(points: RegionPoint[], tolerance: number, closed: boolean): RegionPoint[] {
  if (points.length < 3) return points
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  if (diagonal === 0) return [points[0]]
  if (!closed) return simplifyOpen(points, tolerance)
  let far = 0
  let farDistance = -1
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - points[0].x, p.y - points[0].y)
    if (d > farDistance) {
      farDistance = d
      far = i
    }
  })
  const first = simplifyOpen(points.slice(0, far + 1), tolerance)
  const second = simplifyOpen([...points.slice(far), points[0]], tolerance)
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

/**
 * Douglas-Peucker próprio, com tolerância absoluta: `simplifyPolygon`
 * (regionSmoothing.ts) recusa resultado com menos de 3 pontos, e traço reto
 * aberto precisa poder virar só as 2 pontas.
 */
function simplifyOpen(points: RegionPoint[], tolerance: number): RegionPoint[] {
  if (points.length < 3) return points
  const first = points[0]
  const last = points[points.length - 1]
  let farthest = 0
  let farthestDistance = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = pointLineDistance(points[i], first, last)
    if (d > farthestDistance) {
      farthestDistance = d
      farthest = i
    }
  }
  if (farthestDistance <= tolerance) return [first, last]
  const left = simplifyOpen(points.slice(0, farthest + 1), tolerance)
  const right = simplifyOpen(points.slice(farthest), tolerance)
  return [...left.slice(0, -1), ...right]
}

function pointLineDistance(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length
}
