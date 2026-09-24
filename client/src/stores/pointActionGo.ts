import type { PointActionRequest } from '../net/hostSession'
import { useAdventureStore } from './adventureStore'
import { useSignalStore } from './signalStore'

/**
 * "Ir lá" da AÇÃO NO PONTO no editor: vai à cena do pedido centrado no ponto e
 * o marca com o anel do jogador (o mesmo do sinal, que some sozinho). Se a
 * cena não abre, nada é marcado: o anel cairia no mapa errado.
 */
export function goToPointAction(request: PointActionRequest): void {
  const point = { x: request.x, y: request.y }
  if (!useAdventureStore.getState().goToPoint(request.sceneId, point)) return
  useSignalStore.getState().push({ playerId: request.playerId, name: request.playerName, color: request.color, ...point })
}
