import type { MapData, Pin, Token } from '../types/map'
import { tokenRadiusOf } from './doorReach'
import { gatherSpots } from './gatherParty'
import { arrivalSpot, isArrivalOnly, resolvePinTravel, type TravelScene } from './pinTravel'
import { passageOf } from './pins'
import { TOKEN_SIZE_DEFAULT, tokenSizeInSquares, type Point } from './tokenSize'

/**
 * CARAVANA NO MAPA-MUNDI. Numa cena marcada como mapa-mundi (`MapData.worldMap`)
 * o grupo inteiro anda como UMA ficha só, que o mestre move. No mapa do mestre
 * as fichas continuam existindo, empilhadas no mesmo ponto (é isso que deixa a
 * volta para uma cena comum trivial: cada ficha já é a de sempre). O jogador
 * recebe só a caravana: nem o nome, nem a foto, nem a vida, nem o id das
 * fichas de ninguém — nem da própria (`lib/fogFilter.ts`).
 *
 * Chegando numa cidade (pino de viagem ligado a outra cena), o mestre
 * desembarca: cada ficha volta a ser ela mesma na cena de destino, em volta
 * do pino par (`net/hostSession.ts` → `disembarkCaravan`).
 */

/** Id da ficha que o jogador recebe no lugar do grupo. Nunca é id de ficha real. */
export const CARAVAN_TOKEN_ID = 'caravana'
export const CARAVAN_NAME = 'Caravana'

export function isWorldMap(map: Pick<MapData, 'worldMap'>): boolean {
  return map.worldMap === true
}

/**
 * As fichas do grupo nesta cena, na ordem do mapa. `party` são as fichas de
 * TODOS os jogadores da sala. Ficha "oculta no editor" fica de fora, pela
 * mesma regra do recorte (que nunca a trata como ficha do jogador).
 */
export function caravanMembers(map: MapData, party: ReadonlySet<string>): Token[] {
  return map.tokens.filter((t) => party.has(t.id) && t.hidden !== true)
}

/** Onde a caravana está: a primeira ficha do grupo, na ordem do mapa. `null` = ninguém nesta cena. */
export function caravanPoint(members: readonly Token[]): Point | null {
  const first = members[0]
  return first === undefined ? null : { x: first.x, y: first.y }
}

/** O tamanho da caravana: o da maior ficha do grupo (nunca a soma — o tamanho não conta quantos são). */
export function caravanSize(members: readonly Token[]): number {
  const maior = members.reduce((acc, t) => Math.max(acc, tokenSizeInSquares(t)), 0)
  return maior > 0 ? maior : TOKEN_SIZE_DEFAULT
}

/** A ficha que o jogador recebe: sem nada de ninguém, só o ponto e o tamanho da maior ficha do grupo. */
export function caravanTokenFor(members: readonly Token[], at: Point): Token {
  return { id: CARAVAN_TOKEN_ID, characterId: null, name: CARAVAN_NAME, x: at.x, y: at.y, size: caravanSize(members), image: null }
}

export interface CaravanMove {
  tokenId: string
  x: number
  y: number
}

/** O que a caravana lembra do passo anterior: onde estava e quem já era dela. */
export interface CaravanMemory {
  at: Point
  memberIds: readonly string[]
}

export interface CaravanStep {
  /** Onde a caravana está depois do passo. */
  at: Point
  /** Fichas do grupo fora desse ponto: andam para ele. */
  moves: CaravanMove[]
  /** O que guardar para o próximo passo. */
  memory: CaravanMemory
}

/**
 * O mestre arrastou UMA ficha do grupo: a caravana vai com ela. `last` é o
 * passo anterior (`null` = a caravana acabou de se formar, no ponto da
 * primeira ficha). Só conta como "arrastada" a ficha que JÁ era da caravana e
 * saiu do ponto dela — a primeira assim, na ordem do mapa. Ficha que acabou de
 * entrar no grupo (atribuída agora, ou chegando de outra cena) não puxa a
 * caravana: ela é que vai para lá. Nada saiu: fica. `null` = ninguém nesta cena.
 */
export function caravanStep(members: readonly Token[], last: CaravanMemory | null): CaravanStep | null {
  const first = caravanPoint(members)
  if (first === null) return null
  const known = last === null ? [] : members.filter((t) => last.memberIds.includes(t.id))
  let at: Point
  if (last === null || known.length === 0) {
    at = first
  } else {
    const moved = known.find((t) => t.x !== last.at.x || t.y !== last.at.y)
    at = moved === undefined ? last.at : { x: moved.x, y: moved.y }
  }
  const moves = members.filter((t) => t.x !== at.x || t.y !== at.y).map((t) => ({ tokenId: t.id, x: at.x, y: at.y }))
  return { at, moves, memory: { at, memberIds: members.map((t) => t.id) } }
}

/** A cidade onde a caravana parou: o pino de viagem embaixo dela e para onde ele leva. */
export interface CaravanCity {
  pinId: string
  toSceneId: string
  toSceneName: string
  partner: Pin
}

/**
 * A caravana está EM CIMA de um pino de viagem (o centro do pino dentro do
 * disco dela) que leva a outra cena. Passagem trancada e chegada oculta (mão
 * única) não contam: nem o jogador sozinho passaria por elas. Com dois pinos
 * sob a caravana, vale o mais perto.
 */
export function caravanCity(
  map: MapData,
  at: Point,
  caravanSize: number,
  hereSceneId: string | null,
  sceneById: (sceneId: string) => TravelScene | null,
): CaravanCity | null {
  const reach = tokenRadiusOf({ size: caravanSize }, map.grid)
  const candidates = map.pins
    .filter((p) => p.kind === 'viagem' && !isArrivalOnly(p) && passageOf(p) !== 'trancada')
    .map((p) => ({ pin: p, distance: Math.hypot(p.x - at.x, p.y - at.y) }))
    .filter((c) => c.distance <= reach)
    .sort((a, b) => a.distance - b.distance)
  for (const { pin } of candidates) {
    const travel = resolvePinTravel(pin, hereSceneId, sceneById)
    if (travel.status === 'ligado') return { pinId: pin.id, toSceneId: travel.sceneId, toSceneName: travel.sceneName, partner: travel.partner }
  }
  return null
}

/**
 * Onde cada ficha do grupo assenta na cidade: as casas livres em volta do
 * pino par (`gatherSpots`), na ordem de `members`. Sem casa livre, a ficha
 * chega na ponta do pino (`arrivalSpot`), como na passagem de um só.
 */
export function landingSpots(city: MapData, partner: Pin, members: readonly Token[]): Point[] {
  const spots = gatherSpots(city, partner, members.map(tokenSizeInSquares))
  return members.map((t, i) => spots[i] ?? arrivalSpot(city, partner, tokenSizeInSquares(t)))
}
