import type { MapData, Token } from '../types/map'
import { gatherSpots } from './gatherParty'
import { filterMapForPlayer } from './fogFilter'
import { tokenSizeInSquares } from './tokenSize'
import { PIN_TRAVEL_MAX_TOKENS } from '../net/protocol'

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

/** De quem são as viajantes, e com que visão: o recorte deste jogador decide o que ele vê na chegada. */
export interface TravelViewer {
  playerId: string
  ownership: Record<string, string[]>
  visionRadius: number
}

/**
 * As fichas que podem passar pelo pino: a mais perto dele e as que estão a até
 * `TRAVEL_GROUP_CELLS` casas além dela, da mais perto para a mais longe (é a
 * ordem em que chegam do outro lado). `tokens` já tem de ser só as do jogador,
 * do recorte dele: ficha escondida pelo mestre não entra aqui.
 *
 * No máximo `PIN_TRAVEL_MAX_TOKENS`, as mais perto: o cartão marca todas de
 * início, e uma lista maior que o teto do pedido seria recusada inteira como
 * mensagem inválida — o jogador ficaria esperando um mestre que nunca responde.
 */
export function travelCandidates<T extends Point>(tokens: readonly T[], pin: Point, grid: number): T[] {
  const withDistance = tokens.map((token) => ({ token, distance: Math.hypot(token.x - pin.x, token.y - pin.y) }))
  withDistance.sort((a, b) => a.distance - b.distance)
  const nearest = withDistance[0]
  if (nearest === undefined) return []
  const limit = nearest.distance + TRAVEL_GROUP_CELLS * grid
  return withDistance
    .filter((entry) => entry.distance <= limit)
    .slice(0, PIN_TRAVEL_MAX_TOKENS)
    .map((entry) => entry.token)
}

/**
 * Onde as `companions` chegam, em volta de `at` (onde `lead`, a primeira
 * ficha, assentou). A procura é a do "Reunir o grupo aqui" (`gatherSpots`):
 * casa por casa em volta da chegada, na forma da grade (hexágono na hexagonal)
 * e com o assentamento de cada tamanho (ficha de 2 casas na quina), sem
 * atravessar parede fechada, dentro do mapa e do chão, sem cobrir a primeira
 * ficha nem outra que já está lá. Sem casa livre, a companheira divide a casa
 * da chegada — chegar empilhada é melhor que não chegar.
 *
 * Só ocupa casa a ficha que o jogador vai ver ao chegar: a que está no recorte
 * dele (`filterMapForPlayer`) na cena de destino, com a primeira ficha já na
 * chegada. O resto — oculta, secreta, na camada Fichas escondida, em zona
 * oculta ativa, sob teto fechado ou fora da visão — é casa livre. Se
 * empurrasse a companheira, a casa pulada (sem parede, sem ficha à vista)
 * contaria ao jogador que tem algo ali (a mesma regra do `travelLeftBehind` do
 * host). Um filtro próprio aqui cobria só metade das regras do recorte; o
 * recorte é a fonte única. A primeira ficha (`arrivalSpot`) não olha fichas.
 *
 * As viajantes que já estão no mapa de destino (pino par na mesma cena) saem
 * do lugar: a casa de onde saem não conta como ocupada.
 */
export function companionSpots(map: MapData, lead: Token, at: Point, companions: readonly Token[], viewer: TravelViewer): Point[] {
  if (companions.length === 0) return []
  const travelers = new Set([lead.id, ...companions.map((t) => t.id)])
  const landed: Token = { ...lead, x: at.x, y: at.y }
  // A cena como o jogador a encontra ao chegar: a primeira ficha na chegada
  // (é a visão dela que conta) e as companheiras ainda sem lugar.
  const onArrival: MapData = { ...map, tokens: [...map.tokens.filter((t) => !travelers.has(t.id)), landed] }
  const inView = new Set(filterMapForPlayer(onArrival, viewer.playerId, viewer.ownership, viewer.visionRadius).map.tokens.map((t) => t.id))
  const seen = map.tokens.filter((t) => inView.has(t.id) && !travelers.has(t.id))
  // A primeira ficha já assentada na chegada ocupa a casa (e, com 2 casas, as vizinhas que o disco cobre).
  const arrivalMap: MapData = { ...map, tokens: [...seen, landed] }
  const spots = gatherSpots(arrivalMap, at, companions.map(tokenSizeInSquares))
  return spots.map((spot) => spot ?? { x: at.x, y: at.y })
}
