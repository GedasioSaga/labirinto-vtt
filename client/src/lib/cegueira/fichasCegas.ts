import { temCegueira } from '../caracteristicas/tipos'
import type { Personagem } from '../personagem'
import type { MapData } from '../../types/map'

/**
 * CEGUEIRA (protótipo aprovado em 23/11/2026, docs/design/caracteristicas/):
 * quem é cego é a FICHA (o personagem), não o jogador. O host guarda os ids
 * dos personagens com Cegueira e, por mapa, acha as fichas ligadas a eles
 * (`Token.characterId`). A emprestada continua cega nas mãos de outro.
 */

/** Ids dos personagens com Cegueira. */
export function personagensCegos(personagens: readonly Personagem[]): ReadonlySet<string> {
  const cegos = new Set<string>()
  for (const personagem of personagens) if (temCegueira(personagem.caracteristicas)) cegos.add(personagem.id)
  return cegos
}

/** Ids das fichas deste mapa ligadas a um personagem cego. */
export function fichasCegasDoMapa(map: Pick<MapData, 'tokens'>, cegos: ReadonlySet<string>): ReadonlySet<string> {
  if (cegos.size === 0) return cegos
  const fichas = new Set<string>()
  for (const token of map.tokens) if (token.characterId !== null && cegos.has(token.characterId)) fichas.add(token.id)
  return fichas
}
