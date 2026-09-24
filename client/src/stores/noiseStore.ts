import { create } from 'zustand'
import { NOISE_RANGE_DEFAULT_CELLS, clampNoiseRangeCells } from '../lib/noise'

/**
 * RUÍDO NO MAPA, lado do mestre. O botão "Ruído" da aba Jogo arma; o próximo
 * clique esquerdo no canvas dispara o ruído no ponto e desarma (um toque, um
 * ruído — `pixi/noiseGesture.ts`). `rangeCells` é até onde ele se ouve.
 */
interface NoiseState {
  armed: boolean
  rangeCells: number
  setArmed: (armed: boolean) => void
  setRangeCells: (cells: number) => void
}

export const useNoiseStore = create<NoiseState>()((set, get) => ({
  armed: false,
  rangeCells: NOISE_RANGE_DEFAULT_CELLS,

  setArmed: (armed) => {
    if (get().armed !== armed) set({ armed })
  },

  setRangeCells: (cells) => {
    set({ rangeCells: clampNoiseRangeCells(cells) })
  },
}))
