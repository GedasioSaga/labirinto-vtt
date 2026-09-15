import type { FloorPolygon } from '../lib/floorContour'
import type { Region, RegionPoint, Wall } from '../types/map'
import {
  HATCH_BAND_CELLS,
  HATCH_CLUSTER_SPACING_CELLS,
  HATCH_REACH_NOISE_CELLS,
  HATCH_STROKE_CELLS,
  isInteriorWall,
  wallWidthFor,
} from './dungeonStyle'
import { floorRegions } from './floorMask'

/**
 * Geometria da hachura VETORIAL "Dyson Logos" (sem textura): cachos de traços
 * paralelos num grid GLOBAL de mundo, com jitter e ângulo sorteados por hash da
 * célula (nunca `Math.random`). Posição global = duas salas encostadas ou
 * vizinhas compartilham os mesmos cachos, sem hachura dobrada nem costura.
 *
 * Puro (sem Pixi): quem desenha é `drawHatch.ts`.
 */

/** Deslocamento máximo do centro do cacho, em fração do espaçamento. */
const JITTER = 0.12
/** Fração de cachos com 5 traços (o resto tem 4). */
const FIVE_STROKE_SHARE = 0.15
/** Largura do cacho (do primeiro ao último traço), em fração do espaçamento. */
const CLUSTER_WIDTH = 0.74
/** Comprimento do traço: base + variação, em fração do espaçamento. Cacho quase quadrado: vizinhos se tocam sem cruzar. */
const STROKE_LENGTH_MIN = 0.62
const STROKE_LENGTH_VARIATION = 0.32
/** Deslize do traço ao longo do próprio eixo (mão que não começa sempre no mesmo ponto). */
const STROKE_SLIDE = 0.2
/** Calombo do ladrilho de borda (fração do espaçamento): mínimo, máximo e folga sorteada além da ponta dos traços. */
const TILE_BULGE_MIN = 0.08
const TILE_BULGE_MAX = 0.6
const TILE_MARGIN_MIN = 0.06
const TILE_MARGIN_VARIATION = 0.14
/** Recuo do calombo junto de lado aberto (chanfro) e avanço junto de vizinho de papel (sem entalhe). */
const TILE_BEVEL = 0.22
const TILE_OVERHANG = 0.15
/** Período do ruído suave da borda, em células: a borda ondula, não serrilha. */
const NOISE_PERIOD_CELLS = 1.1
/** Mistura do ruído: parte suave (onda) + parte por cacho (grão). */
const NOISE_SMOOTH_WEIGHT = 0.85
const NOISE_SMOOTH_CONTRAST = 1.7
/** Além deste alcance (células), cacho sem 2 vizinhos na faixa é ponta solta e sai. */
const SPIKE_FILTER_CELLS = 0.35
/** 3 classes de ângulo em faixas de 40° separadas por 20°: vizinho imediato nunca repete o ângulo. */
const ANGLE_CLASS_DEGREES = 60
const ANGLE_CLASS_OFFSET_DEGREES = 10
const ANGLE_CLASS_SPAN_DEGREES = 40
/** Cacho de dentro do piso ainda ganha papel até esta distância (em espaçamentos): fecha a fresta junto da parede. */
const INSIDE_PAPER_REACH = 1

const SALT_JITTER_X = 1
const SALT_JITTER_Y = 2
const SALT_ANGLE = 3
const SALT_COUNT = 4
const SALT_NOISE_GRAIN = 5
const SALT_NOISE_SMOOTH = 6
const SALT_STROKE = 7
const SALT_PAPER = 8

/** Hash inteiro → [0, 1). Determinístico, sem estado: a mesma célula dá sempre o mesmo número. */
export function hashCell(i: number, j: number, salt: number): number {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Ruído de valor 2D em [-1, 1], contínuo, com período de 1 unidade por nó. */
function valueNoise(x: number, y: number, salt: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const sx = smoothstep(x - xi)
  const sy = smoothstep(y - yi)
  const a = hashCell(xi, yi, salt)
  const b = hashCell(xi + 1, yi, salt)
  const c = hashCell(xi, yi + 1, salt)
  const d = hashCell(xi + 1, yi + 1, salt)
  const top = a + (b - a) * sx
  const bottom = c + (d - c) * sx
  return (top + (bottom - top) * sy) * 2 - 1
}

/**
 * Ruído do alcance da faixa, em CÉLULAS, dentro de ±`HATCH_REACH_NOISE_CELLS`:
 * onda suave (borda orgânica) + grão por cacho (sem contorno uniforme).
 */
export function hatchReachNoise(xCells: number, yCells: number, i: number, j: number): number {
  const smooth = Math.max(-1, Math.min(1, valueNoise(xCells / NOISE_PERIOD_CELLS, yCells / NOISE_PERIOD_CELLS, SALT_NOISE_SMOOTH) * NOISE_SMOOTH_CONTRAST))
  const grain = hashCell(i, j, SALT_NOISE_GRAIN) * 2 - 1
  return HATCH_REACH_NOISE_CELLS * (NOISE_SMOOTH_WEIGHT * smooth + (1 - NOISE_SMOOTH_WEIGHT) * grain)
}

const BUCKET_KEY_OFFSET = 32768
const BUCKET_KEY_BASE = 65536

function bucketKey(bx: number, by: number): number {
  return (bx + BUCKET_KEY_OFFSET) * BUCKET_KEY_BASE + (by + BUCKET_KEY_OFFSET)
}

/** Bucket espacial de segmentos com meia largura: distância até a FACE (centro − meia largura). */
class SegmentIndex {
  private readonly coords: number[] = []
  readonly buckets = new Map<number, number[]>()

  constructor(readonly size: number) {}

  add(ax: number, ay: number, bx: number, by: number, half: number): void {
    const id = this.coords.length / 5
    this.coords.push(ax, ay, bx, by, half)
    const x0 = Math.floor(Math.min(ax, bx) / this.size)
    const x1 = Math.floor(Math.max(ax, bx) / this.size)
    const y0 = Math.floor(Math.min(ay, by) / this.size)
    const y1 = Math.floor(Math.max(ay, by) / this.size)
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const key = bucketKey(gx, gy)
        const list = this.buckets.get(key)
        if (list) list.push(id)
        else this.buckets.set(key, [id])
      }
    }
  }

  /** Menor distância até a face; exata para distâncias até `size` (vizinhança 3 × 3). */
  distance(x: number, y: number): number {
    const gx = Math.floor(x / this.size)
    const gy = Math.floor(y / this.size)
    const c = this.coords
    let best = Infinity
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = this.buckets.get(bucketKey(gx + dx, gy + dy))
        if (!list) continue
        for (const id of list) {
          const o = id * 5
          const ax = c[o]
          const ay = c[o + 1]
          const vx = c[o + 2] - ax
          const vy = c[o + 3] - ay
          const len2 = vx * vx + vy * vy
          let t = len2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / len2 : 0
          t = t < 0 ? 0 : t > 1 ? 1 : t
          const ex = x - (ax + t * vx)
          const ey = y - (ay + t * vy)
          // sqrt, não Math.hypot: hypot é várias vezes mais lento no V8 e isto roda ~10^5 vezes por mapa.
          const d = Math.sqrt(ex * ex + ey * ey) - c[o + 4]
          if (d < best) best = d
        }
      }
    }
    return best
  }
}

interface Ring {
  points: RegionPoint[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function toRing(points: RegionPoint[]): Ring {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { points, minX, minY, maxX, maxY }
}

/** Par-ímpar: ponto dentro do anel? */
function insideRing(ring: Ring, x: number, y: number): boolean {
  if (x < ring.minX || x > ring.maxX || y < ring.minY || y > ring.maxY) return false
  const pts = ring.points
  let inside = false
  for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
    const pa = pts[a]
    const pb = pts[b]
    if (pa.y > y !== pb.y > y && x < ((pb.x - pa.x) * (y - pa.y)) / (pb.y - pa.y) + pa.x) inside = !inside
  }
  return inside
}

interface FloorShape {
  outer: Ring
  holes: Ring[]
}

/**
 * Silhueta do piso como teste de ponto — a MESMA união que `buildFloorMask`
 * desenha (salas com parede + chão por peças com buracos).
 */
export function createFloorPointTest(regions: Region[], walls: Wall[], floorPolygons: FloorPolygon[]): (x: number, y: number) => boolean {
  const shapes: FloorShape[] = []
  for (const region of floorRegions(regions, walls)) shapes.push({ outer: toRing(region.points), holes: [] })
  for (const polygon of floorPolygons) {
    if (polygon.outer.length < 3) continue
    shapes.push({ outer: toRing(polygon.outer), holes: polygon.holes.filter((hole) => hole.length >= 3).map(toRing) })
  }
  return (x, y) => shapes.some((shape) => insideRing(shape.outer, x, y) && !shape.holes.some((hole) => insideRing(hole, x, y)))
}

export interface HatchCluster {
  /** Célula do grid global de cachos (chave de identidade entre mapas). */
  i: number
  j: number
  x: number
  y: number
  /** Ângulo dos traços, em radianos. */
  angle: number
  /** Primeiro índice do cacho em `strokes` (em segmentos) e quantos traços tem. */
  strokeStart: number
  strokeCount: number
}

export interface HatchGeometry {
  grid: number
  /** Espaçamento do grid de cachos, em px de mundo. */
  spacing: number
  clusters: HatchCluster[]
  /** Traços achatados: x1, y1, x2, y2 por segmento. */
  strokes: number[]
  /** Papel do miolo: ladrilhos exatos mesclados por linha, x, y, largura, altura. */
  paperRects: number[]
  /** Papel da borda: ladrilho com calombos nos lados abertos, pontos achatados (x, y, ...). */
  paperPolygons: number[][]
}

export interface HatchGeometryInput {
  walls: Wall[]
  regions: Region[]
  floorPolygons: FloorPolygon[]
  grid: number
}

const CELL_KEY_OFFSET = 1 << 20
const CELL_KEY_BASE = 1 << 21

function cellKey(i: number, j: number): number {
  return (i + CELL_KEY_OFFSET) * CELL_KEY_BASE + (j + CELL_KEY_OFFSET)
}

/** Ângulo contínuo por cacho em 3 classes (i + 2j mod 3): os 4 vizinhos imediatos caem sempre em outra classe. */
export function clusterAngle(i: number, j: number): number {
  const angleClass = (((i + 2 * j) % 3) + 3) % 3
  const degrees = angleClass * ANGLE_CLASS_DEGREES + ANGLE_CLASS_OFFSET_DEGREES + hashCell(i, j, SALT_ANGLE) * ANGLE_CLASS_SPAN_DEGREES
  return (degrees * Math.PI) / 180
}

/**
 * Monta a geometria da faixa. Cacho com traço: centro FORA do piso e distância
 * até a face da parede externa (ou borda do chão por peças) ≤ alcance da faixa
 * + ruído. Papel: o mesmo conjunto + cachos de dentro do piso colados à parede
 * (a máscara inversa apaga o que cair no piso).
 */
export function buildHatchGeometry(input: HatchGeometryInput): HatchGeometry {
  const { grid } = input
  const spacing = grid * HATCH_CLUSTER_SPACING_CELLS
  const empty: HatchGeometry = { grid, spacing, clusters: [], strokes: [], paperRects: [], paperPolygons: [] }
  if (!(grid > 0)) return empty

  const exterior = input.walls.filter((wall) => !isInteriorWall(wall))
  let maxHalf = 0
  for (const wall of exterior) maxHalf = Math.max(maxHalf, wallWidthFor(wall, grid) / 2)
  const maxReach = (HATCH_BAND_CELLS + HATCH_REACH_NOISE_CELLS) * grid
  const searchRadius = Math.max(maxReach, INSIDE_PAPER_REACH * spacing) + maxHalf + 1
  const index = new SegmentIndex(Math.max(grid, searchRadius))

  for (const wall of exterior) index.add(wall.x1, wall.y1, wall.x2, wall.y2, wallWidthFor(wall, grid) / 2)
  for (const polygon of input.floorPolygons) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      if (ring.length < 3) continue
      for (let a = 0; a < ring.length; a++) {
        const p = ring[a]
        const q = ring[(a + 1) % ring.length]
        index.add(p.x, p.y, q.x, q.y, 0)
      }
    }
  }
  if (index.buckets.size === 0) return empty

  const inFloor = createFloorPointTest(input.regions, input.walls, input.floorPolygons)
  // 1 = cacho com traço; 2 = só papel (dentro do piso, colado à parede)
  const kinds = new Map<number, 1 | 2>()
  const visited = new Set<number>()
  // Centro só das células mantidas (visitadas são ~10× mais).
  const centers = new Map<number, [number, number]>()
  const order: number[] = []
  const size = index.size
  const earlyOut = Math.max(maxReach, INSIDE_PAPER_REACH * spacing)

  for (const key of index.buckets.keys()) {
    const gx = Math.floor(key / BUCKET_KEY_BASE) - BUCKET_KEY_OFFSET
    const gy = (key % BUCKET_KEY_BASE) - BUCKET_KEY_OFFSET
    const i0 = Math.floor((gx * size - searchRadius) / spacing) - 1
    const i1 = Math.floor(((gx + 1) * size + searchRadius) / spacing) + 1
    const j0 = Math.floor((gy * size - searchRadius) / spacing) - 1
    const j1 = Math.floor(((gy + 1) * size + searchRadius) / spacing) + 1
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const ck = cellKey(i, j)
        if (visited.has(ck)) continue
        visited.add(ck)
        const x = (i + 0.5 + (hashCell(i, j, SALT_JITTER_X) * 2 - 1) * JITTER) * spacing
        const y = (j + 0.5 + (hashCell(i, j, SALT_JITTER_Y) * 2 - 1) * JITTER) * spacing
        const distance = index.distance(x, y)
        // Longe demais para qualquer caso: nem testa o piso (o teste mais caro).
        if (distance > earlyOut) continue
        if (inFloor(x, y)) {
          if (distance <= INSIDE_PAPER_REACH * spacing) {
            kinds.set(ck, 2)
            centers.set(ck, [x, y])
            order.push(ck)
          }
          continue
        }
        const reach = (HATCH_BAND_CELLS + hatchReachNoise(x / grid, y / grid, i, j)) * grid
        if (distance <= reach) {
          kinds.set(ck, 1)
          centers.set(ck, [x, y])
          order.push(ck)
        }
      }
    }
  }

  // Ponta solta: cacho com traço longe da parede (> SPIKE_FILTER_CELLS) com menos
  // de 2 vizinhos na faixa vira fragmento isolado na borda — sai. Decide sobre o
  // conjunto ANTES do filtro, então o resultado não depende da ordem.
  const spikes = new Set<number>()
  for (const ck of order) {
    if (kinds.get(ck) !== 1) continue
    const i = Math.floor(ck / CELL_KEY_BASE) - CELL_KEY_OFFSET
    const j = (ck % CELL_KEY_BASE) - CELL_KEY_OFFSET
    const [x, y] = centers.get(ck) as [number, number]
    if (index.distance(x, y) <= SPIKE_FILTER_CELLS * grid) continue
    let neighbors = 0
    for (const [di, dj] of NEIGHBORS_4) if (kinds.has(cellKey(i + di, j + dj))) neighbors++
    if (neighbors < 2) spikes.add(ck)
  }
  for (const ck of spikes) kinds.delete(ck)

  // Ordem estável (independe da ordem de inserção dos buckets): coluna, depois linha.
  const kept = order.filter((ck) => !spikes.has(ck)).sort((a, b) => a - b)
  const geometry = empty
  const halfStroke = (grid * HATCH_STROKE_CELLS) / 2
  // Papel sem sobreposição (a pintura sobreposta era o custo dominante por quadro):
  // célula do miolo = ladrilho exato, mesclado por linha; célula da borda = ladrilho
  // com calombo em cada lado aberto, do tamanho dos traços dela.
  const interiorRows = new Map<number, number[]>()
  for (const ck of kept) {
    const i = Math.floor(ck / CELL_KEY_BASE) - CELL_KEY_OFFSET
    const j = (ck % CELL_KEY_BASE) - CELL_KEY_OFFSET
    const [x, y] = centers.get(ck) as [number, number]
    const strokeStart = geometry.strokes.length / 4
    if (kinds.get(ck) === 1) {
      const cluster = clusterShape(i, j, spacing)
      const ux = Math.cos(cluster.angle)
      const uy = Math.sin(cluster.angle)
      for (const s of cluster.strokes) {
        const mx = x - uy * s.offset + ux * s.slide
        const my = y + ux * s.offset + uy * s.slide
        geometry.strokes.push(mx - ux * s.half, my - uy * s.half, mx + ux * s.half, my + uy * s.half)
      }
      geometry.clusters.push({ i, j, x, y, angle: cluster.angle, strokeStart, strokeCount: cluster.strokes.length })
    }

    const open: TileSides = {
      left: !kinds.has(cellKey(i - 1, j)),
      right: !kinds.has(cellKey(i + 1, j)),
      top: !kinds.has(cellKey(i, j - 1)),
      bottom: !kinds.has(cellKey(i, j + 1)),
    }
    if (open.left || open.right || open.top || open.bottom) {
      geometry.paperPolygons.push(borderTile(i, j, spacing, open, geometry.strokes, strokeStart, halfStroke))
    } else {
      const row = interiorRows.get(j)
      if (row) row.push(i)
      else interiorRows.set(j, [i])
    }
  }
  for (const [j, columns] of interiorRows) {
    let runStart = columns[0]
    let previous = columns[0]
    for (let k = 1; k <= columns.length; k++) {
      const i = k < columns.length ? columns[k] : Number.NaN
      if (i === previous + 1) {
        previous = i
        continue
      }
      geometry.paperRects.push(runStart * spacing, j * spacing, (previous - runStart + 1) * spacing, spacing)
      runStart = i
      previous = i
    }
  }
  return geometry
}

interface TileSides {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

/**
 * Ladrilho da célula de borda, em sentido horário: lados com vizinho de papel
 * ficam retos (emendam com o vizinho sem fresta); cada lado ABERTO ganha um
 * calombo de 2 vértices, alto o bastante para conter as pontas dos traços da
 * própria célula + folga sorteada. Canto com os dois lados abertos vira chanfro.
 */
function borderTile(i: number, j: number, s: number, open: TileSides, strokes: number[], from: number, halfStroke: number): number[] {
  const x0 = i * s
  const y0 = j * s
  const x1 = x0 + s
  const y1 = y0 + s
  let top = 0
  let right = 0
  let bottom = 0
  let left = 0
  for (let k = from * 4; k < strokes.length; k += 2) {
    top = Math.max(top, y0 - strokes[k + 1])
    bottom = Math.max(bottom, strokes[k + 1] - y1)
    left = Math.max(left, x0 - strokes[k])
    right = Math.max(right, strokes[k] - x1)
  }
  const bulge = (extent: number, salt: number) => {
    const margin = (TILE_MARGIN_MIN + hashCell(i, j, SALT_PAPER + salt) * TILE_MARGIN_VARIATION) * s
    return Math.min(TILE_BULGE_MAX * s, Math.max(TILE_BULGE_MIN * s, extent + halfStroke + margin))
  }
  // Lado vizinho aberto: o calombo recua (chanfro). Fechado: avança um pouco sobre o vizinho (sem entalhe na emenda).
  const inset = (sideOpen: boolean) => (sideOpen ? TILE_BEVEL : -TILE_OVERHANG) * s
  const points: number[] = []
  if (!(open.left && open.top)) points.push(x0, y0)
  if (open.top) points.push(x0 + inset(open.left), y0 - bulge(top, 1), x1 - inset(open.right), y0 - bulge(top, 2))
  if (!(open.top && open.right)) points.push(x1, y0)
  if (open.right) points.push(x1 + bulge(right, 3), y0 + inset(open.top), x1 + bulge(right, 4), y1 - inset(open.bottom))
  if (!(open.right && open.bottom)) points.push(x1, y1)
  if (open.bottom) points.push(x1 - inset(open.right), y1 + bulge(bottom, 5), x0 + inset(open.left), y1 + bulge(bottom, 6))
  if (!(open.bottom && open.left)) points.push(x0, y1)
  if (open.left) points.push(x0 - bulge(left, 7), y1 - inset(open.bottom), x0 - bulge(left, 8), y0 + inset(open.top))
  return points
}

const NEIGHBORS_4: readonly [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

interface ClusterShape {
  angle: number
  /** Traços em coordenada local: deslocamento perpendicular, deslize ao longo, meio comprimento. */
  strokes: { offset: number; slide: number; half: number }[]
  /** Semi-eixos do retângulo que contém os traços (ao longo, perpendicular). */
  alongHalf: number
  acrossHalf: number
}

/** Forma do cacho (i, j): 4 ou 5 traços paralelos, comprimento e deslize por hash. */
function clusterShape(i: number, j: number, spacing: number): ClusterShape {
  const angle = clusterAngle(i, j)
  // 4 traços quase sempre (custo por quadro: cada traço são 2 triângulos), 5 de vez em quando.
  const count = hashCell(i, j, SALT_COUNT) < FIVE_STROKE_SHARE ? 5 : 4
  const gap = (CLUSTER_WIDTH * spacing) / (count - 1)
  const strokes: ClusterShape['strokes'] = []
  let alongHalf = 0
  for (let m = 0; m < count; m++) {
    const half = ((STROKE_LENGTH_MIN + hashCell(i * 7 + m, j, SALT_STROKE) * STROKE_LENGTH_VARIATION) * spacing) / 2
    const slide = (hashCell(i, j * 7 + m, SALT_STROKE + 1) - 0.5) * STROKE_SLIDE * spacing
    strokes.push({ offset: (m - (count - 1) / 2) * gap, slide, half })
    alongHalf = Math.max(alongHalf, half + Math.abs(slide))
  }
  return { angle, strokes, alongHalf, acrossHalf: (CLUSTER_WIDTH * spacing) / 2 }
}

