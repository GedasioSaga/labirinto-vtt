import { create } from 'zustand'
import { advanceHour, CLOCK_DEFAULT_HOUR, nextPeriodHour } from '../lib/campaignClock'

/**
 * RELÓGIO DA CAMPANHA do mestre: a hora do dia (0 a 23). Um só para a aventura
 * inteira; é estado da sessão de jogo, como a iniciativa — não vai ao arquivo
 * do mapa. O que o JOGADOR recebe disto é só o período e, da cena dele, se
 * está escuro (`lib/fogFilter.ts` → `clockForPlayer`).
 */
interface ClockState {
  hour: number
  /** "+1 hora". */
  advanceHour: () => void
  /** "Próximo período": o começo do seguinte (da noite, a manhã de amanhã). */
  nextPeriod: () => void
}

export const useClockStore = create<ClockState>()((set, get) => ({
  hour: CLOCK_DEFAULT_HOUR,
  advanceHour: () => set({ hour: advanceHour(get().hour, 1) }),
  nextPeriod: () => set({ hour: nextPeriodHour(get().hour) }),
}))
