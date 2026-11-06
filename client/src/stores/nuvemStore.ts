import { create } from 'zustand'
import type { SituacaoDoSincronizador } from '../net/nuvem/sincronizador'

/**
 * O LOBBY NO APP (docs/planos/lobby-jogadores-2026-11-05.md §3.3, fatia A5):
 * a situação de cada campanha publicada, para as telas da A6 (o indicador
 * "Lobby: tudo salvo / 3 esperando rede", "Mudanças para decidir"). Só
 * espelha: quem escreve é o sincronizador (`net/nuvem/nuvemNoApp.ts`); as
 * decisões voltam por `decidirNoLobby`.
 */

export interface CampanhaNoApp extends SituacaoDoSincronizador {
  campanhaId: string
  pastaId: string
  nome: string
}

interface NuvemState {
  /** Por `campanhaId`. */
  campanhas: Record<string, CampanhaNoApp>
  /** O Lobby que nem ligou (disco, base danificada): a razão, para a tela. */
  falhaAoLigar: string | null
  atualizar: (campanha: CampanhaNoApp) => void
  remover: (campanhaId: string) => void
  definirFalhaAoLigar: (falha: string | null) => void
}

export const useNuvemStore = create<NuvemState>((set) => ({
  campanhas: {},
  falhaAoLigar: null,
  atualizar: (campanha) => set((estado) => ({ campanhas: { ...estado.campanhas, [campanha.campanhaId]: campanha } })),
  remover: (campanhaId) =>
    set((estado) => {
      const { [campanhaId]: _saiu, ...resto } = estado.campanhas
      return { campanhas: resto }
    }),
  definirFalhaAoLigar: (falhaAoLigar) => set({ falhaAoLigar }),
}))

/** Quantas mudanças esperam o servidor em todas as campanhas (o "N esperando rede"). */
export function totalEsperando(campanhas: Record<string, CampanhaNoApp>): number {
  return Object.values(campanhas).reduce((soma, campanha) => soma + campanha.esperando, 0)
}
