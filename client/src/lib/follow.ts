import type { HostScene, HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'
import { pisoDe } from './pisos'

/**
 * SEGUIR JOGADOR (G7): a câmera do editor acompanha a ficha de UM jogador.
 * Lógica pura — lê o que a ponte sabe (`PlayerInfo`) e o mundo que o host
 * serve (`HostWorld`), igual a `party.ts`; o App só aplica a decisão.
 */

/** Onde a ficha seguida está agora: a cena (`null` = mapa solto) e o ponto do mundo. */
export interface FollowTarget {
  sceneId: string | null
  x: number
  y: number
  /** PISOS NA MESMA CENA: o piso da ficha. Ausente = o térreo (como no arquivo). */
  piso?: number
}

/**
 * - `stop`: não há mais o que seguir (saiu, caiu, ficou sem ficha) — desliga.
 * - `wait`: a ficha sumiu só por um instante (a viagem tira da cena de origem
 *   antes de a ponte avisar a de destino) — não mexe em nada.
 * - `target`: a ficha está aqui.
 */
export type FollowDecision = { kind: 'stop' } | { kind: 'wait' } | { kind: 'target'; target: FollowTarget }

function allScenes(world: HostWorld): HostScene[] {
  return [world.open, ...world.background]
}

function tokenIn(scene: HostScene, tokenIds: string[]): Token | null {
  for (const id of tokenIds) {
    const token = scene.map.tokens.find((t) => t.id === id)
    if (token !== undefined) return token
  }
  return null
}

/**
 * O que fazer com o seguir de `playerId`. A ficha é procurada primeiro na cena
 * em que a sessão vê o jogador e, não achando, em todas: durante a viagem a
 * `sceneId` da ponte ainda aponta a cena velha por um instante, e a ficha já
 * está na nova. "Sem ficha" é o mestre ter tirado a ficha (`tokenIds` vazio),
 * não a ficha em trânsito.
 */
export function followDecision(playerId: string, players: PlayerInfo[], world: HostWorld): FollowDecision {
  const player = players.find((p) => p.playerId === playerId)
  if (player === undefined || !player.connected || player.status !== 'playing' || player.tokenIds.length === 0) return { kind: 'stop' }
  const scenes = allScenes(world)
  const own = player.sceneId === undefined ? undefined : scenes.find((s) => s.sceneId === player.sceneId)
  const ordered = own === undefined ? scenes : [own, ...scenes.filter((s) => s !== own)]
  for (const scene of ordered) {
    const token = tokenIn(scene, player.tokenIds)
    if (token === null) continue
    const piso = pisoDe(token)
    return { kind: 'target', target: { sceneId: scene.sceneId, x: token.x, y: token.y, ...(piso === 0 ? {} : { piso }) } }
  }
  return { kind: 'wait' }
}

/**
 * Centrar de novo? Só quando a ficha MUDOU de lugar ou de cena desde o último
 * centro que o seguir fez (`null` = acabou de ligar: centra já). Re-render sem
 * movimento não pode puxar a câmera — senão o seguir brigaria com qualquer
 * coisa que redesenha o App.
 */
export function shouldRecenter(previous: FollowTarget | null, next: FollowTarget): boolean {
  if (previous === null) return true
  // PISOS: subir a escada não muda o ponto, mas muda o piso que o editor tem de mostrar.
  return previous.sceneId !== next.sceneId || previous.x !== next.x || previous.y !== next.y || (previous.piso ?? 0) !== (next.piso ?? 0)
}
