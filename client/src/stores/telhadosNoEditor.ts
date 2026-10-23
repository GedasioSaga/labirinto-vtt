import { create } from 'zustand'

/**
 * TELHADOS NO EDITOR (decisão do usuário, 19/10/2026; fatia 6 das camadas).
 * Mostrar ou esconder os telhados para o mestre é o olho "Mestre vê" da camada
 * Telhados (`MapData.hiddenLayers`, salvo na cena). Aqui fica só o atalho
 * "Transparente": telhado a 32%, como vidro fosco, para o mestre ver o que tem
 * dentro. Começa LIGADO e nada é guardado entre aberturas: `PixiCanvas` chama
 * `reiniciar` ao montar. Nunca vai ao jogador.
 */
export const ALFA_DO_TELHADO_TRANSPARENTE = 0.32

interface TelhadosNoEditor {
  transparentes: boolean
  setTransparentes: (transparentes: boolean) => void
  reiniciar: () => void
}

export const useTelhadosNoEditor = create<TelhadosNoEditor>((set) => ({
  transparentes: true,
  setTransparentes: (transparentes) => set({ transparentes }),
  reiniciar: () => set({ transparentes: true }),
}))
