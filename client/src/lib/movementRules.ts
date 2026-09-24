/**
 * MOVIMENTO CONTADO — as regras de movimento da cena para as fichas dos
 * jogadores: passo máximo (em quadrados) e "Fichas ocupam espaço".
 *
 * A distância é SEMPRE a de `measureCells` (`lib/measurement.ts`), a mesma
 * régua da ferramenta Medir e do rótulo do arrasto: se a mesa joga 3.5e
 * ("5-10-5"), o passo máximo conta a diagonal do mesmo jeito. Tudo puro: o
 * host decide com isto (`lib/moveValidation.ts`) e a tela do jogador usa as
 * mesmas funções para parar a ficha no alcance antes de pedir
 * (`player/playerTokenDrag.ts`), então o que a tela mostra é o que o host aceita.
 */
import type { MapData, MovementRules, Token } from '../types/map'
import type { Point } from '../pixi/world'
import { measureCells } from './measurement'

/** Teto do passo máximo: acima disto a regra não limita nada numa mesa real. */
export const MAX_STEP_CELLS_LIMIT = 99

/**
 * Folga da comparação com o passo máximo, em quadrados. Só engole erro de
 * ponto flutuante: o ponto cortado já sai em coordenada inteira e dentro do
 * alcance, então o host aceita o pedido que a tela do jogador fez.
 */
const STEP_EPSILON_CELLS = 1e-6

/** Iterações da busca binária do corte: 2^-40 do trajeto é bem abaixo de 1 px. */
const CLAMP_ITERATIONS = 40

/** Pontos do contorno de alcance: suave o bastante para um círculo de 99 quadrados. */
const REACH_SAMPLES = 96

/**
 * Sobreposição tolerada entre duas fichas, em fração do quadrado. O arrasto
 * do jogador não gruda na grade: encostar de raspão na ficha vizinha não é
 * "parar sobre ela". Um quarto de quadrado de sobra ainda recusa quem solta
 * em cima do guarda, mesmo errando o centro por alguns pixels.
 */
const OCCUPY_OVERLAP_TOLERANCE = 0.25

export type StepMap = Pick<MapData, 'grid' | 'gridShape' | 'measurementMode' | 'movement'>

/**
 * Lê as regras de um valor cru (arquivo, snapshot). Passo precisa ser número
 * finito >= 1 (fração é truncada, acima do teto é cortado); ocupação só vale
 * `true`. Sem nenhuma regra válida volta `undefined` — o mapa fica livre e
 * sem campo novo, igual a um mapa de antes.
 */
export function readMovementRules(raw: unknown): MovementRules | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const step: unknown = Reflect.get(raw, 'maxStepCells')
  const occupy: unknown = Reflect.get(raw, 'tokensOccupy')
  const rules: MovementRules = {}
  if (typeof step === 'number' && Number.isFinite(step) && step >= 1) rules.maxStepCells = Math.min(MAX_STEP_CELLS_LIMIT, Math.floor(step))
  if (occupy === true) rules.tokensOccupy = true
  return rules.maxStepCells === undefined && rules.tokensOccupy === undefined ? undefined : rules
}

/** Passo máximo da cena em quadrados, ou `null` quando o movimento é livre. */
export function maxStepOf(map: Pick<MapData, 'movement'>): number | null {
  return readMovementRules(map.movement)?.maxStepCells ?? null
}

/** A cena liga "Fichas ocupam espaço"? */
export function tokensOccupy(map: Pick<MapData, 'movement'>): boolean {
  return readMovementRules(map.movement)?.tokensOccupy === true
}

function cellsBetween(map: StepMap, from: Point, to: Point): number {
  return measureCells(from, to, map.grid, map.gridShape, map.measurementMode)
}

function lerp(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

/**
 * Último ponto do segmento `from → to` a no máximo `max` quadrados de `from`,
 * sem arredondar. Busca binária e não fórmula: a régua 3.5e tem degrau
 * (`floor`) e não escala linear, e a busca serve às cinco réguas igual.
 */
function lastPointWithin(map: StepMap, from: Point, to: Point, max: number): Point {
  let lo = 0
  let hi = 1
  for (let i = 0; i < CLAMP_ITERATIONS; i += 1) {
    const mid = (lo + hi) / 2
    if (cellsBetween(map, from, lerp(from, to, mid)) <= max + STEP_EPSILON_CELLS) lo = mid
    else hi = mid
  }
  return lerp(from, to, lo)
}

/**
 * Onde a ficha para quando o jogador pede `to`: o próprio `to` dentro do
 * alcance (ou sem passo máximo), senão o último ponto válido na mesma
 * direção, em coordenada inteira. Coordenada não finita passa intacta: quem
 * recusa ponto fora do mapa é a validação (`outside_map`), não esta função.
 */
export function clampToMaxStep(map: StepMap, from: Point, to: Point): Point {
  const max = maxStepOf(map)
  if (max === null) return to
  const wanted = cellsBetween(map, from, to)
  if (!(wanted > max + STEP_EPSILON_CELLS)) return to
  const exact = lastPointWithin(map, from, to, max)
  const rounded = { x: Math.round(exact.x), y: Math.round(exact.y) }
  if (cellsBetween(map, from, rounded) <= max + STEP_EPSILON_CELLS) return rounded
  // O arredondamento cruzou o limite (degrau da régua 3.5e): trunca em direção à origem.
  return { x: from.x + Math.trunc(exact.x - from.x), y: from.y + Math.trunc(exact.y - from.y) }
}

/**
 * Contorno do alcance em volta de `from`, em px de mundo, ou `null` sem passo
 * máximo. Traçado com a MESMA régua do corte (raio a raio, até onde a ficha
 * pararia): na régua de tabuleiro sai um quadrado, na euclidiana um círculo —
 * nunca um círculo que promete um canto que a régua não deixa alcançar.
 */
export function reachOutline(map: StepMap, from: Point): Point[] | null {
  const max = maxStepOf(map)
  if (max === null || map.grid <= 0) return null
  // Longe o bastante para toda régua passar do limite: a de tabuleiro conta
  // no mínimo 1/√2 da distância reta, então 2x o passo sempre sobra.
  const far = 2 * (max + 1) * map.grid
  const outline: Point[] = []
  for (let i = 0; i < REACH_SAMPLES; i += 1) {
    const angle = (i / REACH_SAMPLES) * Math.PI * 2
    const target = { x: from.x + Math.cos(angle) * far, y: from.y + Math.sin(angle) * far }
    outline.push(lastPointWithin(map, from, target, max))
  }
  return outline
}

/**
 * A ficha (fora a que se move) cujo espaço `at` invade, ou `undefined`. Cada
 * ficha ocupa um quadrado de `size` casas em volta do centro; encostar não é
 * ocupar, e sobrepor até `OCCUPY_OVERLAP_TOLERANCE` de casa também não.
 */
export function findOccupant(tokens: readonly Token[], movingId: string, at: Point, grid: number): Token | undefined {
  const moving = tokens.find((t) => t.id === movingId)
  const movingSize = moving?.size ?? 1 // ficha fora da lista (não vista) conta como uma casa
  return tokens.find((t) => {
    if (t.id === movingId) return false
    const reach = ((movingSize + t.size) / 2 - OCCUPY_OVERLAP_TOLERANCE) * grid
    return Math.abs(t.x - at.x) < reach && Math.abs(t.y - at.y) < reach
  })
}
