import type { Token } from '../types/map'
import { PIN_TRAVEL_MAX_TOKENS } from '../net/protocol'
import { readContract } from './tokenLoan'
import { isNear } from './travelTogether'
import type { Point } from './tokenSize'

/**
 * ESCOLHER FICHAS NO PINO — a conta dividida pelo host (validar a lista que o
 * jogador manda, `net/hostSession.ts`) e pela tela do jogador (quais caixas o
 * cartão do pino oferece, `player/main.tsx`). O que o cartão oferece é o que o
 * host aceita.
 */

/**
 * Quem pode passar pelo pino: a ficha mais perto dele e as outras a até 2
 * casas dela (`isNear`, a regra da montaria e do familiar), da mais perto do
 * pino para a mais longe — a primeira é a que vai à frente. `own` já tem de
 * ser só as fichas do jogador que ele vê: ficha escondida não entra aqui.
 *
 * No máximo `PIN_TRAVEL_MAX_TOKENS`, as mais perto: o cartão marca todas de
 * início, e uma lista maior que o teto seria recusada inteira pelo protocolo.
 */
export function pinTravelGroup<T extends Point>(own: readonly T[], pin: Point, grid: number): T[] {
  const byDistance = own
    .map((token) => ({ token, distance: Math.hypot(token.x - pin.x, token.y - pin.y) }))
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.token)
  const nearest = byDistance[0]
  if (nearest === undefined) return []
  return byDistance.filter((token) => token === nearest || isNear(token, nearest, grid)).slice(0, PIN_TRAVEL_MAX_TOKENS)
}

/** Uma caixa do "Quem passa?": a ficha e o nome dela. */
export interface PinTravelChoice {
  id: string
  name: string
}

/**
 * As caixas do cartão do pino: o grupo (`pinTravelGroup`) das fichas de
 * `ownIds` que estão em `tokens` (o recorte do jogador). O ajudante contratado
 * (com `contrato`) não é caixa — ele segue o jogador sozinho — salvo quando é
 * a única ficha na mão, e aí é ele que viaja, como no host.
 */
export function pinTravelChoices(tokens: readonly Token[], ownIds: readonly string[], pin: Point, grid: number): PinTravelChoice[] {
  const owned = new Set(ownIds)
  const mine = tokens.filter((t) => owned.has(t.id))
  const own = mine.filter((t) => readContract(t.contrato) === undefined)
  const candidates = own.length > 0 ? own : mine
  return pinTravelGroup(candidates, pin, grid).map((t) => ({ id: t.id, name: t.name }))
}
