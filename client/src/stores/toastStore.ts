import { create } from 'zustand'

/**
 * FRENTE A (onda 2, plano de refinamento — item 12: NOTIFICAÇÃO).
 *
 * Fila mínima de avisos, pura o bastante para ser testada sem montar nenhum
 * componente React — todo teste chama `useToastStore.getState()` direto,
 * mesmo padrão de `useMapStore.getState()` já usado fora de componente em
 * `pixi/PixiCanvas.tsx`. `Toast.tsx` só lê `toasts` com o hook e chama
 * `dismiss`; toda a lógica de fila/tempo mora aqui.
 */

export type ToastKind = 'info' | 'error'

export interface ToastMessage {
  id: string
  kind: ToastKind
  text: string
}

interface ToastState {
  toasts: ToastMessage[]
  /**
   * Empilha um aviso e agenda a auto-dispensa. Devolve o `id` gerado — quem
   * chama pode ignorar, ou guardar para dispensar cedo (não usado hoje, mas
   * mantém a action simétrica com `dismiss`).
   */
  push: (kind: ToastKind, text: string, durationMs?: number) => string
  /** Dispensa por `id`, na mão (botão) ou pelo próprio timer de `push`. Idempotente: `id` que já não está na fila é um no-op silencioso. */
  dismiss: (id: string) => void
}

/** Info some sozinho rápido; erro fica mais tempo porque normalmente pede
 *  atenção (nome de arquivo, o que fazer a seguir). */
const DEFAULT_DURATION_MS: Record<ToastKind, number> = {
  info: 4000,
  error: 7000,
}

/**
 * Timer de auto-dispensa por `id`, fora do state de propósito:
 * `ReturnType<typeof setTimeout>` não é dado de UI (não deve disparar
 * re-render) e só precisa existir para poder ser cancelado — mesmo padrão de
 * `sliderCommitTimers` em `App.tsx:187`, só que aqui module-scoped porque a
 * store (não um componente) é dona do ciclo de vida do timer.
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  push: (kind, text, durationMs = DEFAULT_DURATION_MS[kind]) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, kind, text }] }))
    timers.set(
      id,
      setTimeout(() => {
        get().dismiss(id)
      }, durationMs),
    )
    return id
  },

  dismiss: (id) => {
    const timer = timers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
}))
