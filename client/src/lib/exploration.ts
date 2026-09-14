import type { MapData, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'

/**
 * Memória do que um jogador já viu: um bitset de células sobre o mapa. O
 * mestre é a autoridade (marca com os anéis de visão e decide o que da planta
 * sai para o jogador); o jogador só recebe o bitset para desenhar a névoa
 * escurecida. Ordem dos bits: índice `row * cols + col`, byte `índice >> 3`,
 * bit `índice & 7` a partir do menos significativo.
 */

/** Teto de células: 1.000.000 bits = 125 KB antes do base64, por mensagem. */
export const MAX_EXPLORED_CELLS = 1_000_000
/** Célula mínima em px de mundo: abaixo disso o bitset cresce sem ganho visível. */
export const MIN_EXPLORED_CELL = 8
/** Uma célula por quarto de quadrado da grade: segue a borda da visão sem serrilhado grosseiro. */
const CELLS_PER_GRID = 4

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/
/** `String.fromCharCode(...bytes)` estoura a pilha com array grande: converte em pedaços. */
const BASE64_CHUNK = 0x8000

export interface ExploredWire {
  cell: number
  cols: number
  rows: number
  bits: string
}

export interface Exploration {
  cell: number
  cols: number
  rows: number
  bits: Uint8Array
}

function byteLength(cols: number, rows: number): number {
  return Math.ceil((cols * rows) / 8)
}

export function createExploration(map: Pick<MapData, 'width' | 'height' | 'grid'>): Exploration {
  const grid = Number.isFinite(map.grid) && map.grid > 0 ? map.grid : 0
  let cell = Math.max(MIN_EXPLORED_CELL, grid / CELLS_PER_GRID)
  const width = Number.isFinite(map.width) && map.width > 0 ? map.width : 1
  const height = Number.isFinite(map.height) && map.height > 0 ? map.height : 1
  // Mapa enorme: engrossa a célula até caber no teto em vez de recusar o mapa.
  while (Math.ceil(width / cell) * Math.ceil(height / cell) > MAX_EXPLORED_CELLS) cell *= 2
  const cols = Math.ceil(width / cell)
  const rows = Math.ceil(height / cell)
  return { cell, cols, rows, bits: new Uint8Array(byteLength(cols, rows)) }
}

function setRun(exp: Exploration, row: number, colStart: number, colEnd: number): void {
  const base = row * exp.cols
  for (let col = colStart; col < colEnd; col += 1) {
    const index = base + col
    exp.bits[index >> 3] |= 1 << (index & 7)
  }
}

function isCellSet(exp: Exploration, col: number, row: number): boolean {
  const index = row * exp.cols + col
  return ((exp.bits[index >> 3] ?? 0) & (1 << (index & 7))) !== 0
}

/**
 * Recuo das linhas de amostra da borda de cima e de baixo da célula, em fração
 * da célula. Sem ele, anel alinhado à borda da célula (regra semiaberta do
 * cruzamento) nunca marcaria a última linha; é pequeno demais para uma parede
 * caber entre a borda e a amostra.
 */
const ROW_EDGE_INSET = 1e-6

/** Trechos `[l, r]` da linha horizontal `y` dentro do anel (regra par-ímpar, igual a `pointInRing`). */
function insideSpans(ring: readonly RegionPoint[], y: number, xs: number[]): number[] {
  xs.length = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[j]
    const b = ring[i]
    if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
  }
  xs.sort((u, v) => u - v)
  if (xs.length % 2 === 1) xs.length -= 1
  return xs
}

/** Interseção de duas listas ordenadas de trechos `[l0, r0, l1, r1, ...]`. */
function intersectSpans(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = []
  let i = 0
  let j = 0
  while (i + 1 < a.length && j + 1 < b.length) {
    const l = Math.max(a[i], b[j])
    const r = Math.min(a[i + 1], b[j + 1])
    if (r > l) out.push(l, r)
    if (a[i + 1] < b[j + 1]) i += 2
    else j += 2
  }
  return out
}

/** Um lado do recorte de Liang–Barsky; devolve `null` quando o segmento sai inteiro. */
function clipSide(p: number, q: number, range: [number, number]): [number, number] | null {
  if (p === 0) return q < 0 ? null : range
  const r = q / p
  if (p < 0) {
    if (r > range[1]) return null
    return r > range[0] ? [r, range[1]] : range
  }
  if (r < range[0]) return null
  return r < range[1] ? [range[0], r] : range
}

/** Segmento `a→b` cruza ou encosta no retângulo FECHADO. */
function segmentTouchesRect(a: RegionPoint, b: RegionPoint, minX: number, minY: number, maxX: number, maxY: number): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let range: [number, number] | null = [0, 1]
  range = clipSide(-dx, a.x - minX, range)
  if (range) range = clipSide(dx, maxX - a.x, range)
  if (range) range = clipSide(-dy, a.y - minY, range)
  if (range) range = clipSide(dy, maxY - a.y, range)
  return range !== null
}

/**
 * Polígono toca o retângulo: alguma aresta cruza/encosta nele, ou o retângulo
 * está inteiro dentro (o centro basta, já que nenhuma aresta o cruza).
 */
export function ringTouchesRect(ring: RegionPoint[], minX: number, minY: number, maxX: number, maxY: number): boolean {
  if (ring.length < 3) return false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    if (segmentTouchesRect(ring[j], ring[i], minX, minY, maxX, maxY)) return true
  }
  return pointInRing({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, ring)
}

interface ZoneBox {
  ring: RegionPoint[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function zoneBoxes(zones: readonly RegionPoint[][]): ZoneBox[] {
  return zones.flatMap((ring) => {
    if (ring.length < 3) return []
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of ring) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    return Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY) ? [{ ring, minX, minY, maxX, maxY }] : []
  })
}

/**
 * Marca as células de `colStart` a `colEnd` (exclusivo) da linha, pulando as
 * que tocam alguma zona oculta. Sem zona na faixa da linha, marca o trecho
 * inteiro de uma vez (caminho de sempre).
 */
function setRunOutsideZones(exp: Exploration, row: number, colStart: number, colEnd: number, zones: readonly ZoneBox[]): void {
  const y0 = row * exp.cell
  const y1 = y0 + exp.cell
  const rowZones = zones.filter((z) => z.maxY >= y0 && z.minY <= y1)
  if (rowZones.length === 0) {
    setRun(exp, row, colStart, colEnd)
    return
  }
  for (let col = colStart; col < colEnd; col += 1) {
    const x0 = col * exp.cell
    const x1 = x0 + exp.cell
    const blocked = rowZones.some((z) => z.maxX >= x0 && z.minX <= x1 && ringTouchesRect(z.ring, x0, y0, x1, y1))
    if (!blocked) setRun(exp, row, col, col + 1)
  }
}

/**
 * Marca só as células INTEIRAS dentro de algum anel: a borda de cima, o meio e
 * a borda de baixo da célula (logo, os 4 cantos, o centro e os pontos médios
 * das 4 arestas) precisam estar dentro do mesmo trecho do anel. Célula que só
 * encosta na visão fica de fora, então parede que corta a célula nunca deixa
 * o outro lado explorado, com célula mínima desalinhada ou célula dobrada.
 * Varredura por linha: cruza cada aresta com as 3 linhas da célula, em vez de
 * testar cada célula contra o anel inteiro (anel de visão tem ~mil vértices).
 *
 * `concealed`: zonas ocultas ativas. Célula que toca qualquer uma delas nunca
 * é marcada, mesmo inteira dentro da visão.
 */
export function markRings(exp: Exploration, rings: readonly (readonly RegionPoint[])[], concealed: readonly RegionPoint[][] = []): void {
  const { cell, cols, rows } = exp
  const top: number[] = []
  const mid: number[] = []
  const bottom: number[] = []
  const inset = cell * ROW_EDGE_INSET
  const zones = zoneBoxes(concealed)
  for (const ring of rings) {
    if (ring.length < 3) continue
    let minY = Infinity
    let maxY = -Infinity
    for (const p of ring) {
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) continue
    const rowStart = Math.max(0, Math.floor(minY / cell))
    const rowEnd = Math.min(rows - 1, Math.floor(maxY / cell))
    for (let row = rowStart; row <= rowEnd; row += 1) {
      const y0 = row * cell
      const spans = intersectSpans(
        intersectSpans(insideSpans(ring, y0 + inset, top), insideSpans(ring, y0 + cell / 2, mid)),
        insideSpans(ring, y0 + cell - inset, bottom),
      )
      for (let k = 0; k + 1 < spans.length; k += 2) {
        // Célula [col * cell, (col + 1) * cell] contida em [spans[k], spans[k+1]].
        const colStart = Math.max(0, Math.ceil(spans[k] / cell))
        const colEnd = Math.min(cols, Math.floor(spans[k + 1] / cell))
        if (colEnd > colStart) setRunOutsideZones(exp, row, colStart, colEnd, zones)
      }
    }
  }
}

/**
 * "Revelar planta" do mestre: marca o mapa inteiro, menos as células que tocam
 * zona oculta ativa (mesma regra de `markRings`, senão a planta escondida
 * vazaria pela memória).
 */
export function markAll(exp: Exploration, concealed: readonly RegionPoint[][] = []): void {
  const zones = zoneBoxes(concealed)
  for (let row = 0; row < exp.rows; row += 1) setRunOutsideZones(exp, row, 0, exp.cols, zones)
}

export function isPointExplored(exp: Exploration, point: RegionPoint): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false
  const col = Math.floor(point.x / exp.cell)
  const row = Math.floor(point.y / exp.cell)
  if (col < 0 || row < 0 || col >= exp.cols || row >= exp.rows) return false
  return isCellSet(exp, col, row)
}

/** Mesma regra de amostragem da visão: basta um ponto amostrado explorado. */
export function isShapeExplored(exp: Exploration, points: readonly RegionPoint[]): boolean {
  return points.some((p) => isPointExplored(exp, p))
}

export function encodeExploration(exp: Exploration): ExploredWire {
  let binary = ''
  for (let i = 0; i < exp.bits.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...exp.bits.subarray(i, i + BASE64_CHUNK))
  }
  return { cell: exp.cell, cols: exp.cols, rows: exp.rows, bits: btoa(binary) }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Vem pela rede: qualquer campo fora do formato devolve `null`, nunca lança. */
export function decodeExploration(wire: unknown): Exploration | null {
  if (typeof wire !== 'object' || wire === null || Array.isArray(wire)) return null
  const { cell, cols, rows, bits } = wire as Record<string, unknown>
  if (typeof cell !== 'number' || !Number.isFinite(cell) || cell <= 0) return null
  if (!isPositiveInteger(cols) || !isPositiveInteger(rows)) return null
  if (cols * rows > MAX_EXPLORED_CELLS) return null
  if (typeof bits !== 'string') return null
  const bytes = byteLength(cols, rows)
  // Confere o tamanho antes do atob: string gigante não chega a ser decodificada.
  if (bits.length !== Math.ceil(bytes / 3) * 4 || !BASE64_PATTERN.test(bits)) return null
  let binary: string
  try {
    binary = atob(bits)
  } catch {
    return null
  }
  if (binary.length !== bytes) return null
  const out = new Uint8Array(bytes)
  for (let i = 0; i < bytes; i += 1) out[i] = binary.charCodeAt(i)
  return { cell, cols, rows, bits: out }
}

/**
 * Chama `visit` para cada trecho contínuo de células exploradas de uma linha.
 * `colEnd` é exclusivo: o retângulo do trecho é
 * `x = colStart * cell`, `largura = (colEnd - colStart) * cell`.
 */
export function forEachExploredRun(exp: Exploration, visit: (row: number, colStart: number, colEnd: number) => void): void {
  for (let row = 0; row < exp.rows; row += 1) {
    let start = -1
    for (let col = 0; col < exp.cols; col += 1) {
      const set = isCellSet(exp, col, row)
      if (set && start < 0) start = col
      else if (!set && start >= 0) {
        visit(row, start, col)
        start = -1
      }
    }
    if (start >= 0) visit(row, start, exp.cols)
  }
}

/** Quantidade de células exploradas (para `data-explored-cells` e testes). */
export function countExploredCells(exp: Exploration): number {
  let total = 0
  forEachExploredRun(exp, (_row, colStart, colEnd) => {
    total += colEnd - colStart
  })
  return total
}
