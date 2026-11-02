import { create } from 'zustand'

/**
 * A MIRA DO MESTRE na batalha DBT (docs/planos/dbt-batalha.md, seção 18,
 * `App.tsx:3282`): o painel liga "Escolher no mapa"; com ela ligada, o App
 * passa `escolherFichaDoMestreDBT` como `aoEscolherFicha` do mapa e a ficha
 * clicada volta ao painel. Separada da mira do One Piece: uma batalha não
 * acende a mira da outra.
 */

interface MiraDBT {
  mirando: boolean
  /** A ficha clicada; `seq` sobe a cada clique (o mesmo token duas vezes desmarca). */
  alvo: { tokenId: string; seq: number } | null
  mirar: (mirando: boolean) => void
  escolher: (tokenId: string) => void
}

export const useMiraDBT = create<MiraDBT>()((set) => ({
  mirando: false,
  alvo: null,
  mirar: (mirando) => set({ mirando }),
  escolher: (tokenId) => set((state) => ({ alvo: { tokenId, seq: (state.alvo?.seq ?? 0) + 1 } })),
}))

/** O `aoEscolherFicha` do mapa do mestre (estável). */
export function escolherFichaDoMestreDBT(tokenId: string): void {
  useMiraDBT.getState().escolher(tokenId)
}
