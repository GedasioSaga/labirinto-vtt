import { useToastStore, type ToastExtras, type ToastKind, type ToastMessage } from '../stores/toastStore'

/**
 * Para onde vão os avisos da ponte do host (`hostBridge.ts`) e do anunciador
 * de chegada (`avisoDeChegada.ts`). A ponte da sala usa a pilha do editor; a
 * ponte da Visão de jogador usa a dela (`visaoDeTeste/avisosDeTeste.ts`), que
 * marca o que é do teste e cala o resto: aviso do teste nunca se passa por
 * aviso da mesa de verdade.
 */
export interface ToastSink {
  push(kind: ToastKind, text: string, durationMs?: number | null, extras?: ToastExtras): string
  dismiss(id: string): void
  /** Os avisos na tela agora: o anunciador de chegada confere se o cartão dele ainda está lá. */
  toasts(): readonly ToastMessage[]
}

/** A pilha de avisos do editor (`useToastStore`), lida na hora de cada chamada: os testes trocam o estado dela. */
export const PILHA_DO_EDITOR: ToastSink = {
  push: (kind, text, durationMs, extras) => useToastStore.getState().push(kind, text, durationMs, extras),
  dismiss: (id) => useToastStore.getState().dismiss(id),
  toasts: () => useToastStore.getState().toasts,
}
