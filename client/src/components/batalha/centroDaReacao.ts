import { create } from 'zustand'

/**
 * A REAÇÃO DO MESTRE NO CENTRO (pedido de 10/11/2026: "reação tem que ficar
 * na parte do campo e não na lateral"): a carta REAÇÃO do NPC abre sobre o
 * mapa (`ReacaoNoCentro`, montada pelo App junto do menu da vez) e a aba
 * Batalha fica só com a lista curta de quem espera (`ReacoesPendentes`).
 * Esta store liga as duas: a linha clicada na aba traz aquela reação ao
 * centro, e o centro conta qual está à vista para a linha se marcar.
 *
 * Com a carta na frente, o menu da vez e a mira do NPC ficam atrás
 * (`VezDoNpcNoCentro` lê `naFrente`): a reação trava a rodada e vem primeiro;
 * resolvida ou recolhida, o menu volta.
 */

interface ReacaoNoCentroDoMestre {
  /** A reação que o mestre trouxe ao centro (`chaveDaReacao`); `null` = a da vez na fila. */
  escolhida: string | null
  /** O mestre recolheu a carta (Esc ou Recolher): fica só o botão REAÇÃO. */
  recolhida: boolean
  /** A carta está à vista no centro (escrito pelo `ReacaoNoCentro`). */
  naFrente: boolean
  /** A reação à vista no centro, aberta ou recolhida (escrito pelo `ReacaoNoCentro`); `null` = nenhuma. */
  noCentro: string | null
  /** A linha da aba: aquela reação vem ao centro, aberta. */
  trazer: (chave: string) => void
  recolher: () => void
  abrir: () => void
  mostrar: (noCentro: string | null, naFrente: boolean) => void
}

export const useReacaoNoCentro = create<ReacaoNoCentroDoMestre>()((set) => ({
  escolhida: null,
  recolhida: false,
  naFrente: false,
  noCentro: null,
  trazer: (chave) => set({ escolhida: chave, recolhida: false }),
  recolher: () => set({ recolhida: true }),
  abrir: () => set({ recolhida: false }),
  mostrar: (noCentro, naFrente) => set({ noCentro, naFrente }),
}))
