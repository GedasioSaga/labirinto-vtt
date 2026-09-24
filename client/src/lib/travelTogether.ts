import type { MapData, Token } from '../types/map'
import { gatherSpots } from './gatherParty'
import type { Point } from './tokenSize'

/**
 * VIAJAR JUNTO (PEDIDOS.md, G10) — a parte pura: QUEM está perto de quem
 * pediu para passar e ONDE cada um chega em volta do pino par. Sem sessão,
 * sem rede: quem decide quem joga, quem está conectado e em que cena é
 * `net/hostSession.ts`; aqui só a conta.
 *
 * Mesa de 4 a 7: o grupo anda junto, e cada um ter de pedir separado para a
 * mesma escada é o mestre clicando "Deixar ir" sete vezes pelo mesmo gesto.
 */

/**
 * Até quantas casas da ficha de QUEM PEDIU alguém conta como "perto". Pela
 * maior distância entre coluna e linha (Chebyshev): a diagonal vale uma casa,
 * como no tabuleiro — é assim que o mestre conta de olho.
 */
export const NEAR_SQUARES = 2

/**
 * Folga, em px de mundo, para o centro "em cima" da casa: ficha solta à mão
 * fica um pixel fora do centro, e isso não pode tirá-la do grupo.
 */
const NEAR_EPSILON_PX = 1

/** Um jogador que talvez vá junto: as fichas dele na cena de quem pediu. */
export interface CompanionCandidate {
  playerId: string
  tokens: readonly Token[]
}

/** Quem vai junto, com a ficha que viaja. */
export interface Companion {
  playerId: string
  token: Token
}

/** `a` está a até `NEAR_SQUARES` casas de `b`, em Chebyshev? */
export function isNear(a: Point, b: Point, grid: number): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= NEAR_SQUARES * grid + NEAR_EPSILON_PX
}

/**
 * Os candidatos com alguma ficha perto de `requester`, na ordem em que
 * chegaram. De quem tem duas fichas perto, viaja a mais próxima: a outra é
 * outra figura do mesmo jogador, e arrastar as duas não é o que "ir junto" diz.
 */
export function companionsNear(requester: Point, grid: number, candidates: readonly CompanionCandidate[]): Companion[] {
  const near: Companion[] = []
  for (const candidate of candidates) {
    let best: Token | null = null
    for (const token of candidate.tokens) {
      if (!isNear(token, requester, grid)) continue
      if (best === null || Math.hypot(token.x - requester.x, token.y - requester.y) < Math.hypot(best.x - requester.x, best.y - requester.y)) best = token
    }
    if (best !== null) near.push({ playerId: candidate.playerId, token: best })
  }
  return near
}

/**
 * As casas de chegada de quem vai junto, uma por companheiro (na mesma
 * ordem), em volta do pino par — `null` = não coube, e ele fica onde estava.
 * A casa de quem pediu (`leader`, que chega na casa livre junto do pino por `arrivalSpot`)
 * conta como ocupada: a transferência dele ainda não está no mapa quando a
 * conta é feita, e sem isto dois chegariam na mesma casa.
 */
export function companionSpots(destination: MapData, pin: Point, leader: { x: number; y: number; size: number }, sizes: readonly number[]): (Point | null)[] {
  const leaderToken: Token = { id: 'viajar-junto:lider', characterId: null, name: '', x: leader.x, y: leader.y, size: leader.size, image: null }
  return gatherSpots({ ...destination, tokens: [...destination.tokens, leaderToken] }, pin, sizes)
}
