/**
 * DADO ROLADO NA SALA, a parte pura: o que se pode pedir, como a mesa lê a
 * rolagem ("2d6+3") e a rolagem em si. Quem rola é SEMPRE o host: o jogador
 * só pede (quantidade, dado, modificador) e recebe o resultado de volta, igual
 * a todo mundo — assim ninguém rola "20" na própria máquina.
 */

/** Os dados da mesa. Outro número de lados não existe no pedido nem na volta. */
export const DICE_SIDES = [4, 6, 8, 10, 12, 20] as const
export type DiceSides = (typeof DICE_SIDES)[number]

export const DICE_COUNT_MIN = 1
/** Punhado grande o bastante para a bola de fogo, pequeno para a mensagem não inchar. */
export const DICE_COUNT_MAX = 20
/** Modificador vai de −99 a +99: sobra para qualquer ficha, segura quem inventa número. */
export const DICE_MODIFIER_LIMIT = 99

/** Quantas rolagens cada tela guarda. Passou, sai a mais antiga. */
export const DICE_FEED_MAX = 20
/** Quantas a lista mostra sobre o mapa: as últimas, sem cobrir o jogo. */
export const DICE_FEED_VISIBLE = 4

/** Como o mestre aparece na rolagem dele. */
export const MASTER_ROLLER_NAME = 'Mestre'

/** Menos tipográfico (U+2212): é o que a tela mostra, e o leitor de tela lê "menos". */
const MINUS = '−'

export interface DiceRequest {
  count: number
  sides: DiceSides
  modifier: number
}

/**
 * Uma rolagem como a mesa a vê. `id` é do host; `from` é o nome de quem rolou
 * na sala (o mestre: `MASTER_ROLLER_NAME`, com `master`). Nada de cena, de
 * posição ou de id de jogador: a rolagem vai a todos.
 */
export interface DiceRollEntry extends DiceRequest {
  id: string
  from: string
  master?: true
  results: number[]
  total: number
  /** Hora do host (ms desde 1970). */
  at: number
}

/**
 * A rolagem como o HOST a guarda: a da mesa mais a marca `hidden` da rolagem
 * escondida do mestre, que só a tela dele mostra e nunca vai ao fio.
 */
export interface HostDiceRoll extends DiceRollEntry {
  hidden?: true
}

/** O dado injetável: devolve uma face de 1 a `sides`. */
export type RollDie = (sides: DiceSides) => number

export function isDiceSides(value: unknown): value is DiceSides {
  return DICE_SIDES.some((sides) => sides === value)
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function isDiceCount(value: unknown): value is number {
  return isIntegerIn(value, DICE_COUNT_MIN, DICE_COUNT_MAX)
}

export function isDiceModifier(value: unknown): value is number {
  return isIntegerIn(value, -DICE_MODIFIER_LIMIT, DICE_MODIFIER_LIMIT)
}

/**
 * Valida o pedido que vem de fora (a rede, o formulário). Devolve cópia só com
 * os três campos: resultado ou total que viessem junto ficam para trás.
 */
export function parseDiceRequest(value: unknown): DiceRequest | null {
  if (typeof value !== 'object' || value === null) return null
  const count: unknown = Reflect.get(value, 'count')
  const sides: unknown = Reflect.get(value, 'sides')
  const modifier: unknown = Reflect.get(value, 'modifier')
  if (!isDiceCount(count) || !isDiceSides(sides) || !isDiceModifier(modifier)) return null
  return { count, sides, modifier }
}

export function rollDice(request: DiceRequest, rollDie: RollDie): { results: number[]; total: number } {
  const results: number[] = []
  for (let i = 0; i < request.count; i += 1) results.push(rollDie(request.sides))
  return { results, total: results.reduce((sum, face) => sum + face, request.modifier) }
}

/** Faixa de uma palavra de 32 bits: o maior múltiplo de `sides` que cabe nela. */
const UINT32_RANGE = 0x1_0000_0000

/**
 * Face de 1 a `sides` pelo gerador do sistema (`crypto`), sem viés: o sorteio
 * que cai no pedaço que não fecha um múltiplo de `sides` é jogado fora.
 */
export function secureRollDie(sides: DiceSides): number {
  const limit = UINT32_RANGE - (UINT32_RANGE % sides)
  const word = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(word)
    const value = word[0]
    if (value < limit) return (value % sides) + 1
  }
}

/** "2d6+3", "1d20", "1d4−5". */
export function formatDiceExpression(request: DiceRequest): string {
  const base = `${request.count}d${request.sides}`
  if (request.modifier === 0) return base
  return request.modifier > 0 ? `${base}+${request.modifier}` : `${base}${MINUS}${-request.modifier}`
}

export function formatDiceTotal(total: number): string {
  return total < 0 ? `${MINUS}${-total}` : String(total)
}

/**
 * Quem rolou, como a lista mostra. O jogador que entrou com o nome "Mestre"
 * ganha " (jogador)": a rolagem dele não se passa pela do mestre.
 */
export function rollerLabel(roll: DiceRollEntry): string {
  if (roll.master === true) return MASTER_ROLLER_NAME
  return roll.from.trim().toLowerCase() === MASTER_ROLLER_NAME.toLowerCase() ? `${roll.from} (jogador)` : roll.from
}
