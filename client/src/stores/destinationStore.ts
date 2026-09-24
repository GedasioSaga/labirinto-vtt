import { create } from 'zustand'
import type { DestinationMark } from '../lib/signals'

/**
 * Marcas "vamos para cá" que o canvas do mestre desenha agora: só as da cena
 * aberta (`masterDestinationMarks`). Sem prazo — a lista inteira é trocada
 * quando a lista de jogadores da ponte muda. O canvas lê pelo ticker.
 */
interface DestinationState {
  marks: DestinationMark[]
  setMarks: (marks: DestinationMark[]) => void
}

export const useDestinationStore = create<DestinationState>()((set) => ({
  marks: [],
  setMarks: (marks) => set({ marks }),
}))
