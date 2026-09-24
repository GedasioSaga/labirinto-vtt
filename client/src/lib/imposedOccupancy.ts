import type { MapData, RegionPoint, Token } from '../types/map'
import { filterMapForGroup } from './fogFilter'
import { findOccupant } from './movementRules'

/**
 * MOVIMENTO IMPOSTO com "Fichas ocupam espaço": quem segura a ficha que a
 * esteira empurra ou a cabine leva. Só segura a ficha que o dono da ficha que
 * anda ENXERGA de onde ela está — a mesma regra que o host aplica ao movimento
 * manual (`occupantsSeenBy`, `net/hostSession.ts`). Ficha oculta pelo mestre,
 * secreta, na camada Fichas escondida, em zona oculta, sob teto fechado ou na
 * névoa (atrás da parede) não segura: a ficha do jogador parar antes dela, no
 * chão vazio, contaria que existe alguém ali.
 *
 * "Enxerga" é o recorte de `filterMapForGroup` com a própria ficha como único
 * olho. O mapa do editor não sabe o raio de visão de cada jogador (é da sala,
 * no host), então o raio aqui cobre o mapa inteiro; a fumaça continua cortando
 * (`visionRadiusAt`). As outras fichas do mesmo dono não entram: veem a mais,
 * nunca a menos, então ficar só com esta ficha nunca faz segurar quem ele não vê.
 */

/** Raio que alcança qualquer ponto do mapa: a diagonal inteira, em px. */
function wholeMapRadius(map: MapData): number {
  return Math.hypot(map.width * map.grid, map.height * map.grid)
}

/** `viewer`, parado onde está, enxerga `other`? */
function sees(map: MapData, viewer: Token, other: Token): boolean {
  const probe: MapData = { ...map, tokens: [viewer, other] }
  const view = filterMapForGroup(probe, [{ tokenIds: [viewer.id], visionRadius: wholeMapRadius(map) }])
  return view.map.tokens.some((t) => t.id === other.id)
}

/**
 * A primeira ficha de `others` que ocuparia a casa `at` para `mover` E que o
 * dono de `mover` enxerga de onde `mover` está. `undefined` = a casa está livre
 * para ele. A conta de visão só roda quando há sobreposição (o caso raro).
 */
export function seenOccupant(map: MapData, mover: Token, at: RegionPoint, others: readonly Token[]): Token | undefined {
  return others.find(
    (other) => other.id !== mover.id && findOccupant([mover, other], mover.id, at, map.grid) !== undefined && sees(map, mover, other),
  )
}
