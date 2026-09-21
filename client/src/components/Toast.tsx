import type { ToastMessage } from '../stores/toastStore'
import './Toast.css'

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

/**
 * FRENTE A (onda 2, plano de refinamento — item 12: NOTIFICAÇÃO).
 *
 * Empilha os avisos de `useToastStore` no canto da tela. Não lê a store
 * direto (recebe `toasts`/`onDismiss` por prop) — mesma escolha de
 * `ZoomHud.tsx` (recebe `scale`/`onReset`), deixa o componente testável sem
 * precisar montar a store real e dá ao integrador o mesmo ponto de wiring
 * (um `useToastStore()` + `useToastStore.getState().dismiss` em `App.tsx`).
 *
 * Acessibilidade: cada aviso tem `role="alert"` (erro e instrução —
 * interrompe o leitor de tela) ou `role="status"` (info, anuncia sem
 * interromper — mesmo papel já usado no hint da Toolbar, `Toolbar.tsx:307`).
 * A instrução entra com `alert` de propósito: ela é o único aviso que a
 * pessoa PRECISA ouvir inteiro, porque o gesto dela não foi adiante. O nome
 * acessível é o
 * PRÓPRIO texto do aviso (conteúdo, não `aria-label`) — estável e é
 * exatamente o que a spec e2e deve procurar com
 * `getByRole('alert', { name: '...' })` / `getByRole('status', { name: '...' })`.
 * O botão de dispensar tem `aria-label` fixo ("Dispensar aviso"), igual para
 * todo toast — não inclui o texto do aviso porque um leitor de tela já leu o
 * texto do próprio card antes de chegar no botão.
 */
export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="lb-toaststack">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'info' ? 'status' : 'alert'}
          className={`lb-panel lb-toast lb-toast--${toast.kind}`}
        >
          <span className="lb-toast__text">{toast.text}</span>
          <button
            type="button"
            className="lb-toast__dismiss"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dispensar aviso"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
