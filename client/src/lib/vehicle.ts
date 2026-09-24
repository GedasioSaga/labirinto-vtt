import type { MapData, Token, TokenVehicle } from '../types/map'
import { carryAttachedLights, moveTokenCarryingLights } from './lightAttachment'

/**
 * VEÍCULO COM LUGARES (cesto, bote, vagonete) — regras puras, compartilhadas
 * pelo editor do mestre (`mapFactory.setTokenPosition`), pelo disco
 * (`lib/mapFile.ts`), pela travessia entre cenas (`adventureStore`) e pelo
 * painel da ficha. Sem DOM, sem store.
 *
 * O veículo é uma ficha com `veiculo`; os passageiros são outras fichas DA
 * MESMA CENA, guardadas pelo id na lista dele. Quem está a bordo anda junto
 * com o veículo; andar sozinho é descer. Veículo não embarca em veículo.
 */

export const VEHICLE_SEATS_MIN = 1
/** Teto de lugares: um bote grande leva o grupo inteiro (4 a 7) e sobra; arquivo editado à mão não incha o mapa. */
export const VEHICLE_SEATS_MAX = 12
/** Lugares de quem acabou de ligar o veículo: o cesto do pedido leva dois. */
export const VEHICLE_SEATS_DEFAULT = 2
/** Teto do id de ficha lido do disco: id do app é curto; texto enorme é lixo. */
const PASSENGER_ID_MAX_LENGTH = 128

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSeatCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= VEHICLE_SEATS_MIN && value <= VEHICLE_SEATS_MAX
}

/** Monta o veículo já limpo: lista sem vazio nem repetição, cortada nos lugares; lista vazia não é gravada. */
function buildVehicle(lugares: number, passageiros: readonly string[]): TokenVehicle {
  const ids = [...new Set(passageiros.filter((id) => id !== ''))].slice(0, lugares)
  return ids.length > 0 ? { lugares, passageiros: ids } : { lugares }
}

/**
 * `Token.veiculo` como vem do disco. Lugares fora da faixa (ou não inteiro)
 * = AUSENTE: a ficha volta a ser comum. Lista torta vira vazia; na lista, só
 * texto curto e não vazio fica, sem repetição e até os lugares.
 */
export function readTokenVehicle(value: unknown): TokenVehicle | undefined {
  if (!isRecord(value) || !isSeatCount(value.lugares)) return undefined
  const lista = Array.isArray(value.passageiros) ? value.passageiros : []
  const ids = lista.filter((id): id is string => typeof id === 'string' && id.length <= PASSENGER_ID_MAX_LENGTH)
  return buildVehicle(value.lugares, ids)
}

/** O veículo da ficha, lido e sem a própria ficha na lista; `null` = ficha comum. */
export function vehicleOf(token: Token): TokenVehicle | null {
  const vehicle = readTokenVehicle(token.veiculo)
  if (vehicle === undefined) return null
  return buildVehicle(vehicle.lugares, (vehicle.passageiros ?? []).filter((id) => id !== token.id))
}

/**
 * Quem está a bordo do veículo `vehicleId` AGORA, na ordem do embarque: só
 * fichas que estão nesta cena e não são veículo. Id que sobrou de ficha
 * apagada ou que saiu da cena não ocupa lugar.
 */
export function passengerIdsOf(map: MapData, vehicleId: string): string[] {
  const vehicleToken = map.tokens.find((t) => t.id === vehicleId)
  const vehicle = vehicleToken === undefined ? null : vehicleOf(vehicleToken)
  if (vehicle === null) return []
  return (vehicle.passageiros ?? []).filter((id) => {
    const passenger = map.tokens.find((t) => t.id === id)
    return passenger !== undefined && vehicleOf(passenger) === null
  })
}

/** As fichas a bordo, na ordem do embarque: é o grupo que atravessa junto com o veículo. */
export function passengersOf(map: MapData, vehicleId: string): Token[] {
  return passengerIdsOf(map, vehicleId).flatMap((id) => map.tokens.filter((t) => t.id === id))
}

/** O veículo que leva a ficha `tokenId` nesta cena; `null` = ela anda a pé. */
export function vehicleCarrying(map: MapData, tokenId: string): Token | null {
  return map.tokens.find((t) => t.id !== tokenId && passengerIdsOf(map, t.id).includes(tokenId)) ?? null
}

function withVehicle(map: MapData, tokenId: string, vehicle: TokenVehicle): MapData {
  return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, veiculo: vehicle } : t)) }
}

/** Tira a ficha da lista de todo veículo da cena. Ninguém a levava: o MESMO mapa. */
export function leaveVehicle(map: MapData, tokenId: string): MapData {
  let changed = false
  const tokens = map.tokens.map((t) => {
    const vehicle = t.veiculo === undefined ? null : vehicleOf(t)
    if (vehicle === null || !(vehicle.passageiros ?? []).includes(tokenId)) return t
    changed = true
    return { ...t, veiculo: buildVehicle(vehicle.lugares, (vehicle.passageiros ?? []).filter((id) => id !== tokenId)) }
  })
  return changed ? { ...map, tokens } : map
}

/** Por que o embarque não aconteceu. */
export type BoardRefusal = 'cheio' | 'sem-veiculo' | 'sem-ficha' | 'propria' | 'e-veiculo'

export type BoardResult = { ok: true; map: MapData } | { ok: false; motivo: BoardRefusal }

/**
 * Põe a ficha `tokenId` a bordo do veículo `vehicleId`. Recusa com o motivo,
 * sem mexer no mapa: veículo cheio, ficha que não é veículo, a própria ficha,
 * outro veículo, ficha que não está na cena. Quem já está a bordo: o mesmo
 * mapa. Quem estava noutro veículo desce dele antes (um lugar por ficha).
 */
export function boardVehicle(map: MapData, vehicleId: string, tokenId: string): BoardResult {
  const vehicleToken = map.tokens.find((t) => t.id === vehicleId)
  const vehicle = vehicleToken === undefined ? null : vehicleOf(vehicleToken)
  if (vehicle === null) return { ok: false, motivo: 'sem-veiculo' }
  if (tokenId === vehicleId) return { ok: false, motivo: 'propria' }
  const passenger = map.tokens.find((t) => t.id === tokenId)
  if (passenger === undefined) return { ok: false, motivo: 'sem-ficha' }
  if (vehicleOf(passenger) !== null) return { ok: false, motivo: 'e-veiculo' }
  const aboard = passengerIdsOf(map, vehicleId)
  if (aboard.includes(tokenId)) return { ok: true, map }
  if (aboard.length >= vehicle.lugares) return { ok: false, motivo: 'cheio' }
  return { ok: true, map: withVehicle(leaveVehicle(map, tokenId), vehicleId, buildVehicle(vehicle.lugares, [...aboard, tokenId])) }
}

/**
 * Liga o veículo com `lugares` (levado para a faixa), troca os lugares, ou
 * desliga com `null` — quem estava a bordo fica onde está, a pé. Baixar os
 * lugares abaixo de quem está a bordo desce os últimos que embarcaram. A
 * ficha que estava a bordo de outro veículo desce antes de virar veículo.
 */
export function setVehicleSeats(map: MapData, tokenId: string, lugares: number | null): MapData {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return map
  if (lugares === null) {
    if (!('veiculo' in token)) return map
    return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? withoutVehicleField(t) : t)) }
  }
  const seats = Math.min(VEHICLE_SEATS_MAX, Math.max(VEHICLE_SEATS_MIN, Math.round(lugares)))
  const current = vehicleOf(token) === null ? [] : passengerIdsOf(map, tokenId)
  return withVehicle(leaveVehicle(map, tokenId), tokenId, buildVehicle(seats, current))
}

/** A ficha sem o campo `veiculo` (sem deixar a chave com `undefined` no JSON). */
export function withoutVehicleField(token: Token): Token {
  if (!('veiculo' in token)) return token
  const { veiculo: _veiculo, ...rest } = token
  return rest
}

/**
 * Põe a ficha em (x, y) com a regra do veículo: o VEÍCULO leva quem está a
 * bordo (e as tochas presas neles) pelo mesmo deslocamento; o PASSAGEIRO que
 * anda sozinho desce. Ficha comum: só ela e a tocha dela, como sempre.
 */
export function moveTokenWithVehicle(map: MapData, tokenId: string, x: number, y: number): MapData {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return map
  const aboard = vehicleOf(token) === null ? [] : passengerIdsOf(map, tokenId)
  if (aboard.length === 0) {
    const moved = moveTokenCarryingLights(map, tokenId, x, y)
    return token.x === x && token.y === y ? moved : leaveVehicle(moved, tokenId)
  }
  const dx = x - token.x
  const dy = y - token.y
  const riders = new Set(aboard)
  return {
    ...map,
    tokens: map.tokens.map((t) => {
      if (t.id === tokenId) return { ...t, x, y }
      return riders.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t
    }),
    lights: carryAttachedLights(map.lights, new Set([tokenId, ...aboard]), dx, dy),
  }
}

/** Uma ficha da cena como o painel do veículo a mostra. */
export interface VehicleSeatOption {
  id: string
  nome: string
  aBordo: boolean
  /** Dá para marcar ou desmarcar: quem está a bordo sempre; quem está fora, só com lugar livre. */
  disponivel: boolean
}

/**
 * As fichas do painel do veículo: as da cena, na ordem do mapa, menos o
 * próprio veículo e os outros veículos (não embarcam).
 */
export function vehicleSeatOptions(map: MapData, vehicleId: string): VehicleSeatOption[] {
  const vehicleToken = map.tokens.find((t) => t.id === vehicleId)
  const vehicle = vehicleToken === undefined ? null : vehicleOf(vehicleToken)
  if (vehicle === null) return []
  const aboard = passengerIdsOf(map, vehicleId)
  const cheio = aboard.length >= vehicle.lugares
  return map.tokens
    .filter((t) => t.id !== vehicleId && vehicleOf(t) === null)
    .map((t) => {
      const aBordo = aboard.includes(t.id)
      return { id: t.id, nome: t.name.trim() === '' ? 'Ficha sem nome' : t.name, aBordo, disponivel: aBordo || !cheio }
    })
}
