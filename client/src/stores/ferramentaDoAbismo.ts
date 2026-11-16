import { create } from 'zustand'
import type { BrilhoDoAbismo } from '../types/map'

/**
 * ABISMO: o brilho do PRÓXIMO abismo da ferramenta e o abismo escolhido no
 * mapa (clique num abismo com a ferramenta). Preferência da ferramenta, fora
 * do mapa e do desfazer, no molde da `ferramentaDaAgua`.
 */

/** O brilho do painel: um dos do fundo ou nenhum. */
export type BrilhoEscolhido = BrilhoDoAbismo | 'nenhum'

interface FerramentaDoAbismo {
  brilho: BrilhoEscolhido
  /** O abismo escolhido (clique num abismo com a ferramenta), ou `null`. */
  escolhido: string | null
  setBrilho: (brilho: BrilhoEscolhido) => void
  escolher: (id: string | null) => void
}

export const useFerramentaDoAbismo = create<FerramentaDoAbismo>((set) => ({
  brilho: 'nenhum',
  escolhido: null,
  setBrilho: (brilho) => set({ brilho }),
  escolher: (escolhido) => set({ escolhido }),
}))
