import type { MapData, Token } from '../types/map'
import { gatherSpots } from './gatherParty'
import { withPlayerVisibleTokens } from './pinTravel'
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
export function companionSpots(
  destination: MapData,
  pin: Point,
  leader: { x: number; y: number; size: number },
  sizes: readonly number[],
  alsoTaken: readonly Seat[] = [],
): (Point | null)[] {
  return gatherSpots(withSeats(destination, [leader, ...alsoTaken]), pin, sizes)
}

/** Uma casa que já tem dono nesta viagem, mas cuja ficha ainda não está no mapa de destino. */
export interface Seat {
  x: number
  y: number
  size: number
}

/** `destination` com `seats` ocupando casa, como fichas de mentira. */
function withSeats(destination: MapData, seats: readonly Seat[]): MapData {
  const pseudo = seats.map((seat, index): Token => ({ id: `viajar-junto:casa-${index}`, characterId: null, name: '', x: seat.x, y: seat.y, size: seat.size, image: null }))
  return { ...destination, tokens: [...destination.tokens, ...pseudo] }
}

/**
 * MONTARIA E FAMILIAR: as OUTRAS fichas do mesmo dono a até `NEAR_SQUARES`
 * casas de `lead`, a ficha que viaja — o pônei, a coruja. `own` já vem só com
 * as fichas dele que estão no tabuleiro (quem escolhe é a sessão); a ordem é a
 * de `own`.
 */
export function entourageNear(lead: Token, own: readonly Token[], grid: number): Token[] {
  return own.filter((token) => token.id !== lead.id && isNear(token, lead, grid))
}

/**
 * As casas do séquito em volta de `center` (onde a ficha principal chega),
 * uma por tamanho em `sizes`, na mesma ordem; `null` = não coube, e aquela
 * ficha fica onde estava. `taken` são as casas já dadas nesta viagem (a do
 * dono, a de quem foi junto). A procura só enxerga as fichas que algum
 * jogador vê (`withPlayerVisibleTokens`): se o pônei desviasse de um guarda
 * escondido, o lugar onde ele sentou entregaria o guarda.
 */
export function entourageSeats(destination: MapData, center: Point, taken: readonly Seat[], sizes: readonly number[]): (Point | null)[] {
  if (sizes.length === 0) return []
  return gatherSpots(withSeats(withPlayerVisibleTokens(destination), taken), center, sizes)
}
