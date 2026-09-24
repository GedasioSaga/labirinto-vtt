import type { FloorPiece, RegionPoint } from '../types/map'
import { compileFloor, type CompiledFloor } from './floorSdf'
import { simplifyPolygon } from './regionSmoothing'

/**
 * Extrai o contorno do chão (lib/floorSdf.ts) em anéis fechados: amostra a
 * distância numa grade e roda marching squares com interpolação linear. Anel
 * externo e buraco saem com orientação oposta; `buildFloorOutline` agrupa cada
 * buraco dentro do menor anel externo que o contém, que é o formato que o
 * render (pixi/drawFloor.ts) precisa para `fill()` + `cut()`.
 */

export interface FloorPolygon {
  outer: RegionPoint[]
  holes: RegionPoint[][]
}

export interface ContourOptions {
  /** Distância entre amostras, em px de mundo. Menor = mais fiel, mais lento. */
  step?: number
  /** Desvio máximo aceito na simplificação, em px de mundo. 0 desliga. */
  tolerance?: number
}

const DEFAULT_STEP = 2
const DEFAULT_TOLERANCE = 0.35

export function signedArea(ring: RegionPoint[]): number {
  let area = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += ring[j].x * ring[i].y - ring[i].x * ring[j].y
  }
  return area / 2
}

export function pointInRing(point: RegionPoint, ring: RegionPoint[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[j]
    const b = ring[i]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Marching squares sobre `values` (cols × rows, linha a linha). Dentro = valor
 * negativo. A borda da grade precisa estar fora (valor positivo) para todo
 * anel fechar — `extractFloorRings` garante isso com uma moldura.
 */
export function marchingSquares(
  values: Float32Array,
  cols: number,
  rows: number,
  originX: number,
  originY: number,
  step: number,
): RegionPoint[][] {
  const at = (i: number, j: number) => values[j * cols + i]
  // Id de aresta compartilhado entre células vizinhas: horizontal (i,j)-(i+1,j) = par; vertical (i,j)-(i,j+1) = ímpar.
  const hEdge = (i: number, j: number) => (j * cols + i) * 2
  const vEdge = (i: number, j: number) => (j * cols + i) * 2 + 1
  const edgePoint = new Map<number, RegionPoint>()
  const next = new Map<number, number>()

  const crossing = (edge: number, x0: number, y0: number, v0: number, x1: number, y1: number, v1: number) => {
    if (!edgePoint.has(edge)) {
      const t = v0 / (v0 - v1)
      edgePoint.set(edge, { x: originX + (x0 + (x1 - x0) * t) * step, y: originY + (y0 + (y1 - y0) * t) * step })
    }
  }

  for (let j = 0; j + 1 < rows; j += 1) {
    for (let i = 0; i + 1 < cols; i += 1) {
      // Cantos no sentido horário da tela: a (topo-esq), b (topo-dir), c (baixo-dir), d (baixo-esq).
      const corners = [
        { x: i, y: j, v: at(i, j) },
        { x: i + 1, y: j, v: at(i + 1, j) },
        { x: i + 1, y: j + 1, v: at(i + 1, j + 1) },
        { x: i, y: j + 1, v: at(i, j + 1) },
      ]
      const edges = [hEdge(i, j), vEdge(i + 1, j), hEdge(i, j + 1), vEdge(i, j)]
      const entries: number[] = []
      const exits: number[] = []
      const order: { edge: number; entry: boolean }[] = []
      for (let k = 0; k < 4; k += 1) {
        const p = corners[k]
        const q = corners[(k + 1) % 4]
        const pIn = p.v < 0
        const qIn = q.v < 0
        if (pIn === qIn) continue
        crossing(edges[k], p.x, p.y, p.v, q.x, q.y, q.v)
        order.push({ edge: edges[k], entry: !pIn })
      }
      if (order.length === 0) continue
      // Gira a lista para começar numa entrada: [entrada1, saída1, entrada2, saída2].
      while (!order[0].entry) order.push(order.shift() as { edge: number; entry: boolean })
      for (let k = 0; k < order.length; k += 2) {
        entries.push(order[k].edge)
        exits.push(order[k + 1].edge)
      }
      if (entries.length === 1) {
        next.set(exits[0], entries[0])
      } else {
        // Sela: o centro decide se as duas partes de dentro se ligam.
        const center = (corners[0].v + corners[1].v + corners[2].v + corners[3].v) / 4
        if (center < 0) {
          next.set(exits[0], entries[1])
          next.set(exits[1], entries[0])
        } else {
          next.set(exits[0], entries[0])
          next.set(exits[1], entries[1])
        }
      }
    }
  }

  const rings: RegionPoint[][] = []
  const visited = new Set<number>()
  for (const start of next.keys()) {
    if (visited.has(start)) continue
    const ring: RegionPoint[] = []
    let edge: number | undefined = start
    while (edge !== undefined && !visited.has(edge)) {
      visited.add(edge)
      ring.push(edgePoint.get(edge) as RegionPoint)
      edge = next.get(edge)
    }
    if (ring.length >= 3) rings.push(ring)
  }
  return rings
}

/** Uma amostra grossa a cada tantas finas. */
const COARSE_FACTOR = 8

/**
 * Amostra o campo na grade fina, mas só calcula de verdade perto da borda.
 * Primeiro amostra uma grade grossa; numa célula grossa em que algum canto tem
 * |d| maior que o quanto o campo consegue variar até qualquer ponto da célula
 * (mais 2 passos finos de folga), o sinal é o mesmo na célula inteira e nenhuma
 * aresta fina dali cruza a borda — as amostras finas recebem só esse sinal.
 * O resultado dá exatamente os mesmos anéis que amostrar tudo.
 */
export function sampleFloorGrid(
  compiled: CompiledFloor,
  originX: number,
  originY: number,
  cols: number,
  rows: number,
  step: number,
): Float32Array {
  const { sample, lipschitz } = compiled
  const coarseStep = step * COARSE_FACTOR
  const coarseCols = Math.ceil((cols - 1) / COARSE_FACTOR) + 1
  const coarseRows = Math.ceil((rows - 1) / COARSE_FACTOR) + 1
  const coarse = new Float32Array(coarseCols * coarseRows)
  for (let cj = 0; cj < coarseRows; cj += 1) {
    for (let ci = 0; ci < coarseCols; ci += 1) {
      coarse[cj * coarseCols + ci] = sample(originX + ci * coarseStep, originY + cj * coarseStep)
    }
  }

  const reach = lipschitz * (coarseStep * Math.SQRT2 + 2 * step)
  const uniformSign = new Float32Array((coarseCols - 1) * (coarseRows - 1))
  for (let cj = 0; cj + 1 < coarseRows; cj += 1) {
    for (let ci = 0; ci + 1 < coarseCols; ci += 1) {
      const corners = [
        coarse[cj * coarseCols + ci],
        coarse[cj * coarseCols + ci + 1],
        coarse[(cj + 1) * coarseCols + ci],
        coarse[(cj + 1) * coarseCols + ci + 1],
      ]
      const strongest = corners.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))
      uniformSign[cj * (coarseCols - 1) + ci] = Math.abs(strongest) > reach ? Math.sign(strongest) : 0
    }
  }

  const values = new Float32Array(cols * rows)
  const probe = step * SEAM_PROBE_FRACTION
  for (let j = 0; j < rows; j += 1) {
    const cj = Math.min(Math.floor(j / COARSE_FACTOR), coarseRows - 2)
    for (let i = 0; i < cols; i += 1) {
      const ci = Math.min(Math.floor(i / COARSE_FACTOR), coarseCols - 2)
      const sign = uniformSign[cj * (coarseCols - 1) + ci]
      values[j * cols + i] = sign !== 0 ? sign * coarseStep : sampleAcrossSeam(sample, originX + i * step, originY + j * step, probe)
    }
  }
  return values
}

/** Módulo abaixo do qual a amostra está EM CIMA de uma borda (e pode ser costura). */
const SEAM_ZERO = 1e-6
/** Distância das amostras de prova da costura, em fração do passo da grade. */
const SEAM_PROBE_FRACTION = 0.25

/**
 * COSTURA entre peças que se tocam. Na divisa de duas peças encostadas (o
 * balde enche exatamente o vão que o chão em volta deixa) a distância das duas
 * é 0, e 0 conta como fora: saía uma linha de contorno no meio do chão, que o
 * render desenha e a visão (`lib/visibility.ts`) usa como parede. Amostra em
 * cima de borda vira "dentro" quando há chão dos DOIS lados dela, na
 * horizontal ou na vertical, ou nas QUATRO diagonais (o canto onde duas
 * divisas se cruzam, em que as provas em cruz caem de novo em borda). Na borda
 * de verdade um dos lados é vazio, e ela fica como estava.
 */
function sampleAcrossSeam(sample: CompiledFloor['sample'], x: number, y: number, probe: number): number {
  const value = sample(x, y)
  if (Math.abs(value) > SEAM_ZERO || value < 0) return value
  const inside = (dx: number, dy: number): boolean => sample(x + dx * probe, y + dy * probe) < 0
  const across =
    (inside(-1, 0) && inside(1, 0)) || (inside(0, -1) && inside(0, 1)) || (inside(-1, -1) && inside(1, -1) && inside(1, 1) && inside(-1, 1))
  return across ? -SEAM_ZERO : value
}

function boundingDiagonal(ring: RegionPoint[]): number {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of ring) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return Math.hypot(maxX - minX, maxY - minY)
}

/** Anéis fechados do chão, sem agrupar. Externos e buracos têm sinal de área oposto. */
export function extractFloorRings(pieces: FloorPiece[], options: ContourOptions = {}): RegionPoint[][] {
  const step = options.step ?? DEFAULT_STEP
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE
  const compiled = compileFloor(pieces)
  const { bounds } = compiled
  if (!bounds) return []

  // Moldura de 2 amostras fora do chão: garante borda da grade positiva.
  const originX = Math.floor(bounds.minX / step) * step - step * 2
  const originY = Math.floor(bounds.minY / step) * step - step * 2
  const cols = Math.ceil((bounds.maxX - originX) / step) + 3
  const rows = Math.ceil((bounds.maxY - originY) / step) + 3
  const values = sampleFloorGrid(compiled, originX, originY, cols, rows, step)
  for (let i = 0; i < cols; i += 1) {
    values[i] = 1
    values[(rows - 1) * cols + i] = 1
  }
  for (let j = 0; j < rows; j += 1) {
    values[j * cols] = 1
    values[j * cols + cols - 1] = 1
  }

  const rings = marchingSquares(values, cols, rows, originX, originY, step)
  if (tolerance <= 0) return rings
  return rings.map((ring) => {
    const diagonal = boundingDiagonal(ring)
    return diagonal > 0 ? simplifyPolygon(ring, tolerance / diagonal) : ring
  })
}

/** Agrupa os anéis em polígonos com buracos, maior primeiro. */
export function buildFloorOutline(pieces: FloorPiece[], options: ContourOptions = {}): FloorPolygon[] {
  const rings = extractFloorRings(pieces, options)
  if (rings.length === 0) return []
  const withArea = rings.map((ring) => ({ ring, area: signedArea(ring) }))
  // O maior anel é sempre externo: o sinal dele define a orientação "externa".
  const outerSign = Math.sign(withArea.reduce((a, b) => (Math.abs(b.area) > Math.abs(a.area) ? b : a)).area)
  const outers = withArea.filter((r) => Math.sign(r.area) === outerSign).sort((a, b) => Math.abs(b.area) - Math.abs(a.area))
  const holes = withArea.filter((r) => Math.sign(r.area) !== outerSign)
  const polygons: FloorPolygon[] = outers.map((o) => ({ outer: o.ring, holes: [] }))

  for (const hole of holes) {
    let owner = -1
    for (let k = 0; k < outers.length; k += 1) {
      if (pointInRing(hole.ring[0], outers[k].ring)) owner = k // menor que contém vence: lista está do maior para o menor
    }
    if (owner >= 0) polygons[owner].holes.push(hole.ring)
  }
  return polygons
}
