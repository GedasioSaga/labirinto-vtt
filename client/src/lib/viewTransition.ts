import { flushSync } from 'react-dom'

/**
 * Troca de tela com a View Transitions API: o navegador fotografa a tela
 * antiga, roda `update` (com `flushSync`, para o React pintar a nova tela
 * dentro do callback) e anima entre as duas. Elementos com o mesmo
 * `view-transition-name` nas duas telas viram uma peça só que muda de forma.
 *
 * Sem a API (jsdom, navegador antigo) ou com "reduzir movimento", troca na hora.
 */
export function withViewTransition(update: () => void): void {
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (typeof document.startViewTransition !== 'function' || reduce) {
    update()
    return
  }
  document.startViewTransition(() => flushSync(update))
}
