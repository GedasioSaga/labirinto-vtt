import type { MapData, Token } from '../types/map'
import { gatherSpots } from './gatherParty'
import { tokenSizeInSquares, type Point } from './tokenSize'

/** Onde uma ficha levada junto assenta na cena de destino. */
export interface CarriedArrival {
  tokenId: string
  x: number
  y: number
}

/**
 * LEVAR FICHA JUNTO do outro lado do pino: cada ficha levada assenta numa casa
 * livre em volta da casa onde quem leva chegou (`spot`) — a mesma procura do
 * "Reunir o grupo aqui" (`gatherSpots`: chão, parede e ficha contam). Quem
 * leva entra no mapa de destino ANTES da procura, para ninguém cair em cima
 * dela. Sem casa livre até o limite da procura, a ficha assenta na própria
 * `spot`: ficar para trás largaria o ferido numa cena sem ninguém.
 */
export function companionArrivals(to: MapData, carrier: Token, spot: Point, companions: readonly Token[]): CarriedArrival[] {
  if (companions.length === 0) return []
  const withCarrier: MapData = { ...to, tokens: [...to.tokens, { ...carrier, x: spot.x, y: spot.y }] }
  const spots = gatherSpots(withCarrier, spot, companions.map(tokenSizeInSquares))
  return companions.map((token, i) => {
    const seat = spots[i] ?? null
    return { tokenId: token.id, x: seat === null ? spot.x : seat.x, y: seat === null ? spot.y : seat.y }
  })
}
