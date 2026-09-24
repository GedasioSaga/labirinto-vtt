/**
 * CENA GRANDE NO CELULAR — recorte de DESENHO da tela do jogador.
 *
 * O jogador recebe a planta inteira da cena (chão e paredes sem porta vão
 * inteiros por decisão do usuário, `lib/fogFilter.ts`), e a tela desenhava
 * tudo: numa cena de 2.828 salas, milhares de paredes e peças de chão viravam
 * geometria no Pixi mesmo debaixo da névoa preta, que é opaca. Aqui se escolhe
 * o que vale desenhar: o que está perto da ficha (a visão de agora) e o que o
 * jogador já viu (o explorado). O resto está inteiro debaixo do preto, então
 * sumir com ele não muda nenhum pixel que o jogador enxerga.
 *
 * Isto NÃO é o recorte da rede — o que o jogador pode saber continua sendo
 * decidido só pelo mestre (`filterMapForPlayer`). Nada aqui sai do aparelho.
 *
 * Como o custo não cresce com a cena: o mapa é dividido em pedaços quadrados
 * (`ChunkLayout`) e cada item é guardado nos pedaços que a caixa dele toca.
 * O índice é montado quando a PLANTA muda, não a cada mensagem: todo snapshot
 * ou delta traz arrays recém-parseados, então o recortador compara o conteúdo
 * com a planta anterior e, igual, reaproveita o índice (`indexed: 0`). A
 * comparação é uma varredura sem alocar índice, da mesma ordem do
 * `JSON.parse` que trouxe a mensagem (e do `floorKey` da tela); montar de novo
 * só quando o mestre mexe na planta. O recorte só abre os pedaços que o
 * jogador conhece, então examina os itens da vizinhança — nunca a lista inteira.
 */
import type { Exploration } from '../lib/exploration'
import { pieceBounds } from '../lib/floorSdf'
import type { FloorPiece, MapData, RegionPoint, Wall } from '../types/map'

/** Lado do pedaço do índice, em células de grade. */
export const CULL_CHUNK_GRID_CELLS = 8
/** Pedaço nunca menor que isto (px de mundo): grade minúscula não vira milhões de pedaços. */
const MIN_CHUNK_PX = 64
/** Teto de pedaços: mapa gigantesco engrossa o pedaço em vez de estourar a memória do celular. */
const MAX_CHUNKS = 65_536
/**
 * Item cuja caixa cobre mais pedaços que isto vai para a lista "sempre": a
 * inserção fica limitada e o item (um chão que cobre o bairro, uma muralha)
 * continua desenhado.
 */
const MAX_CHUNKS_PER_ITEM = 64
/**
 * Folga em volta do que o jogador conhece, em células de grade. Cobre o traço
 * da parede (largura em px de TELA: afastado, vira muitos px de mundo) e a
 * amostragem do contorno do chão perto da borda da névoa.
 */
export const KNOWN_PAD_GRID_CELLS = 2

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface ChunkLayout {
  size: number
  cols: number
  rows: number
  width: number
  height: number
}

interface ChunkIndex {
  layoutKey: string
  /** Pedaço (`row * cols + col`) → posições dos itens no array original. */
  buckets: Map<number, number[]>
  /** Itens sem caixa decidível, fora do retângulo do mapa ou grandes demais: sempre desenhados. */
  always: number[]
}

/**
 * O que a tela do jogador desenha da planta, com a medida do custo da chamada:
 * `examined` = itens percorridos pelo recorte; `indexed` = itens inseridos no
 * índice nesta chamada (0 quando a planta é a mesma da chamada anterior).
 */
export interface PlayerDrawSet {
  walls: Wall[]
  floor: FloorPiece[]
  examined: number
  indexed: number
}

export interface PlayerCuller {
  cull: (
    map: Pick<MapData, 'width' | 'height' | 'grid' | 'walls' | 'floor'>,
    vision: readonly (readonly RegionPoint[])[],
    explored: Exploration | undefined,
  ) => PlayerDrawSet
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function layoutOf(map: Pick<MapData, 'width' | 'height' | 'grid'>): ChunkLayout {
  const grid = positive(map.grid, 1)
  const width = positive(map.width * grid, 1)
  const height = positive(map.height * grid, 1)
  let size = Math.max(MIN_CHUNK_PX, grid * CULL_CHUNK_GRID_CELLS)
  while (Math.ceil(width / size) * Math.ceil(height / size) > MAX_CHUNKS) size *= 2
  return { size, cols: Math.ceil(width / size), rows: Math.ceil(height / size), width, height }
}

function layoutKeyOf(layout: ChunkLayout): string {
  return `${layout.size}|${layout.cols}|${layout.rows}|${layout.width}|${layout.height}`
}

function isFiniteBox(b: Box): boolean {
  return Number.isFinite(b.minX) && Number.isFinite(b.minY) && Number.isFinite(b.maxX) && Number.isFinite(b.maxY)
}

/** Faixa de pedaços que a caixa toca, já presa ao mapa; `null` se ela não toca o mapa. */
function chunkRange(layout: ChunkLayout, b: Box): { c0: number; c1: number; r0: number; r1: number } | null {
  if (b.maxX < 0 || b.maxY < 0 || b.minX > layout.width || b.minY > layout.height) return null
  const c0 = Math.max(0, Math.floor(b.minX / layout.size))
  const r0 = Math.max(0, Math.floor(b.minY / layout.size))
  const c1 = Math.min(layout.cols - 1, Math.floor(b.maxX / layout.size))
  const r1 = Math.min(layout.rows - 1, Math.floor(b.maxY / layout.size))
  return { c0, c1, r0, r1 }
}

function buildIndex<T>(items: readonly T[], boundsOf: (item: T) => Box, layout: ChunkLayout): ChunkIndex {
  const buckets = new Map<number, number[]>()
  const always: number[] = []
  items.forEach((item, i) => {
    const b = boundsOf(item)
    // Caixa quebrada não se decide; caixa que sai do retângulo do mapa tem
    // pedaço fora da névoa (o preto só cobre o mapa): as duas são desenhadas.
    if (!isFiniteBox(b) || b.minX < 0 || b.minY < 0 || b.maxX > layout.width || b.maxY > layout.height) {
      always.push(i)
      return
    }
    const range = chunkRange(layout, b)
    if (range === null || (range.c1 - range.c0 + 1) * (range.r1 - range.r0 + 1) > MAX_CHUNKS_PER_ITEM) {
      always.push(i)
      return
    }
    for (let r = range.r0; r <= range.r1; r += 1) {
      for (let c = range.c0; c <= range.c1; c += 1) {
        const key = r * layout.cols + c
        const bucket = buckets.get(key)
        if (bucket === undefined) buckets.set(key, [i])
        else bucket.push(i)
      }
    }
  })
  return { layoutKey: layoutKeyOf(layout), buckets, always }
}

function wallBox(w: Wall): Box {
  return { minX: Math.min(w.x1, w.x2), minY: Math.min(w.y1, w.y2), maxX: Math.max(w.x1, w.x2), maxY: Math.max(w.y1, w.y2) }
}

/** Igualdade de valor JSON (a planta chega por JSON): sai no primeiro campo diferente. */
function sameJsonValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!sameJsonValue(a[i], b[i])) return false
    return true
  }
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  for (const k of keys) {
    if (!Object.hasOwn(b, k) || !sameJsonValue(Reflect.get(a, k), Reflect.get(b, k))) return false
  }
  return true
}

/** Planta de um tipo (paredes ou chão) já indexada: o array canônico e o índice dele. */
interface IndexedPlan<T> {
  items: readonly T[]
  index: ChunkIndex
}

/**
 * Índice da planta: reaproveitado quando o array é o mesmo (zoom) OU tem o
 * mesmo conteúdo (snapshot/delta novo sem mudança na planta). Nesse caso volta
 * o array ANTERIOR, canônico, para a memória de `cull` reconhecer a entrada.
 */
function reuseOrBuild<T>(
  previous: IndexedPlan<T> | null,
  items: readonly T[],
  boundsOf: (item: T) => Box,
  layout: ChunkLayout,
): { plan: IndexedPlan<T>; indexed: number } {
  if (previous !== null && previous.index.layoutKey === layoutKeyOf(layout)) {
    if (previous.items === items || sameJsonValue(previous.items, items)) return { plan: previous, indexed: 0 }
  }
  return { plan: { items, index: buildIndex(items, boundsOf, layout) }, indexed: items.length }
}

function addBox(layout: ChunkLayout, known: Set<number>, b: Box, pad: number): void {
  const range = chunkRange(layout, { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad })
  if (range === null) return
  for (let r = range.r0; r <= range.r1; r += 1) {
    for (let c = range.c0; c <= range.c1; c += 1) known.add(r * layout.cols + c)
  }
}

function polygonBox(points: readonly RegionPoint[]): Box | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null
}

/**
 * Trechos de células exploradas, linha por linha, pulando byte zerado de uma
 * vez: a parte não explorada do mapa (quase tudo, numa cena grande) custa um
 * teste a cada 8 células. `colEnd` exclusivo, como `forEachExploredRun`.
 */
function forEachExploredRunFast(exp: Exploration, visit: (row: number, colStart: number, colEnd: number) => void): void {
  const { bits, cols } = exp
  const total = cols * exp.rows
  let runStart = -1
  const flush = (end: number): void => {
    const row = Math.floor(runStart / cols)
    const colStart = runStart - row * cols
    visit(row, colStart, colStart + (end - runStart))
    runStart = -1
  }
  let idx = 0
  while (idx < total) {
    if (runStart < 0 && (idx & 7) === 0 && (bits[idx >> 3] ?? 0) === 0) {
      idx += 8
      continue
    }
    const set = ((bits[idx >> 3] ?? 0) & (1 << (idx & 7))) !== 0
    // Trecho nunca atravessa a virada de linha.
    if (runStart >= 0 && (!set || idx % cols === 0)) flush(idx)
    if (set && runStart < 0) runStart = idx
    idx += 1
  }
  if (runStart >= 0) flush(Math.min(idx, total))
}

/** Pedaços que o jogador conhece: visão de agora, contornos lembrados e células exploradas, com folga. */
function knownChunks(
  layout: ChunkLayout,
  grid: number,
  vision: readonly (readonly RegionPoint[])[],
  explored: Exploration | undefined,
): Set<number> {
  const known = new Set<number>()
  const pad = grid * KNOWN_PAD_GRID_CELLS
  for (const poly of vision) {
    // Mesma regra da névoa (`redrawFog`): anel com menos de 3 pontos não abre buraco.
    if (poly.length < 3) continue
    const box = polygonBox(poly)
    if (box !== null) addBox(layout, known, box, pad)
  }
  if (explored !== undefined) {
    for (const ring of explored.rings) addBox(layout, known, ring, pad)
    const cell = explored.cell
    forEachExploredRunFast(explored, (row, colStart, colEnd) => {
      addBox(layout, known, { minX: colStart * cell, minY: row * cell, maxX: colEnd * cell, maxY: (row + 1) * cell }, pad)
    })
  }
  return known
}

/** Itens dos pedaços conhecidos + os "sempre", sem repetir e na ORDEM original (o chão depende dela). */
function pick<T>(items: readonly T[], index: ChunkIndex, known: ReadonlySet<number>): { items: T[]; examined: number } {
  const chosen = new Set<number>(index.always)
  let examined = index.always.length
  for (const key of known) {
    const bucket = index.buckets.get(key)
    if (bucket === undefined) continue
    examined += bucket.length
    for (const i of bucket) chosen.add(i)
  }
  const order = [...chosen].sort((a, b) => a - b)
  const out: T[] = []
  for (const i of order) {
    const item = items[i]
    if (item !== undefined) out.push(item)
  }
  return { items: out, examined }
}

/**
 * Um recortador por tela. Guarda o índice da última planta (paredes e chão) e o
 * último resultado: a mesma entrada devolve o MESMO objeto, então o zoom — que
 * redesenha as paredes a cada passo — não refaz nada.
 */
export function createPlayerCuller(): PlayerCuller {
  let wallPlan: IndexedPlan<Wall> | null = null
  let floorPlan: IndexedPlan<FloorPiece> | null = null
  let last: {
    walls: readonly Wall[]
    floor: readonly FloorPiece[]
    vision: readonly (readonly RegionPoint[])[]
    explored: Exploration | undefined
    layoutKey: string
    result: PlayerDrawSet
  } | null = null

  function cull(
    map: Pick<MapData, 'width' | 'height' | 'grid' | 'walls' | 'floor'>,
    vision: readonly (readonly RegionPoint[])[],
    explored: Exploration | undefined,
  ): PlayerDrawSet {
    const layout = layoutOf(map)
    const layoutKey = layoutKeyOf(layout)
    if (
      last !== null &&
      last.walls === map.walls &&
      last.floor === map.floor &&
      last.vision === vision &&
      last.explored === explored &&
      last.layoutKey === layoutKey
    ) {
      return last.result
    }
    const wallsIndexed = reuseOrBuild(wallPlan, map.walls, wallBox, layout)
    const floorIndexed = reuseOrBuild(floorPlan, map.floor, pieceBounds, layout)
    wallPlan = wallsIndexed.plan
    floorPlan = floorIndexed.plan
    const known = knownChunks(layout, positive(map.grid, 1), vision, explored)
    const walls = pick(wallPlan.items, wallPlan.index, known)
    const floor = pick(floorPlan.items, floorPlan.index, known)
    const result: PlayerDrawSet = {
      walls: walls.items,
      floor: floor.items,
      examined: walls.examined + floor.examined,
      indexed: wallsIndexed.indexed + floorIndexed.indexed,
    }
    last = { walls: map.walls, floor: map.floor, vision, explored, layoutKey, result }
    return result
  }

  return { cull }
}
