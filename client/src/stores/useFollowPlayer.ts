import { useEffect, useRef } from 'react'
import { followDecision, shouldRecenter, type FollowTarget } from '../lib/follow'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import { useAdventureStore } from './adventureStore'
import { useFollowStore } from './followStore'

/**
 * Liga o SEGUIR ao editor: a cada render do App (movimento do jogador, viagem,
 * "Mandar para…", reunir — tudo muda o mundo e rende o App), recalcula onde a
 * ficha seguida está e, se mudou, centra nela pelo `goToPoint` — que troca de
 * cena quando a ficha foi para outra e só move a câmera quando é a mesma. O
 * pedido é instantâneo (sem animação), para não brigar com o arrasto do
 * jogador. Olhar o MUNDO, e não cada mensagem da ponte, cobre qualquer caminho
 * que mexa na ficha sem tocar em cada um deles.
 */
export function useFollowPlayer(players: PlayerInfo[], world: () => HostWorld): void {
  const playerId = useFollowStore((state) => state.playerId)
  // `world` é função: montar o mundo custa, e sem ninguém seguido não precisa.
  const decision = playerId === null ? null : followDecision(playerId, players, world())
  /** O último centro que o seguir fez, para não pedir câmera sem a ficha ter andado. */
  const lastRef = useRef<{ playerId: string; target: FollowTarget } | null>(null)

  // As dependências são os números, não o objeto: o mundo é remontado a todo render.
  const kind = decision?.kind ?? null
  const target = decision?.kind === 'target' ? decision.target : null
  const sceneId = target?.sceneId ?? null
  const x = target?.x ?? null
  const y = target?.y ?? null

  useEffect(() => {
    if (playerId === null) {
      lastRef.current = null
      return
    }
    if (kind === 'stop') {
      useFollowStore.getState().stop()
      return
    }
    if (x === null || y === null) return
    const next: FollowTarget = { sceneId, x, y }
    const previous = lastRef.current?.playerId === playerId ? lastRef.current.target : null
    if (!shouldRecenter(previous, next)) return
    lastRef.current = { playerId, target: next }
    // O foco vai ao centro da área que os painéis não cobrem (G6, `freeAreaCenter`): a ficha seguida nunca some sob o painel.
    useAdventureStore.getState().goToPoint(sceneId, { x, y })
  }, [playerId, kind, sceneId, x, y])
}
