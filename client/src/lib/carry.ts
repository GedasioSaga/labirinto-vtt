import type { MapData, Token } from '../types/map'
import { validateTokenMove } from './moveValidation'

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
 * O passo da ficha levada quando quem a leva anda (`dx`, `dy`) em `map` (o
 * mapa ANTES do passo: as paredes e o lugar dela de onde ela sai). Em mapa
 * com pisos, quem chama passa o recorte do piso DELA (`mapaDoPiso`): o mapa
 * inteiro poria a parede do térreo no caminho de quem está no 1º piso. Anda o
 * mesmo deslocamento SÓ se o trajeto DELA é livre — parede, porta fechada,
 * fora do chão e fora do mapa barram, pela mesma regra do passo do jogador
 * (`validateTokenMove`, sem posse, vez nem ocupação, que são do pedido e não
 * do trajeto). Barrada, fica onde está e o vínculo continua: validar só o
 * passo de quem leva deixava a ficha de OUTRO jogador atravessar parede e
 * enxergar de dentro de uma sala que o grupo nunca alcançou.
 */
export function followStep(map: MapData, carried: Token, dx: number, dy: number): Token {
  const verdict = validateTokenMove(map, { playerId: '', tokenId: carried.id, x: carried.x + dx, y: carried.y + dy }, {}, { isHost: true })
  return verdict.ok ? { ...carried, x: verdict.x, y: verdict.y } : carried
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
 *
 * As regras são as de `canCarry`, com a conta montada uma vez para o mapa
 * inteiro: o App refaz esta lista em todo render, e no arrasto ele renderiza a
 * cada pointermove. Chamar `canCarry` por candidata fazia dois `find` e um
 * `filter` no mapa para cada uma — O(n²), ~4 ms por pointermove com 800 fichas.
 */
export function carryCandidates(map: MapData, tokenId: string): Token[] {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return []
  // Quem leva alguém não pode ser levado: não depende da candidata, então nenhuma serve.
  if (carriedBy(map, tokenId).length > 0) return []
  const ids = new Set(map.tokens.map((t) => t.id))
  // Solta = sem vínculo, ou com vínculo para ficha que não está neste mapa
  // (`carrierOf` nulo). Quem decide é a PRIMEIRA ficha de cada id, a mesma que
  // o `find` de `canCarry` acha: mapa do disco com id repetido dá a lista de antes.
  const soltaPorId = new Map<string, boolean>()
  for (const t of map.tokens) {
    if (soltaPorId.has(t.id)) continue
    const carrierId = carrierIdOf(t)
    soltaPorId.set(t.id, carrierId === null || !ids.has(carrierId))
  }
  const distance = (t: Token): number => Math.hypot(t.x - token.x, t.y - token.y)
  // O sort é estável: no empate de distância, fica a ordem do mapa.
  return map.tokens.filter((t) => t.id !== tokenId && soltaPorId.get(t.id) === true).sort((a, b) => distance(a) - distance(b))
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

/**
 * A mesma lista para o painel: as mesmas fichas, com os mesmos nomes, na mesma
 * ordem — tudo o que as <option> do "Vai junto de" mostram. No arrasto a lista
 * chega nova (arrays e objetos novos) a cada pointermove, e quase sempre igual.
 */
export function sameCarryRefs(a: readonly CarryRef[], b: readonly CarryRef[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((ref, i) => ref.id === b[i].id && ref.name === b[i].name)
}

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
