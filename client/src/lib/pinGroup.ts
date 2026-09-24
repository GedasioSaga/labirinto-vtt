import type { MapData } from '../types/map'
import { moveCrossesWall } from './collision'

/**
 * ESCOLHER FICHAS NO PINO — compartilhado pelo host (validar a lista que o
 * jogador manda, `net/hostSession.ts`) e pela tela do jogador (quais caixas o
 * cartão do pino oferece, `player/main.tsx`). Mesma conta nos dois lados: o
 * que o cartão oferece é o que o host aceita.
 */

/**
 * Quantas casas além da ficha mais perto do pino uma outra ficha do mesmo
 * jogador ainda conta como "junto do pino". Relativo à mais perto, e não ao
 * pino, porque o pino não exige estar colado nele: quem pede de 3 casas com o
 * companheiro a 2,5 escolhe entre os dois.
 */
export const TRAVEL_GROUP_CELLS = 2

interface Point {
  x: number
  y: number
}

/**
 * As fichas que podem passar pelo pino: a mais perto dele e as que estão a até
 * `TRAVEL_GROUP_CELLS` casas além dela, da mais perto para a mais longe (é a
 * ordem em que chegam do outro lado). `tokens` já tem de ser só as do jogador,
 * do recorte dele: ficha escondida pelo mestre não entra aqui.
 */
export function travelCandidates<T extends Point>(tokens: readonly T[], pin: Point, grid: number): T[] {
  const withDistance = tokens.map((token) => ({ token, distance: Math.hypot(token.x - pin.x, token.y - pin.y) }))
  withDistance.sort((a, b) => a.distance - b.distance)
  const nearest = withDistance[0]
  if (nearest === undefined) return []
  const limit = nearest.distance + TRAVEL_GROUP_CELLS * grid
  return withDistance.filter((entry) => entry.distance <= limit).map((entry) => entry.token)
}

/** Anéis de casas vizinhas percorridos em volta da chegada; passou disso, a companheira divide a casa. */
const COMPANION_MAX_RINGS = 3

/** As casas do anel `ring` (distância de Chebyshev) em volta da origem: lados antes das diagonais. */
function ringOffsets(ring: number): Point[] {
  const offsets: Point[] = []
  for (let dx = -ring; dx <= ring; dx += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) offsets.push({ x: dx, y: dy })
    }
  }
  // Mais perto em linha reta primeiro: leste/oeste/sul/norte antes das quinas.
  return offsets.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
}

/**
 * Onde as `count` companheiras chegam, em volta de `lead` (onde a primeira
 * ficha chegou): uma casa vizinha livre para cada, sem atravessar parede
 * fechada a partir da chegada, dentro do mapa e fora de cima de ficha que já
 * está lá. Sem casa livre nos anéis de busca, a companheira divide a casa da
 * chegada — chegar empilhada é melhor que não chegar.
 */
export function companionSpots(map: MapData, lead: Point, count: number): Point[] {
  const width = map.width * map.grid
  const height = map.height * map.grid
  const taken: Point[] = [lead, ...map.tokens.map((t) => ({ x: t.x, y: t.y }))]
  const isTaken = (p: Point) => taken.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < map.grid / 2)
  const spots: Point[] = []
  for (let ring = 1; ring <= COMPANION_MAX_RINGS && spots.length < count; ring += 1) {
    for (const offset of ringOffsets(ring)) {
      if (spots.length >= count) break
      const spot = { x: lead.x + offset.x * map.grid, y: lead.y + offset.y * map.grid }
      if (spot.x < 0 || spot.y < 0 || spot.x > width || spot.y > height) continue
      if (isTaken(spot)) continue
      if (map.walls.some((wall) => moveCrossesWall(lead, spot, wall))) continue
      spots.push(spot)
      taken.push(spot)
    }
  }
  while (spots.length < count) spots.push({ x: lead.x, y: lead.y })
  return spots
}
