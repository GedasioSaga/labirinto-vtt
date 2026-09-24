import { create } from 'zustand'
import { applyRemoteLaser, pruneRemoteLasers, type RemoteLaser, type RemoteLaserUpdate } from '../lib/laser'
import type { HostPlayerLaser } from '../net/hostSession'

const LASER_OFF: RemoteLaserUpdate = { off: true }

/**
 * LASER DOS JOGADORES na tela do mestre: um rastro por jogador, na cor da
 * ficha dele, desenhado pelo ticker do canvas (`PixiCanvas`). Estado da
 * sessão, não do mapa: não vai ao disco nem ao desfazer.
 */

interface PlayerLaserState {
  lasers: RemoteLaser[]
  /** Lote ou fim do gesto vindo da ponte. Lote de outra cena termina o rastro: os pontos são de outro mapa. */
  receive: (laser: HostPlayerLaser, now?: number) => void
  /** Tira o que já sumiu; o ticker chama quando nada mais aparece. */
  prune: (now?: number) => void
  clear: () => void
}

export const usePlayerLaserStore = create<PlayerLaserState>()((set, get) => ({
  lasers: [],

  receive: (laser, now = Date.now()) => {
    const origin = { key: laser.playerId, label: laser.name, color: laser.color }
    const update = laser.onOpenScene ? laser.update : LASER_OFF
    set({ lasers: applyRemoteLaser(pruneRemoteLasers(get().lasers, now), origin, update, now) })
  },

  prune: (now = Date.now()) => {
    const current = get().lasers
    if (current.length === 0) return
    const next = pruneRemoteLasers(current, now)
    // Nada saiu: não troca a referência, o ticker não re-renderiza ninguém.
    if (next.length !== current.length) set({ lasers: next })
  },

  clear: () => set({ lasers: [] }),
}))
