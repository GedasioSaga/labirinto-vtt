import { create } from 'zustand'

/**
 * LIVRO DA MESA (fatia 4 do design consolidado, docs/design/consolidado/PLANO.md):
 * qual página da direita está aberta (Grupo, Chat, Cenas, Mesa e, desde os sons
 * ao vivo, Sons; desde a F2 da batalha, Batalha). Vale enquanto
 * o app está aberto, como a aba de antes. Se o livro está recolhido mora com o
 * App (`useLivroDaMesaAberto`), lembrado entre as sessões como a coluna da
 * direita que ele substitui.
 */

export type PaginaDaMesa = 'grupo' | 'chat' | 'cenas' | 'batalha' | 'mesa' | 'sons'

interface LivroDaMesaState {
  pagina: PaginaDaMesa
  /** A última troca veio do ponteiro num marcador: só ela anima (a fita desliza, a folha assenta). */
  trocaAnimada: boolean
  abrirPagina: (pagina: PaginaDaMesa, animada?: boolean) => void
}

export const useLivroDaMesaStore = create<LivroDaMesaState>((set) => ({
  pagina: 'grupo',
  trocaAnimada: false,
  abrirPagina: (pagina, animada = false) => set({ pagina, trocaAnimada: animada }),
}))
