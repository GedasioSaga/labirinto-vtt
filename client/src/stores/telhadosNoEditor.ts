import { create } from 'zustand'

/**
 * TELHADOS NO EDITOR (decisão do usuário, 19/10/2026): dois botões junto da
 * grade, "Telhados" (liga/desliga) e "Transparente". Ao abrir o editor os dois
 * começam LIGADOS — telhado a 32%, como vidro fosco — e nada é guardado entre
 * aberturas: `PixiCanvas` chama `reiniciar` ao montar. Desligado, volta o
 * contorno da marca do teto (`drawRegions.ts`, `roofMarker`).
 */
export const ALFA_DO_TELHADO_TRANSPARENTE = 0.32

interface TelhadosNoEditor {
  ligados: boolean
  transparentes: boolean
  setLigados: (ligados: boolean) => void
  setTransparentes: (transparentes: boolean) => void
  reiniciar: () => void
}

export const useTelhadosNoEditor = create<TelhadosNoEditor>((set) => ({
  ligados: true,
  transparentes: true,
  setLigados: (ligados) => set({ ligados }),
  setTransparentes: (transparentes) => set({ transparentes }),
  reiniciar: () => set({ ligados: true, transparentes: true }),
}))
