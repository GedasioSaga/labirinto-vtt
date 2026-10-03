import type { MapData } from '../types/map'
import { travelPinsClearance } from '../net/hostSession'
import { vehicleRiderSpots, type SeatHold } from './gatherParty'
import { moveTokenCarryingLights } from './lightAttachment'
import { withPlayerVisibleTokens } from './pinTravel'
import { mapaDoPiso, pisoDe } from './pisos'
import { tokenSizeInSquares } from './tokenSize'
import { hopVehicle, passengersOf } from './vehicle'

/**
 * VEÍCULO no ATALHO NA MESMA CENA: o veículo SALTA para (x, y) com todos a
 * bordo (`hopVehicle`, sem conferir o trajeto — a parede entre os dois pinos
 * não derruba ninguém) e cada passageiro ASSENTA no destino pela regra da
 * travessia entre cenas (`adventureStore.transferToken`, `vehicleRiderSpots`):
 * no afastamento que tinha, quando a casa serve (no chão, sem parede cortando
 * nem no meio, sem ficha em cima, fora da casa e da cabeça dos pinos de
 * viagem); senão, na casa livre mais perto do veículo. Antes o afastamento ia
 * às cegas e quem estava fora do contorno do veículo podia pousar numa
 * parede. Continua a bordo, e a tocha presa vai com ele.
 *
 * Só a planta do piso do veículo barra (`mapaDoPiso`). Ficha secreta ou
 * escondida pelo mestre não ocupa casa (`withPlayerVisibleTokens`): desviar
 * dela contaria ao jogador que há algo ali. `hold`: as casas já dadas a quem
 * atravessa depois (ajudante, séquito) e o que fica livre.
 *
 * Veículo vazio: só ele salta. Veículo que não existe: o mesmo mapa.
 */
export function hopVehicleSeated(map: MapData, vehicleId: string, x: number, y: number, hold?: SeatHold): MapData {
  const vehicle = map.tokens.find((t) => t.id === vehicleId)
  if (vehicle === undefined) return map
  const riders = passengersOf(map, vehicleId)
  const hopped = hopVehicle(map, vehicleId, x, y)
  if (riders.length === 0) return hopped
  const going = new Set([vehicleId, ...riders.map((r) => r.id)])
  // Quem salta não ocupa casa no destino: o veículo entra pela casa dele, e cada passageiro pela que achar.
  const planta = mapaDoPiso({ ...map, tokens: map.tokens.filter((t) => !going.has(t.id)) }, pisoDe(vehicle))
  const seats = vehicleRiderSpots(
    withPlayerVisibleTokens(planta),
    { x, y, size: tokenSizeInSquares(vehicle) },
    riders.map((r) => ({ dx: r.x - vehicle.x, dy: r.y - vehicle.y, size: tokenSizeInSquares(r) })),
    [...travelPinsClearance(planta), ...(hold?.keepClear ?? [])],
    hold?.seats ?? [],
  )
  return riders.reduce((next, rider, index) => {
    const seat = seats[index]
    const now = next.tokens.find((t) => t.id === rider.id)
    if (seat === undefined || now === undefined || (now.x === seat.x && now.y === seat.y)) return next
    return moveTokenCarryingLights(next, rider.id, seat.x, seat.y)
  }, hopped)
}
