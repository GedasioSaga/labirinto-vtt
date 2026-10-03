import { create } from 'zustand'

/**
 * CONTA-GOTAS DO MAPA (`lib/contaGotas.ts`). A pipeta de um campo de cor arma o
 * modo com o próprio id e o que fazer com a cor; o próximo clique esquerdo no
 * mapa lê o pixel e entrega (`pixi/contaGotasGesture.ts`). Um campo por vez:
 * armar outro troca o dono.
 */
interface ContaGotasState {
  /** O campo que pediu a cor; `null` com o modo desligado. */
  donoId: string | null
  aoPegar: ((cor: string) => void) | null
  ligar: (donoId: string, aoPegar: (cor: string) => void) => void
  desligar: () => void
  /** Desliga e entrega a cor ao dono. Sem dono, não faz nada. */
  entregar: (cor: string) => void
}

export const useContaGotasStore = create<ContaGotasState>()((set, get) => ({
  donoId: null,
  aoPegar: null,

  ligar: (donoId, aoPegar) => {
    set({ donoId, aoPegar })
  },

  desligar: () => {
    if (get().donoId !== null) set({ donoId: null, aoPegar: null })
  },

  entregar: (cor) => {
    const { aoPegar } = get()
    // Desliga ANTES de entregar: quem recebe pode re-renderizar e armar de novo.
    set({ donoId: null, aoPegar: null })
    aoPegar?.(cor)
  },
}))
