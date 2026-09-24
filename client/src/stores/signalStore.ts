import { create } from 'zustand'
import { MAX_ACTIVE_SIGNALS, SIGNAL_TTL_MS, signalLabelForMaster, type SignalMark } from '../lib/signals'
import type { HostSignal } from '../net/hostSession'

/**
 * Sinais dos jogadores que o mestre está vendo agora. Cada um some sozinho
 * depois de `SIGNAL_TTL_MS`; o canvas lê `signals` a cada quadro pelo ticker.
 */

export interface ActiveSignal extends SignalMark {
  playerId: string
}

interface SignalState {
  signals: ActiveSignal[]
  /** Empilha o sinal e agenda a remoção. Devolve o `id` gerado. */
  push: (signal: HostSignal, now?: number) => string
  dismiss: (id: string) => void
  /** Sala fechada: some tudo e nenhum timer fica pendurado. */
  clear: () => void
}

/** Timers fora do state: não são dado de UI, só precisam poder ser cancelados (mesmo padrão de toastStore). */
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let nextId = 1

export const useSignalStore = create<SignalState>()((set, get) => ({
  signals: [],

  push: (signal, now = Date.now()) => {
    const id = `sinal-${nextId++}`
    const name = signalLabelForMaster(signal.name, signal.tokenName)
    const active: ActiveSignal = { id, playerId: signal.playerId, name, color: signal.color, x: signal.x, y: signal.y, createdAt: now }
    const kept = get().signals
    // Acima do teto sai o mais antigo, junto com o timer dele.
    const overflow = kept.length + 1 - MAX_ACTIVE_SIGNALS
    for (const old of overflow > 0 ? kept.slice(0, overflow) : []) {
      clearTimeout(timers.get(old.id))
      timers.delete(old.id)
    }
    set({ signals: [...(overflow > 0 ? kept.slice(overflow) : kept), active] })
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), SIGNAL_TTL_MS),
    )
    return id
  },

  dismiss: (id) => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    set((state) => ({ signals: state.signals.filter((s) => s.id !== id) }))
  },

  clear: () => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    set({ signals: [] })
  },
}))
