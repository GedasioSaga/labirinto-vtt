import type { MapData, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'
import { simplifyRing } from './refineFloor'
import { NESTING_TOLERANCE, pointInPolygonInclusive } from './roomNesting'

/**
 * Memória do que um jogador já viu, em duas camadas que valem juntas:
 *
 * 1. um bitset de células sobre o mapa — índice `row * cols + col`, byte
 *    `índice >> 3`, bit `índice & 7` a partir do menos significativo;
 * 2. os CONTORNOS dos anéis de visão que ele já teve (`rings`).
 *
 * O bitset é conservador de propósito (só marca célula INTEIRA dentro da
 * visão, ver `markRings`): sozinho ele perde uma faixa de até uma célula em
 * toda a volta do que foi visto e, desenhado como retângulo de célula, sai em
 * escadinha — a sala encolhia ~6% ao virar memória e a borda vinha em degraus.
 * Os contornos guardam a MESMA linha que o jogador viu ao vivo; o bitset
 * continua sendo o índice rápido do interior e a única memória perto de área
 * proibida (ver `rememberRing`).
 *
 * O mestre é a autoridade (marca com os anéis de visão e decide o que da
 * planta sai para o jogador); o jogador só recebe a memória para desenhar a
 * névoa escurecida.
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

/** Desvio máximo da simplificação do contorno lembrado, em px de mundo. */
const MEMORY_SIMPLIFY_TOLERANCE = 0.5
/** Passo da quantização do contorno lembrado, em px de mundo: é a unidade do inteiro que vai no fio. */
const MEMORY_QUANTUM = 0.5
/**
 * Teto de vértices guardados em `rings`, somando todos os anéis: ~16 KB antes
 * do base64. Cheio, anel novo não entra e só o bitset conservador cresce —
 * a borda volta a ser a da célula naquele pedaço, em vez de o fio inchar sem
 * limite numa sessão longa.
 */
export const MAX_MEMORY_VERTICES = 4000
/** Coordenada máxima em px de mundo que cabe no inteiro de meio pixel do fio (Int16). */
const MEMORY_COORD_LIMIT = 16_383
/** Bytes do maior `rings` possível: cada anel tem 1 inteiro de cabeçalho e no mínimo 3 vértices. */
const MAX_MEMORY_BYTES = (MAX_MEMORY_VERTICES * 2 + Math.ceil(MAX_MEMORY_VERTICES / 3)) * 2

export interface ExploredWire {
  cell: number
  cols: number
  rows: number
  bits: string
  /** Contornos lembrados, em base64 (ver `encodeRings`). Ausente = fio antigo, só bitset. */
  rings: string
}

/** Contorno lembrado com a caixa envolvente pronta: o teste de ponto descarta a maioria sem varrer os vértices. */
export interface MemoryRing {
  points: RegionPoint[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Exploration {
  cell: number
  cols: number
  rows: number
  bits: Uint8Array
  /** Contornos dos anéis de visão já vistos; a borda da memória sai daqui. */
  rings: MemoryRing[]
  /** Soma dos vértices de `rings`: o teto é conferido sem recontar a cada anel. */
  ringVertices: number
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
  return { cell, cols, rows, bits: new Uint8Array(byteLength(cols, rows)), rings: [], ringVertices: 0 }
}

/**
 * A mesma memória numa planta de outro tamanho (o mestre aumentou ou diminuiu
 * o mapa): cada coisa fica no MESMO ponto do mundo, porque o mapa cresce a
 * partir do canto (0, 0). O que é novo nasce preto; o que saiu do mapa é
 * esquecido (se ele crescer de novo, pode haver outra planta lá).
 *
 * Célula nova só vira explorada quando TODAS as células antigas que ela cobre
 * estavam exploradas — a mesma regra conservadora de `markRings` quando o mapa
 * enorme engrossa a célula. Com a mesma célula, é cópia bit a bit.
 * Contorno lembrado que não cabe inteiro na planta nova sai; o que cabe fica.
 * Não mexe em `exp`: devolve uma memória nova.
 */
export function resizeExploration(exp: Exploration, map: Pick<MapData, 'width' | 'height' | 'grid'>): Exploration {
  const next = createExploration(map)
  const oldCell = exp.cell
  for (let row = 0; row < next.rows; row += 1) {
    const y0 = row * next.cell
    const firstOldRow = Math.floor(y0 / oldCell)
    const lastOldRow = Math.ceil((y0 + next.cell) / oldCell) - 1
    if (lastOldRow >= exp.rows) break
    for (let col = 0; col < next.cols; col += 1) {
      const x0 = col * next.cell
      const firstOldCol = Math.floor(x0 / oldCell)
      const lastOldCol = Math.ceil((x0 + next.cell) / oldCell) - 1
      if (lastOldCol >= exp.cols) break
      if (allCellsSet(exp, firstOldCol, lastOldCol, firstOldRow, lastOldRow)) setRun(next, row, col, col + 1)
    }
  }
  const width = next.cols * next.cell
  const height = next.rows * next.cell
  next.rings = exp.rings.filter((r) => r.minX >= 0 && r.minY >= 0 && r.maxX <= width && r.maxY <= height)
  next.ringVertices = next.rings.reduce((total, r) => total + r.points.length, 0)
  return next
}

function allCellsSet(exp: Exploration, colStart: number, colEnd: number, rowStart: number, rowEnd: number): boolean {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      if (!isCellSet(exp, col, row)) return false
    }
  }
  return true
}

function setRun(exp: Exploration, row: number, colStart: number, colEnd: number): void {
  const base = row * exp.cols
  for (let col = colStart; col < colEnd; col += 1) {
    const index = base + col
    exp.bits[index >> 3] |= 1 << (index & 7)
  }
}

function clearCell(exp: Exploration, col: number, row: number): void {
  const index = row * exp.cols + col
  exp.bits[index >> 3] &= ~(1 << (index & 7))
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
    const box = boxOf(ring)
    return box === null ? [] : [{ ring, ...box }]
  })
}

/** Caixa envolvente, ou `null` se algum ponto não for finito. */
function boxOf(points: readonly RegionPoint[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
  return { minX, minY, maxX, maxY }
}

/**
 * Anel simplificado e encaixado na malha de meio pixel, sem vértice repetido e
 * sem repetir o primeiro ponto no fim. Devolve `null` quando sobra menos de um
 * triângulo ou quando alguma coordenada não cabe no inteiro do fio.
 */
function memoryRingOf(ring: readonly RegionPoint[]): MemoryRing | null {
  if (ring.length < 3) return null
  const box = boxOf(ring)
  if (box === null) return null
  if (Math.max(Math.abs(box.minX), Math.abs(box.maxX), Math.abs(box.minY), Math.abs(box.maxY)) > MEMORY_COORD_LIMIT) return null
  const simplified = simplifyRing(ring.map((p) => ({ x: p.x, y: p.y })), MEMORY_SIMPLIFY_TOLERANCE)
  const points: RegionPoint[] = []
  for (const p of simplified) {
    const q = { x: Math.round(p.x / MEMORY_QUANTUM) * MEMORY_QUANTUM, y: Math.round(p.y / MEMORY_QUANTUM) * MEMORY_QUANTUM }
    const last = points[points.length - 1]
    if (last !== undefined && last.x === q.x && last.y === q.y) continue
    points.push(q)
  }
  const first = points[0]
  const last = points[points.length - 1]
  if (points.length > 3 && first !== undefined && last !== undefined && first.x === last.x && first.y === last.y) points.pop()
  if (points.length < 3) return null
  const quantized = boxOf(points)
  return quantized === null ? null : { points, ...quantized }
}

/**
 * Mesmo anel, vértice a vértice. A varredura angular da visão é determinística,
 * então token parado devolve o anel idêntico — e `ringCovers` não pega esse
 * caso, porque vértice em cima da borda não conta como dentro.
 */
function sameRing(a: MemoryRing, b: MemoryRing): boolean {
  if (a.points.length !== b.points.length) return false
  for (let i = 0; i < a.points.length; i += 1) {
    if (a.points[i].x !== b.points[i].x || a.points[i].y !== b.points[i].y) return false
  }
  return true
}

/**
 * `inner` está dentro de `outer`. Testa vértices E meios de aresta: só os
 * vértices deixariam passar uma aresta que sai e volta pelo lado côncavo de
 * `outer`. Não é prova para todo polígono, mas o erro possível é da ordem do
 * vão entre duas amostras, e só descarta memória — nunca inventa memória.
 */
function ringCovers(outer: MemoryRing, inner: MemoryRing): boolean {
  if (inner.minX < outer.minX || inner.maxX > outer.maxX || inner.minY < outer.minY || inner.maxY > outer.maxY) return false
  const points = inner.points
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[j]
    const b = points[i]
    if (!pointInRing(b, outer.points)) return false
    if (!pointInRing({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, outer.points)) return false
  }
  return true
}

/**
 * Guarda o contorno de um anel de visão, para a memória ter a MESMA borda que
 * o jogador viu ao vivo.
 *
 * SEGURANÇA: anel que encosta em área proibida (zona oculta ativa, sala
 * secreta) não é guardado. O contorno exato desenharia a borda dela na tela do
 * jogador com a precisão do anel; perto dessas áreas continua valendo só o
 * bitset conservador, que já pula a célula inteira que as toca.
 *
 * Também não guarda anel já contido em outro guardado: o snapshot é remarcado
 * a cada mudança do mestre, então parado ou andando pouco o mesmo anel chegaria
 * de novo.
 */
function rememberRing(exp: Exploration, ring: readonly RegionPoint[], zones: readonly ZoneBox[]): void {
  if (exp.ringVertices >= MAX_MEMORY_VERTICES) return
  const candidate = memoryRingOf(ring)
  if (candidate === null) return
  for (const z of zones) {
    if (candidate.maxX < z.minX || candidate.minX > z.maxX || candidate.maxY < z.minY || candidate.minY > z.maxY) continue
    if (ringTouchesRect(candidate.points, z.minX, z.minY, z.maxX, z.maxY)) return
  }
  if (exp.ringVertices + candidate.points.length > MAX_MEMORY_VERTICES) return
  for (const stored of exp.rings) {
    if (sameRing(stored, candidate) || ringCovers(stored, candidate)) return
  }
  exp.rings.push(candidate)
  exp.ringVertices += candidate.points.length
}

/** Ponto dentro de algum contorno lembrado. */
function isPointInMemoryRings(exp: Exploration, point: RegionPoint): boolean {
  for (const r of exp.rings) {
    if (point.x < r.minX || point.x > r.maxX || point.y < r.minY || point.y > r.maxY) continue
    if (pointInRing(point, r.points)) return true
  }
  return false
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
 *
 * Em cima disso, o CONTORNO de cada anel é guardado em `exp.rings`
 * (`rememberRing`): é ele que devolve ao jogador a borda que ele viu, sem a
 * faixa de uma célula que o bitset perde por só aceitar célula inteira.
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
    rememberRing(exp, ring, zones)
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
 * ÁREA PROIBIDA que apareceu DEPOIS da memória (zona oculta ativa, sala
 * secreta): apaga dela o que `markRings` nunca teria guardado ali — toda
 * célula que TOCA a área e todo contorno lembrado que encosta nela. É a regra
 * estrita de `markRings`/`rememberRing`, não a de `forgetInside` (o teto): o
 * que o mestre escondeu não pode sobrar nem na borda.
 *
 * Usada ao retomar a mesa: a memória gravada ontem é conferida contra as áreas
 * proibidas de hoje antes de chegar ao jogador.
 */
export function forgetBlocked(exp: Exploration, blocked: readonly RegionPoint[][]): void {
  const zones = zoneBoxes(blocked)
  if (zones.length === 0) return
  const { cell, cols, rows } = exp
  for (let row = 0; row < rows; row += 1) {
    const y0 = row * cell
    const y1 = y0 + cell
    const rowZones = zones.filter((z) => z.maxY >= y0 && z.minY <= y1)
    if (rowZones.length === 0) continue
    for (let col = 0; col < cols; col += 1) {
      if (!isCellSet(exp, col, row)) continue
      const x0 = col * cell
      const x1 = x0 + cell
      if (rowZones.some((z) => z.maxX >= x0 && z.minX <= x1 && ringTouchesRect(z.ring, x0, y0, x1, y1))) clearCell(exp, col, row)
    }
  }
  const kept = exp.rings.filter((r) =>
    zones.every((z) => r.maxX < z.minX || r.minX > z.maxX || r.maxY < z.minY || r.minY > z.maxY || !ringTouchesRect(r.points, z.minX, z.minY, z.maxX, z.maxY)),
  )
  if (kept.length === exp.rings.length) return
  exp.rings = kept
  exp.ringVertices = kept.reduce((total, r) => total + r.points.length, 0)
}

/** Fração dos vértices de um contorno lembrado que precisa cair dentro do polígono para ele ser esquecido. */
const RING_INSIDE_MAJORITY = 0.5

/**
 * TETO DE CONSTRUÇÃO — apaga da memória o que está DENTRO destes polígonos.
 *
 * É o que faz o teto fechar de verdade. `filterMapForPlayer` já tira o interior
 * de todo snapshot, mas a memória do explorado é outra via: ela viaja no
 * `explored` do pacote (`encodeExploration`) e é a grade de células que o
 * jogador percorreu — ou seja, a planta do que ele visitou enquanto o teto
 * estava ABERTO. Sem apagar, sair do prédio deixava o desenho do caminho dele
 * na rede para sempre, contra a promessa escrita em `types/map.ts`.
 *
 * DUAS REGRAS DIFERENTES, e a diferença é o ponto:
 *
 *  - CÉLULA: só apaga a que está INTEIRA dentro do polígono (4 cantos + centro).
 *    Célula que apenas encosta no muro fica: é ela que guarda a rua colada na
 *    parede, e apagá-la fazia o jogador esquecer a calçada — e, pior, a própria
 *    silhueta do prédio sumia quando ele se afastava, porque as amostras do
 *    contorno (4 px para fora) moram justamente nessas células.
 *  - CONTORNO LEMBRADO: apaga o anel cuja MAIORIA dos vértices está dentro. Anel
 *    nascido lá dentro é quase todo interior; anel nascido na rua só raspa o
 *    muro. Descartar todo anel que TOCA o prédio é o que a área proibida faz, e
 *    era exatamente o defeito: um prédio no campo de visão apagava a borda da
 *    memória no mapa inteiro, longe dele.
 */
export function forgetInside(exp: Exploration, rings: readonly (readonly RegionPoint[])[]): void {
  const areas = zoneBoxes(rings.map((r) => r.map((p) => ({ x: p.x, y: p.y })))).map((z) => ({
    ...z,
    minX: z.minX - NESTING_TOLERANCE,
    minY: z.minY - NESTING_TOLERANCE,
    maxX: z.maxX + NESTING_TOLERANCE,
    maxY: z.maxY + NESTING_TOLERANCE,
  }))
  if (areas.length === 0) return
  // MESMO predicado inclusivo de `lib/fogFilter.ts`: vértice de anel em cima da
  // parede do predio conta como dentro, senao o anel nascido la dentro (que e
  // quase todo parede) ficava metade fora pela assimetria do raycast.
  const covers = (x: number, y: number): boolean =>
    areas.some((z) => x >= z.minX && x <= z.maxX && y >= z.minY && y <= z.maxY && pointInPolygonInclusive({ x, y }, z.ring))
  const { cell, cols, rows } = exp
  for (let row = 0; row < rows; row += 1) {
    const y0 = row * cell
    const y1 = y0 + cell
    if (!areas.some((z) => z.maxY >= y0 && z.minY <= y1)) continue
    for (let col = 0; col < cols; col += 1) {
      if (!isCellSet(exp, col, row)) continue
      const x0 = col * cell
      const x1 = x0 + cell
      const inteira =
        covers(x0, y0) && covers(x1, y0) && covers(x0, y1) && covers(x1, y1) && covers((x0 + x1) / 2, (y0 + y1) / 2)
      if (inteira) clearCell(exp, col, row)
    }
  }
  const kept = exp.rings.filter((r) => {
    const dentro = r.points.filter((p) => covers(p.x, p.y)).length
    return dentro <= r.points.length * RING_INSIDE_MAJORITY
  })
  if (kept.length === exp.rings.length) return
  exp.rings = kept
  exp.ringVertices = kept.reduce((total, r) => total + r.points.length, 0)
}

/**
 * TELA DA MESA — junta em `target` o que `source` lembra: célula marcada em
 * qualquer uma fica marcada, e cada contorno lembrado entra pela mesma regra de
 * `rememberRing` (teto de vértices, sem repetir anel já coberto). Os contornos
 * de `source` já passaram pelo veto de área proibida quando foram guardados.
 * Grades diferentes (outro mapa, ou o mesmo redimensionado) não se juntam.
 */
export function mergeExploration(target: Exploration, source: Exploration): void {
  if (target.cell !== source.cell || target.cols !== source.cols || target.rows !== source.rows) return
  for (let i = 0; i < target.bits.length; i += 1) target.bits[i] |= source.bits[i]
  for (const ring of source.rings) {
    if (target.ringVertices + ring.points.length > MAX_MEMORY_VERTICES) continue
    if (target.rings.some((stored) => sameRing(stored, ring) || ringCovers(stored, ring))) continue
    target.rings.push(ring)
    target.ringVertices += ring.points.length
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

/**
 * Ponto já visto: célula marcada (interior, teste de um bit) ou dentro de
 * algum contorno lembrado (a faixa que o bitset conservador perde na borda).
 * Fora do retângulo do mapa é sempre falso, mesmo que um anel passe por lá.
 */
export function isPointExplored(exp: Exploration, point: RegionPoint): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false
  const col = Math.floor(point.x / exp.cell)
  const row = Math.floor(point.y / exp.cell)
  if (col < 0 || row < 0 || col >= exp.cols || row >= exp.rows) return false
  return isCellSet(exp, col, row) || isPointInMemoryRings(exp, point)
}

/** Mesma regra de amostragem da visão: basta um ponto amostrado explorado. */
export function isShapeExplored(exp: Exploration, points: readonly RegionPoint[]): boolean {
  return points.some((p) => isPointExplored(exp, p))
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK))
  }
  return btoa(binary)
}

function base64ToBytes(value: string, maxBytes: number): Uint8Array | null {
  // Confere o tamanho antes do atob: string gigante não chega a ser decodificada.
  if (value.length % 4 !== 0 || value.length > Math.ceil(maxBytes / 3) * 4 || !BASE64_PATTERN.test(value)) return null
  let binary: string
  try {
    binary = atob(value)
  } catch {
    return null
  }
  if (binary.length > maxBytes) return null
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

/**
 * Contornos lembrados em base64. Cada anel é `[nVértices, x0, y0, x1, y1, ...]`
 * em inteiros de 16 bits little-endian, na unidade de meio pixel de mundo
 * (`MEMORY_QUANTUM`) — little-endian explícito porque as duas pontas podem ser
 * máquinas diferentes.
 */
function encodeRings(rings: readonly MemoryRing[]): string {
  let total = 0
  for (const ring of rings) total += 1 + ring.points.length * 2
  const bytes = new Uint8Array(total * 2)
  const view = new DataView(bytes.buffer)
  let at = 0
  for (const ring of rings) {
    view.setInt16(at, ring.points.length, true)
    at += 2
    for (const p of ring.points) {
      view.setInt16(at, Math.round(p.x / MEMORY_QUANTUM), true)
      view.setInt16(at + 2, Math.round(p.y / MEMORY_QUANTUM), true)
      at += 4
    }
  }
  return bytesToBase64(bytes)
}

/** Campo ausente = fio antigo, que só tinha bitset: memória sem contorno, nunca erro. */
function decodeRings(value: unknown): { rings: MemoryRing[]; vertices: number } | null {
  if (value === undefined) return { rings: [], vertices: 0 }
  if (typeof value !== 'string') return null
  const bytes = base64ToBytes(value, MAX_MEMORY_BYTES)
  if (bytes === null || bytes.length % 2 !== 0) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const rings: MemoryRing[] = []
  let vertices = 0
  let at = 0
  while (at < bytes.length) {
    const count = view.getInt16(at, true)
    at += 2
    if (count < 3 || at + count * 4 > bytes.length) return null
    vertices += count
    if (vertices > MAX_MEMORY_VERTICES) return null
    const points: RegionPoint[] = []
    for (let i = 0; i < count; i += 1) {
      points.push({ x: view.getInt16(at, true) * MEMORY_QUANTUM, y: view.getInt16(at + 2, true) * MEMORY_QUANTUM })
      at += 4
    }
    const box = boxOf(points)
    if (box === null) return null
    rings.push({ points, ...box })
  }
  return { rings, vertices }
}

export function encodeExploration(exp: Exploration): ExploredWire {
  return { cell: exp.cell, cols: exp.cols, rows: exp.rows, bits: bytesToBase64(exp.bits), rings: encodeRings(exp.rings) }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Vem pela rede: qualquer campo fora do formato devolve `null`, nunca lança. */
export function decodeExploration(wire: unknown): Exploration | null {
  if (typeof wire !== 'object' || wire === null || Array.isArray(wire)) return null
  const { cell, cols, rows, bits, rings } = wire as Record<string, unknown>
  if (typeof cell !== 'number' || !Number.isFinite(cell) || cell <= 0) return null
  if (!isPositiveInteger(cols) || !isPositiveInteger(rows)) return null
  if (cols * rows > MAX_EXPLORED_CELLS) return null
  if (typeof bits !== 'string') return null
  const bytes = byteLength(cols, rows)
  if (bits.length !== Math.ceil(bytes / 3) * 4) return null
  const out = base64ToBytes(bits, bytes)
  if (out === null || out.length !== bytes) return null
  const memory = decodeRings(rings)
  if (memory === null) return null
  return { cell, cols, rows, bits: out, rings: memory.rings, ringVertices: memory.vertices }
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
