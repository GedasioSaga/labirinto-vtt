import type { MapData, Token } from '../types/map'

/**
 * LEVAR FICHA JUNTO — a parte pura: quem leva quem (`Token.levadoPor`), as
 * regras de prender e soltar e o "anda junto" do arrasto. Sem store, sem rede.
 * A chegada do outro lado do pino mora em `lib/carryArrival.ts` (depende da
 * procura de casa livre do "Reunir o grupo", que este arquivo não puxa, porque
 * `mapFactory` depende daqui).
 *
 * Um nível só: quem leva não é levado e quem é levado não leva. Sem cadeia,
 * o arrasto nunca precisa andar uma árvore, e um vínculo circular gravado à
 * mão num arquivo não trava nada — ele só move um nível.
 */

/** O id gravado no vínculo, se for um id de verdade. O mapa do disco chega cru. */
export function carrierIdOf(token: Token): string | null {
  const id: unknown = token.levadoPor
  return typeof id === 'string' && id !== '' && id !== token.id ? id : null
}

/** A ficha que leva `token` NESTE mapa. Vínculo para ficha que sumiu (apagada, outra cena) não conta. */
export function carrierOf(map: MapData, token: Token): Token | null {
  const id = carrierIdOf(token)
  if (id === null) return null
  return map.tokens.find((t) => t.id === id) ?? null
}

/** As fichas que `carrierId` leva neste mapa, na ordem do mapa. */
export function carriedBy(map: MapData, carrierId: string): Token[] {
  return map.tokens.filter((t) => t.id !== carrierId && carrierIdOf(t) === carrierId)
}

/**
 * Pode prender `carriedId` a `carrierId`? As duas existem, são fichas
 * diferentes, quem leva não é levado e quem vai ser levado não leva ninguém.
 */
function canCarry(map: MapData, carriedId: string, carrierId: string): boolean {
  if (carriedId === carrierId) return false
  const carried = map.tokens.find((t) => t.id === carriedId)
  const carrier = map.tokens.find((t) => t.id === carrierId)
  if (carried === undefined || carrier === undefined) return false
  return carrierOf(map, carrier) === null && carriedBy(map, carriedId).length === 0
}

/**
 * As fichas a que `tokenId` pode ser presa, da mais perto à mais longe: o
 * mestre prende o ferido a quem está do lado dele, e esse vem primeiro.
 */
export function carryCandidates(map: MapData, tokenId: string): Token[] {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return []
  const distance = (t: Token): number => Math.hypot(t.x - token.x, t.y - token.y)
  return map.tokens.filter((t) => canCarry(map, tokenId, t.id)).sort((a, b) => distance(a) - distance(b))
}

/** Prende `carriedId` a `carrierId`. Recusado pelas regras: o MESMO mapa (mesma referência). */
export function attachCarried(map: MapData, carriedId: string, carrierId: string): MapData {
  if (!canCarry(map, carriedId, carrierId)) return map
  return { ...map, tokens: map.tokens.map((t) => (t.id === carriedId ? { ...t, levadoPor: carrierId } : t)) }
}

/** Solta `carriedId`: o campo some (ficha volta ao formato de antes). Sem vínculo: o mesmo mapa. */
export function releaseCarried(map: MapData, carriedId: string): MapData {
  const carried = map.tokens.find((t) => t.id === carriedId)
  if (carried === undefined || !('levadoPor' in carried)) return map
  return { ...map, tokens: map.tokens.map((t) => (t.id === carriedId ? withoutCarrier(t) : t)) }
}

/** Uma ficha como o painel do mestre a nomeia. */
export interface CarryRef {
  id: string
  name: string
}

/** O que o painel "Levar junto" mostra da ficha selecionada. */
export interface CarryRefs {
  carrier: CarryRef | null
  carried: CarryRef[]
  candidates: CarryRef[]
}

const refOf = (token: Token): CarryRef => ({ id: token.id, name: token.name })

/** Quem leva `token`, quem ele leva e a quem pode ser preso. Sem ficha selecionada: tudo vazio. */
export function carryRefsOf(map: MapData, token: Token | null): CarryRefs {
  if (token === null) return { carrier: null, carried: [], candidates: [] }
  const carrier = carrierOf(map, token)
  return {
    carrier: carrier === null ? null : refOf(carrier),
    carried: carriedBy(map, token.id).map(refOf),
    candidates: carryCandidates(map, token.id).map(refOf),
  }
}

/** A ficha sem o campo do vínculo. Sem o campo, o mesmo objeto. */
export function withoutCarrier(token: Token): Token {
  if (!('levadoPor' in token)) return token
  const { levadoPor: _vinculo, ...solta } = token
  return solta
}
