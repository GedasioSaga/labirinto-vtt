import { create } from 'zustand'
import type { PlayerInfo } from '../net/hostSession'

/**
 * MAPA DE CONTINENTE no canvas do mestre: de quem é cada ficha (id do jogador
 * → fichas), para o renderer desenhar a ficha de jogador como pino, na cor do
 * dono (`lib/marcadorDeContinente.ts`). Estado da sessão, não do mapa: não vai
 * ao disco nem ao desfazer. Mesmo molde do `awayTokensStore`: quem escreve é o
 * App, a cada lista de jogadores que a ponte manda; quem lê é o `PixiCanvas`.
 */

const NINGUEM: Readonly<Record<string, readonly string[]>> = {}

interface DonosDasFichasState {
  posse: Readonly<Record<string, readonly string[]>>
  /** Lista nova da ponte. Só troca a referência quando a posse muda: o canvas repinta as fichas a cada troca. */
  setFromPlayers: (players: readonly PlayerInfo[]) => void
  /** Sala fechada: nenhuma ficha tem dono. */
  clear: () => void
}

function mesmaPosse(a: Readonly<Record<string, readonly string[]>>, b: Readonly<Record<string, readonly string[]>>): boolean {
  const chavesA = Object.keys(a)
  if (chavesA.length !== Object.keys(b).length) return false
  return chavesA.every((id) => {
    const x = a[id]
    const y = b[id]
    return y !== undefined && x.length === y.length && x.every((tokenId, i) => tokenId === y[i])
  })
}

export const useDonosDasFichasStore = create<DonosDasFichasState>()((set, get) => ({
  posse: NINGUEM,

  setFromPlayers: (players) => {
    const posse: Record<string, readonly string[]> = {}
    for (const player of players) if (player.tokenIds.length > 0) posse[player.playerId] = [...player.tokenIds]
    if (mesmaPosse(get().posse, posse)) return
    set({ posse: Object.keys(posse).length === 0 ? NINGUEM : posse })
  },

  clear: () => {
    if (Object.keys(get().posse).length > 0) set({ posse: NINGUEM })
  },
}))
