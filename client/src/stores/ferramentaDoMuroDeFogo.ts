import { create } from 'zustand'

/**
 * MURO DE FOGO (15/11/2026): como o PRÓXIMO muro é traçado com a ferramenta
 * Objeto. Preferência da ferramenta, fora do mapa e do desfazer, no molde da
 * `ferramentaDaAgua`.
 */

/** À mão (arrasto, vira curva suave) ou ponto a ponto (cliques, trechos retos). */
export type FormaDoMuroDeFogo = 'mao' | 'pontos'

interface FerramentaDoMuroDeFogo {
  forma: FormaDoMuroDeFogo
  setForma: (forma: FormaDoMuroDeFogo) => void
}

export const useFerramentaDoMuroDeFogo = create<FerramentaDoMuroDeFogo>((set) => ({
  forma: 'mao',
  setForma: (forma) => set({ forma }),
}))
