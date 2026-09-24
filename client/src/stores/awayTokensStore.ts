import { create } from 'zustand'
import { awayTokenIds } from '../lib/party'
import type { PlayerInfo } from '../net/hostSession'

/**
 * VOLTO JÁ no canvas do mestre: as fichas de quem saiu da mesa, que o
 * renderer desenha com o selo de ausente. Estado da sessão, não do mapa: não
 * vai ao disco nem ao desfazer. Quem escreve é o App, a cada lista de
 * jogadores que a ponte manda; quem lê é o `PixiCanvas`.
 */

const NONE: ReadonlySet<string> = new Set()

interface AwayTokensState {
  tokenIds: ReadonlySet<string>
  /** Lista nova da ponte. Só troca a referência quando o conjunto muda: o canvas repinta as fichas a cada troca. */
  setFromPlayers: (players: readonly PlayerInfo[]) => void
  /** Sala fechada: nenhuma ficha fica com selo. */
  clear: () => void
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

export const useAwayTokensStore = create<AwayTokensState>()((set, get) => ({
  tokenIds: NONE,

  setFromPlayers: (players) => {
    const next = awayTokenIds(players)
    if (sameIds(get().tokenIds, next)) return
    set({ tokenIds: next.size === 0 ? NONE : next })
  },

  clear: () => {
    if (get().tokenIds.size > 0) set({ tokenIds: NONE })
  },
}))
