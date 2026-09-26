import type { MapData, RegionPoint, Token } from '../types/map'
import { filterMapForGroup } from './fogFilter'
import { findOccupant } from './movementRules'

/**
 * MOVIMENTO IMPOSTO com "Fichas ocupam espaço": quem segura a ficha que a
 * esteira empurra ou a cabine leva. Só segura a ficha que o dono da ficha que
 * anda ENXERGA de onde ela está — a mesma regra que o host aplica ao movimento
 * manual (`occupantsSeenBy`, `net/hostSession.ts`). Ficha oculta pelo mestre,
 * secreta, na camada Fichas escondida, em zona oculta, sob teto fechado, na
 * névoa (atrás da parede) ou além do raio de visão do dono não segura: a ficha
 * do jogador parar antes dela, no chão vazio, contaria que existe alguém ali.
 *
 * "Enxerga" é o recorte de `filterMapForGroup` com a própria ficha como único
 * olho e o raio que o host APLICA a ela no mapa (`OwnerVisionRadii`, de
 * `HostSession.tokenVisionRadii`: "Visão nesta cena", fator do jogador e hora
 * do relógio já entram ali — `filterMapForGroup` não os aplica sozinho); a
 * fumaça continua cortando (`visionRadiusAt`). Ficha sem dono na sala
 * (NPC, ou mapa sem sala aberta) enxerga o mapa inteiro. As outras fichas do
 * mesmo dono não entram: veem a mais, nunca a menos, então ficar só com esta
 * ficha nunca faz segurar quem ele não vê.
 */

/** Raio de visão efetivo de cada ficha com dono, por id de ficha, em px (`HostSession.tokenVisionRadii`). Ficha sem dono fica de fora. */
export type OwnerVisionRadii = ReadonlyMap<string, number>

/** Sem sala aberta: ninguém tem dono, todo mundo enxerga o mapa inteiro. */
export const NO_OWNER_RADII: OwnerVisionRadii = new Map()

/** Raio que alcança qualquer ponto do mapa: a diagonal inteira, em px. */
function wholeMapRadius(map: MapData): number {
  return Math.hypot(map.width * map.grid, map.height * map.grid)
}

/** `viewer`, parado onde está e com o raio `radius`, enxerga `other`? */
function sees(map: MapData, viewer: Token, other: Token, radius: number): boolean {
  const probe: MapData = { ...map, tokens: [viewer, other] }
  const view = filterMapForGroup(probe, [{ tokenIds: [viewer.id], visionRadius: radius }])
  return view.map.tokens.some((t) => t.id === other.id)
}

/**
 * A primeira ficha de `others` que ocuparia a casa `at` para `mover` E que o
 * dono de `mover` enxerga de onde `mover` está, com o raio dele em `radii`.
 * `undefined` = a casa está livre para ele. A conta de visão só roda quando há
 * sobreposição (o caso raro).
 */
export function seenOccupant(
  map: MapData,
  mover: Token,
  at: RegionPoint,
  others: readonly Token[],
  radii: OwnerVisionRadii,
): Token | undefined {
  const radius = radii.get(mover.id) ?? wholeMapRadius(map)
  return others.find(
    (other) => other.id !== mover.id && findOccupant([mover, other], mover.id, at, map.grid) !== undefined && sees(map, mover, other, radius),
  )
}
