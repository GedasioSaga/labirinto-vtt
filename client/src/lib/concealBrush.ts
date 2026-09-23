import type { ConcealZone, MapData, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'

/**
 * PINCEL DE REVELAR E ESCONDER (item 11 de docs/features-candidatas-2026-09-21.md).
 *
 * O mestre arrasta o pincel sobre uma zona oculta e revela para os jogadores
 * SÓ o pedaço pintado (o corredor recém-andado), não a zona inteira; com Alt
 * (ou no modo "Esconder") o mesmo gesto esconde de volta.
 *
 * POR QUE CÉLULAS, e não o traço guardado como polígono: esconder um pedaço do
 * que foi revelado é SUBTRAÇÃO de áreas. Com traços, isso pede recorte de
 * polígono contra polígono (união e diferença de cápsulas) a cada gesto; com
 * uma grade fina é soma e remoção num conjunto. A célula é pequena
 * (`REVEAL_BRUSH_CELL`) perto da grade do mapa, então o degrau não aparece na
 * largura de um corredor.
 *
 * Tudo aqui é puro (sem store, sem Pixi): o editor grava com
 * `paintRevealBrush`, o recorte do jogador (`lib/fogFilter.ts`) pergunta
 * `unveiledCellsOf` e devolve o preto que sobra com `concealedPieces`.
 */

/** Lado da célula do pincel, em px de mundo. Faz parte do formato do arquivo: mudar invalida o que já foi pintado. */
export const REVEAL_BRUSH_CELL = 10

/** O que o arrasto faz: revelar o pedaço pintado ou esconder de volta. */
export type RevealBrushMode = 'revelar' | 'esconder'

/** Largura do pincel em quadrados da grade (diâmetro do traço). */
export type RevealBrushWidth = 1 | 2 | 4

/** Raio do traço, em px de mundo, para a largura escolhida. */
export function revealBrushRadius(grid: number, width: RevealBrushWidth): number {
  return (grid * width) / 2
}

/** Chave `"col,row"` da célula que contém o ponto. */
export function cellKeyAt(point: RegionPoint): string {
  return `${Math.floor(point.x / REVEAL_BRUSH_CELL)},${Math.floor(point.y / REVEAL_BRUSH_CELL)}`
}

const CELL_KEY = /^(-?\d+),(-?\d+)$/

interface Cell {
  col: number
  row: number
}

function parseCellKey(key: string): Cell | null {
  const m = CELL_KEY.exec(key)
  if (m === null) return null
  return { col: Number(m[1]), row: Number(m[2]) }
}

/** Centro da célula, em px de mundo; `null` para chave malformada. */
export function cellCenter(key: string): RegionPoint | null {
  const cell = parseCellKey(key)
  if (cell === null) return null
  return { x: (cell.col + 0.5) * REVEAL_BRUSH_CELL, y: (cell.row + 0.5) * REVEAL_BRUSH_CELL }
}

const EMPTY_CELLS: ReadonlySet<string> = new Set()
/** Cache pela referência do array: o recorte roda por jogador a cada mudança do mapa. */
const cellsCache = new WeakMap<readonly unknown[], ReadonlySet<string>>()

/**
 * Células pintadas da zona. O arquivo não é confiável (map.json editado à mão,
 * versão futura): só entra chave `"col,row"` bem formada. Qualquer outra coisa
 * é descartada, e descartar é errar para o lado de ESCONDER.
 */
export function unveiledCellsOf(zone: ConcealZone): ReadonlySet<string> {
  const raw: unknown = zone.unveiledCells
  if (!Array.isArray(raw) || raw.length === 0) return EMPTY_CELLS
  const cached = cellsCache.get(raw)
  if (cached !== undefined) return cached
  const cells = new Set<string>()
  for (const item of raw) {
    if (typeof item === 'string' && CELL_KEY.test(item)) cells.add(item)
  }
  cellsCache.set(raw, cells)
  return cells
}

function distanceToSegment(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Células cujo CENTRO está a até `radius` do traço (cada par de pontos vira um
 * segmento; um ponto só vira um disco). Traço vazio, ponto não-finito ou raio
 * inválido não pintam nada.
 */
export function strokeCells(stroke: readonly RegionPoint[], radius: number): string[] {
  if (!Number.isFinite(radius) || radius <= 0) return []
  const points = stroke.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  if (points.length === 0) return []
  const segments: [RegionPoint, RegionPoint][] = points.length === 1 ? [[points[0], points[0]]] : []
  for (let i = 1; i < points.length; i += 1) segments.push([points[i - 1], points[i]])

  const out = new Set<string>()
  const C = REVEAL_BRUSH_CELL
  for (const [a, b] of segments) {
    const col0 = Math.floor((Math.min(a.x, b.x) - radius) / C)
    const col1 = Math.floor((Math.max(a.x, b.x) + radius) / C)
    const row0 = Math.floor((Math.min(a.y, b.y) - radius) / C)
    const row1 = Math.floor((Math.max(a.y, b.y) + radius) / C)
    for (let row = row0; row <= row1; row += 1) {
      for (let col = col0; col <= col1; col += 1) {
        const center = { x: (col + 0.5) * C, y: (row + 0.5) * C }
        if (distanceToSegment(center, a, b) <= radius) out.add(`${col},${row}`)
      }
    }
  }
  return [...out]
}

/** Zona que o pincel pode pintar: ativa (ainda esconde) e com área. */
function isPaintable(zone: ConcealZone): boolean {
  return !zone.revealed && zone.points.length >= 3
}

/** Zona com as células novas; lista vazia tira o campo (zona volta a ser a de sempre). */
function withCells(zone: ConcealZone, cells: ReadonlySet<string>): ConcealZone {
  const next: ConcealZone = { ...zone }
  if (cells.size === 0) delete next.unveiledCells
  else next.unveiledCells = [...cells].sort()
  return next
}

export interface RevealBrushResult {
  /** O mapa depois do traço; o MESMO objeto quando nada mudou (sem entrada vazia no Ctrl+Z). */
  map: MapData
  /** O traço passou por dentro de pelo menos uma zona oculta ativa. */
  hitZone: boolean
}

/**
 * Aplica um traço do pincel. Revelar grava só as células com centro DENTRO de
 * cada zona ativa que o traço cruza; esconder tira do conjunto as células do
 * traço. Zona já revelada inteira não recebe pincel: o traço não teria efeito
 * nenhum na tela do jogador e voltaria a valer, sem aviso, quando o mestre
 * escondesse a zona de novo.
 */
export function paintRevealBrush(map: MapData, stroke: readonly RegionPoint[], radius: number, mode: RevealBrushMode): RevealBrushResult {
  const cells = strokeCells(stroke, radius)
  if (cells.length === 0) return { map, hitZone: false }
  let hitZone = false
  let changed = false
  const zones = (map.concealZones ?? []).map((zone) => {
    if (!isPaintable(zone)) return zone
    const inside = cells.filter((key) => {
      const center = cellCenter(key)
      return center !== null && pointInRing(center, zone.points)
    })
    if (inside.length === 0) return zone
    hitZone = true
    const current = unveiledCellsOf(zone)
    const next = new Set(current)
    if (mode === 'revelar') for (const key of inside) next.add(key)
    else for (const key of inside) next.delete(key)
    if (next.size === current.size && [...next].every((key) => current.has(key))) return zone
    changed = true
    return withCells(zone, next)
  })
  return { map: changed ? { ...map, concealZones: zones } : map, hitZone }
}

type Clip = (points: RegionPoint[]) => RegionPoint[]

/** Um lado do recorte de Sutherland–Hodgman: fica o que `inside` aceita; a aresta que cruza ganha o ponto de corte. */
function clipSide(inside: (p: RegionPoint) => boolean, cross: (a: RegionPoint, b: RegionPoint) => RegionPoint): Clip {
  return (points) => {
    const out: RegionPoint[] = []
    for (let i = 0; i < points.length; i += 1) {
      const cur = points[i]
      const prev = points[(i + points.length - 1) % points.length]
      const curIn = inside(cur)
      if (curIn !== inside(prev)) out.push(cross(prev, cur))
      if (curIn) out.push(cur)
    }
    return out
  }
}

const atX = (x: number) => (a: RegionPoint, b: RegionPoint): RegionPoint => ({ x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) })
const atY = (y: number) => (a: RegionPoint, b: RegionPoint): RegionPoint => ({ x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y), y })

/**
 * O polígono recortado por um retângulo alinhado aos eixos. Serve para
 * polígono côncavo também: o resultado pode ter aresta de ida e volta sobre a
 * borda do retângulo, que não muda a área pintada.
 */
function clipToRect(ring: RegionPoint[], x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  let out = ring
  const sides: Clip[] = [
    clipSide((p) => p.x >= x0, atX(x0)),
    clipSide((p) => p.x <= x1, atX(x1)),
    clipSide((p) => p.y >= y0, atY(y0)),
    clipSide((p) => p.y <= y1, atY(y1)),
  ]
  for (const side of sides) {
    if (out.length === 0) break
    out = side(out)
  }
  return out
}

/** Área mínima, em px² de mundo, para uma peça valer: abaixo disso é resto de arredondamento. */
const MIN_PIECE_AREA = 1e-3

function area(points: readonly RegionPoint[]): number {
  let s = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

/** Colunas de cada linha de células (chave malformada fica de fora). */
function cellsByRow(cells: Iterable<string>): Map<number, number[]> {
  const byRow = new Map<number, number[]>()
  for (const key of cells) {
    const cell = parseCellKey(key)
    if (cell === null) continue
    const cols = byRow.get(cell.row)
    if (cols === undefined) byRow.set(cell.row, [cell.col])
    else cols.push(cell.col)
  }
  return byRow
}

/** Colunas de uma linha fundidas em trechos contínuos `[de, até)`. */
function runsOf(cols: number[]): [number, number][] {
  const sorted = [...cols].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const col of sorted) {
    const last = runs[runs.length - 1]
    if (last !== undefined && col <= last[1]) last[1] = Math.max(last[1], col + 1)
    else runs.push([col, col + 1])
  }
  return runs
}

/**
 * As células como retângulos de mundo, uma linha de células por vez com as
 * colunas vizinhas fundidas (`runsOf`). É a forma que o recorte do jogador
 * soma à visão enviada: o pedaço revelado que ele enxerga.
 */
export function cellRunRects(cells: Iterable<string>): RegionPoint[][] {
  const byRow = cellsByRow(cells)
  const C = REVEAL_BRUSH_CELL
  const rects: RegionPoint[][] = []
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    for (const [from, to] of runsOf(byRow.get(row) ?? [])) {
      rects.push([
        { x: from * C, y: row * C },
        { x: to * C, y: row * C },
        { x: to * C, y: (row + 1) * C },
        { x: from * C, y: (row + 1) * C },
      ])
    }
  }
  return rects
}

/**
 * O PRETO QUE SOBRA de uma zona com `cells` reveladas: a zona recortada em
 * peças que não cobrem nenhuma dessas células. É o que o jogador pinta de preto
 * (`snapshot.concealed`), e é por isso que o formato do fio não muda — o
 * jogador de antes desta peça continua desenhando polígono por polígono.
 *
 * Faixas horizontais da altura de uma célula: linha sem célula revelada vira
 * uma faixa só (fundida com as vizinhas); linha com célula revelada vira os
 * trechos ENTRE os buracos. Sem célula, devolve a zona inteira, como sempre.
 */
export function concealedPieces(ring: RegionPoint[], cells: Iterable<string>): RegionPoint[][] {
  const byRow = cellsByRow(cells)
  if (byRow.size === 0 || ring.length < 3) return [ring]

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of ring) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  const C = REVEAL_BRUSH_CELL
  const pieces: RegionPoint[][] = []
  const keep = (x0: number, y0: number, x1: number, y1: number): void => {
    if (x1 <= x0 || y1 <= y0) return
    const piece = clipToRect(ring, x0, y0, x1, y1)
    if (piece.length >= 3 && area(piece) > MIN_PIECE_AREA) pieces.push(piece)
  }

  let y = minY
  const rows = [...byRow.keys()].filter((row) => (row + 1) * C > minY && row * C < maxY).sort((a, b) => a - b)
  for (const row of rows) {
    const top = row * C
    const bottom = (row + 1) * C
    keep(minX, y, maxX, top)
    let x = minX
    for (const [from, to] of runsOf(byRow.get(row) ?? [])) {
      keep(x, top, from * C, bottom)
      x = Math.max(x, to * C)
    }
    keep(x, top, maxX, bottom)
    y = Math.max(y, bottom)
  }
  keep(minX, y, maxX, maxY)
  return pieces
}
