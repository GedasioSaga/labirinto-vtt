import { create } from 'zustand'
import { DICE_FEED_MAX, type HostDiceRoll } from '../lib/dice'

/**
 * DADO ROLADO NA SALA na tela do mestre: as rolagens da mesa (as dos jogadores
 * e as dele, a escondida marcada), da mais antiga à mais nova. Quem enche é a
 * ponte (`onDiceRoll`); fechar a sala limpa.
 */
interface DiceState {
  rolls: HostDiceRoll[]
  push: (roll: HostDiceRoll) => void
  clear: () => void
}

export const useDiceStore = create<DiceState>()((set) => ({
  rolls: [],
  push: (roll) => set((state) => ({ rolls: [...state.rolls, roll].slice(-DICE_FEED_MAX) })),
  clear: () => set({ rolls: [] }),
}))
