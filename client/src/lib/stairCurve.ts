import type { Stair, StairSegment } from '../types/map'
import type { Point } from '../pixi/world'

/**
 * TAMANHO E CURVA da escada já colocada (pedido de 10/10/2026: "aumentar e
 * diminuir o tamanho da escada, largura e altura, depois de colocada" e
 * "curvar ela depois de feita"). Conta pura, sem Pixi: o desenho
 * (`pixi/stairFlight.ts`), as alças (`lib/stairHandles.ts`), o clique, a
 * borracha, a seleção por área e a ficha que pisa na escada leem daqui.
 *
 * A curva mora em `Stair.curva`: a FLECHA do arco sobre a corda
 * (x1, y1)→(x2, y2). As pontas nunca saem do lugar quando a escada curva — é
 * o que deixa o pino da escada que leva a outro piso, preso no pé, onde está.
 */

/** Menor largura e menor comprimento da escada, em casas: nada de lance de comprimento zero nem de largura negativa. */
export const STAIR_MIN_CELLS = 0.25
/** Maior comprimento, em casas: o mapa inteiro de ponta a ponta, não mais. */
export const STAIR_MAX_LENGTH_CELLS = 200
/** Maior largura, em casas. */
export const STAIR_MAX_WIDTH_CELLS = 20

/**
 * O raio de DENTRO do arco nunca fica menor que esta fração da largura. Os
 * degraus da escada curva são radiais e se apertam no lado de dentro; com o
 * raio de dentro em zero, todos se encontrariam num ponto. Com meia largura,
 * o vão de dentro fica com um terço do de fora no pior caso — os degraus
 * ainda se leem.
 */
export const STAIR_CURVE_MIN_INNER_RATIO = 0.5

/** Maior volta da escada curva, em graus: meia volta. Mais que isso é espiral, que tem forma própria. */
export const STAIR_CURVE_MAX_TURN_DEGREES = 180

/** Curva menor que isto (px de mundo) é invisível: a escada é desenhada reta, com o traço preso ao pixel. */
const CURVE_EPSILON_PX = 0.5

/** Ângulo de cada corda que aproxima o arco no clique, na borracha e na área: numa escada de 5 casas o erro fica abaixo de 0,5 px. */
const CENTERLINE_CHORD_ANGLE = Math.PI / 32
const MAX_CENTERLINE_CHORDS = 32

export interface StairChord {
  length: number
  /** Unitário de (x1, y1) para (x2, y2). */
  along: Point
  /** `along` girado: (−along.y, along.x). O lado da curva positiva. */
  normal: Point
  middle: Point
}

/** Corda de um lance; `null` para lance de comprimento zero (ou com número inválido). */
export function stairChord(segment: StairSegment): StairChord | null {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const length = Math.hypot(dx, dy)
  if (!(length > 0) || !Number.isFinite(length)) return null
  const along = { x: dx / length, y: dy / length }
  return {
    length,
    along,
    normal: { x: -along.y, y: along.x },
    middle: { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 },
  }
}

function finiteWidth(stepWidth: number): number {
  return Number.isFinite(stepWidth) ? Math.max(0, stepWidth) : 0
}

/**
 * Maior flecha (em módulo) que a corda `chordLength` aguenta com a largura
 * `stepWidth`. Duas regras: no máximo meia volta (flecha = meia corda) e o
 * raio de dentro com pelo menos `STAIR_CURVE_MIN_INNER_RATIO` da largura.
 * O raio do arco, `(c²/4 + h²) / 2h`, cai à medida que a flecha cresce até
 * meia corda; quando o raio mínimo passa de meia corda, a flecha para onde o
 * raio o encontra: h = R − √(R² − c²/4).
 */
export function stairCurveLimit(chordLength: number, stepWidth: number): number {
  if (!(chordLength > 0) || !Number.isFinite(chordLength)) return 0
  const half = chordLength / 2
  const width = finiteWidth(stepWidth)
  const minRadius = width / 2 + width * STAIR_CURVE_MIN_INNER_RATIO
  if (minRadius <= half) return half
  return minRadius - Math.sqrt(minRadius * minRadius - half * half)
}

export function clampStairCurve(curva: number, chordLength: number, stepWidth: number): number {
  if (!Number.isFinite(curva)) return 0
  const limit = stairCurveLimit(chordLength, stepWidth)
  return Math.max(-limit, Math.min(limit, curva))
}

/** A escada curva? Só a reta de um lance: L, dupla e espiral não. */
export function stairCanCurve(stair: Pick<Stair, 'shape' | 'segments'>): boolean {
  return stair.shape === 'straight' && stair.segments.length === 1
}

/**
 * A curva que vale para o desenho e para toda conta de geometria: 0 na forma
 * que não curva, sem `curva`, com valor inválido ou pequeno demais para se
 * ver; senão a guardada, limitada (`stairCurveLimit`). O valor guardado não é
 * reescrito: estreitar a escada depois devolve a curva pedida.
 */
export function stairCurveOf(stair: Pick<Stair, 'shape' | 'segments' | 'stepWidth' | 'curva'>): number {
  if (stair.curva === undefined || !stairCanCurve(stair)) return 0
  const chord = stairChord(stair.segments[0])
  if (chord === null) return 0
  const curva = clampStairCurve(stair.curva, chord.length, stair.stepWidth)
  return Math.abs(curva) < CURVE_EPSILON_PX ? 0 : curva
}

export interface StairArc {
  center: Point
  /** Raio da linha do meio da escada. */
  radius: number
  /** Ângulo de (x1, y1) visto do centro, em radianos de tela (y para baixo). */
  startAngle: number
  /** Ângulo andado de (x1, y1) até (x2, y2), com sinal. Em módulo, nunca passa de π. */
  sweep: number
}

/**
 * O arco da linha do meio de um lance de flecha `curva`: passa por
 * (x1, y1), (x2, y2) e pelo ponto a `curva` do meio da corda, na normal.
 * `null` para curva zero ou lance de comprimento zero.
 */
export function stairArcOf(segment: StairSegment, curva: number): StairArc | null {
  const chord = stairChord(segment)
  if (chord === null || curva === 0 || !Number.isFinite(curva)) return null
  const half = chord.length / 2
  const radius = (half * half + curva * curva) / (2 * Math.abs(curva))
  // O centro fica na normal pelo meio da corda, a um raio do meio do arco, do lado oposto a ele.
  const offset = curva - Math.sign(curva) * radius
  const center = { x: chord.middle.x + chord.normal.x * offset, y: chord.middle.y + chord.normal.y * offset }
  // Flecha h e meia corda c/2: tan(volta/4) = h / (c/2). A volta anda contra o lado da flecha.
  const sweep = -Math.sign(curva) * 4 * Math.atan(Math.abs(curva) / half)
  return { center, radius, startAngle: Math.atan2(segment.y1 - center.y, segment.x1 - center.x), sweep }
}

/** Ponto do arco depois de andar a fração `t` (0 em (x1, y1), 1 em (x2, y2)), a `radius` do centro. */
export function stairArcPoint(arc: StairArc, t: number, radius = arc.radius): Point {
  const angle = arc.startAngle + arc.sweep * t
  return { x: arc.center.x + Math.cos(angle) * radius, y: arc.center.y + Math.sin(angle) * radius }
}

/**
 * Linha do meio da escada como lances retos: a própria `segments` na escada
 * reta, L, dupla ou espiral; na curva, cordas encadeadas sobre o arco, com as
 * pontas exatas. É o que o clique, a borracha, a seleção por área e a ficha
 * que pisa na escada leem — a escada curva responde onde está desenhada.
 */
export function stairCenterline(stair: Stair): StairSegment[] {
  const curva = stairCurveOf(stair)
  const first = stair.segments[0]
  const arc = curva === 0 || first === undefined ? null : stairArcOf(first, curva)
  if (arc === null) return stair.segments
  const chords = Math.min(MAX_CENTERLINE_CHORDS, Math.max(2, Math.ceil(Math.abs(arc.sweep) / CENTERLINE_CHORD_ANGLE)))
  const points: Point[] = [{ x: first.x1, y: first.y1 }]
  for (let i = 1; i < chords; i += 1) points.push(stairArcPoint(arc, i / chords))
  points.push({ x: first.x2, y: first.y2 })
  const segments: StairSegment[] = []
  for (let i = 1; i < points.length; i += 1) {
    segments.push({ x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y })
  }
  return segments
}

/** Volta da escada em graus, com o sinal da flecha. 0 = reta. */
export function stairTurnDegrees(stair: Stair): number {
  const curva = stairCurveOf(stair)
  const first = stair.segments[0]
  const chord = curva === 0 || first === undefined ? null : stairChord(first)
  if (chord === null) return 0
  return (4 * Math.atan((2 * curva) / chord.length) * 180) / Math.PI
}

/** Maior volta, em graus, que esta escada aguenta; 0 na forma que não curva. */
export function stairMaxTurnDegrees(stair: Stair): number {
  const first = stair.segments[0]
  const chord = !stairCanCurve(stair) || first === undefined ? null : stairChord(first)
  if (chord === null) return 0
  const limit = stairCurveLimit(chord.length, stair.stepWidth)
  return Math.min(STAIR_CURVE_MAX_TURN_DEGREES, (4 * Math.atan((2 * limit) / chord.length) * 180) / Math.PI)
}

/** A flecha que dá a volta `degrees` numa corda de `chordLength`. */
export function curvaForTurnDegrees(degrees: number, chordLength: number): number {
  if (!Number.isFinite(degrees) || !(chordLength > 0)) return 0
  const turn = (Math.max(-STAIR_CURVE_MAX_TURN_DEGREES, Math.min(STAIR_CURVE_MAX_TURN_DEGREES, degrees)) * Math.PI) / 180
  return (chordLength / 2) * Math.tan(turn / 4)
}

/** Comprimento da escada de ponta a ponta: a soma dos lances (na curva, a corda). */
export function stairLength(stair: Pick<Stair, 'segments'>): number {
  return stair.segments.reduce((total, s) => total + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0)
}

function clampCells(value: number, grid: number, maxCells: number): number {
  const cell = Number.isFinite(grid) && grid > 0 ? grid : 1
  const min = cell * STAIR_MIN_CELLS
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(cell * maxCells, value))
}

/** Largura entre `STAIR_MIN_CELLS` e `STAIR_MAX_WIDTH_CELLS` casas. */
export function clampStairWidth(width: number, grid: number): number {
  return clampCells(width, grid, STAIR_MAX_WIDTH_CELLS)
}

/** Comprimento entre `STAIR_MIN_CELLS` e `STAIR_MAX_LENGTH_CELLS` casas. */
export function clampStairLength(length: number, grid: number): number {
  return clampCells(length, grid, STAIR_MAX_LENGTH_CELLS)
}

/** Qual ponta fica parada quando o comprimento muda: o começo (x1, y1) do primeiro lance ou o fim do último. */
export type StairEnd = 'start' | 'end'

/**
 * A escada com `length` px de ponta a ponta e a ponta `fixed` parada. A
 * escada inteira escala a partir dela — na reta, só a outra ponta anda, na
 * mesma linha; na L e na dupla, os lances crescem juntos. A curva escala
 * junto, para a volta em graus não mudar. Comprimento inválido, igual ao de
 * agora, ou escada sem lance devolve a MESMA referência. Quem chama limita o
 * comprimento (`clampStairLength`).
 */
export function withStairLength(stair: Stair, length: number, fixed: StairEnd): Stair {
  const current = stairLength(stair)
  if (!(current > 0) || !Number.isFinite(current) || !Number.isFinite(length) || !(length > 0) || length === current) return stair
  const first = stair.segments[0]
  const last = stair.segments[stair.segments.length - 1]
  const pivot = fixed === 'start' ? { x: first.x1, y: first.y1 } : { x: last.x2, y: last.y2 }
  const factor = length / current
  // Divide antes de multiplicar: na escada reta deitada ou em pé, (x − pivô) / atual dá ±1 exato e a ponta cai no px pedido.
  const scale = (x: number, y: number): Point => ({ x: pivot.x + ((x - pivot.x) / current) * length, y: pivot.y + ((y - pivot.y) / current) * length })
  const segments = stair.segments.map((s) => {
    const a = scale(s.x1, s.y1)
    const b = scale(s.x2, s.y2)
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  })
  // A ponta parada fica EXATA (sem o erro do ponto flutuante de pivot + 0 × fator).
  if (fixed === 'start') segments[0] = { ...segments[0], x1: first.x1, y1: first.y1 }
  else segments[segments.length - 1] = { ...segments[segments.length - 1], x2: last.x2, y2: last.y2 }
  return stair.curva === undefined ? { ...stair, segments } : { ...stair, segments, curva: stair.curva * factor }
}

/** O meio da escada na linha do meio: o meio do arco na curva, o meio do primeiro lance nas outras. `null` sem lance. */
export function stairMidpoint(stair: Stair): Point | null {
  const first = stair.segments[0]
  if (first === undefined) return null
  const chord = stairChord(first)
  const middle = { x: (first.x1 + first.x2) / 2, y: (first.y1 + first.y2) / 2 }
  if (chord === null) return middle
  // O meio do arco está a uma flecha do meio da corda, na normal — direto, sem passar por seno e cosseno.
  const curva = stairCurveOf(stair)
  return { x: middle.x + chord.normal.x * curva, y: middle.y + chord.normal.y * curva }
}

/**
 * Pontos que dizem onde a escada está, para a névoa decidir se ela está num
 * lugar escondido: ponta, meio e ponta de cada lance, como sempre; na curva,
 * cinco pontos sobre o arco (as pontas, os quartos e o meio).
 */
export function stairCenterlineSamples(stair: Stair): Point[] {
  const first = stair.segments[0]
  const arc = first === undefined ? null : stairArcOf(first, stairCurveOf(stair))
  if (arc === null) {
    return stair.segments.flatMap((s) => [{ x: s.x1, y: s.y1 }, { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }, { x: s.x2, y: s.y2 }])
  }
  return [{ x: first.x1, y: first.y1 }, stairArcPoint(arc, 0.25), stairArcPoint(arc, 0.5), stairArcPoint(arc, 0.75), { x: first.x2, y: first.y2 }]
}
