import { useLayoutEffect, useRef } from 'react'
import type { ToastMessage } from '../stores/toastStore'
import { agruparAvisos, deixarTodos, tituloDaCaixa } from './caixaDeAvisos'
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
 *
 * Aviso com `actions` (pedido de passagem do jogador) ganha os botões embaixo
 * do texto, na ordem: o primeiro é a resposta esperada (latão), os outros são
 * a alternativa. O × de um aviso desses roda `onDismiss` — a pergunta nunca
 * some sem resposta.
 *
 * Avisos de mesmo `grupo` (os pedidos de passagem), dois ou mais, viram UMA
 * caixa — ver `CaixaDeAvisos` e a regra em `caixaDeAvisos.ts`.
 */
export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="lb-toaststack">
      {agruparAvisos(toasts).map((item) =>
        item.tipo === 'aviso' ? (
          <AvisoSolto key={item.toast.id} toast={item.toast} onDismiss={onDismiss} />
        ) : (
          <CaixaDeAvisos key={`grupo:${item.grupo}`} grupo={item.grupo} toasts={item.toasts} onDismiss={onDismiss} />
        ),
      )}
    </div>
  )
}

interface AvisoSoltoProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

function AvisoSolto({ toast, onDismiss }: AvisoSoltoProps) {
  return (
    <div role={toast.kind === 'info' ? 'status' : 'alert'} className={`lb-panel lb-toast lb-toast--${toast.kind}`}>
      <div className="lb-toast__body">
        <span className="lb-toast__text">{toast.text}</span>
        {toast.actions !== undefined && (
          <div className="lb-toast__actions">
            {toast.actions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                // O primeiro botão é a resposta esperada; os outros, a alternativa.
                className={index === 0 ? 'lb-btn lb-btn--primary' : 'lb-btn lb-btn--ghost'}
                onClick={() => {
                  // Tira da tela ANTES de agir: a ação pode empilhar outro
                  // aviso, e a pergunta respondida não pode ficar clicável.
                  onDismiss(toast.id)
                  action.run()
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="lb-toast__dismiss"
        onClick={() => {
          onDismiss(toast.id)
          toast.onDismiss?.()
        }}
        aria-label="Dispensar aviso"
      >
        ×
      </button>
    </div>
  )
}

interface CaixaDeAvisosProps {
  grupo: string
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

/**
 * A caixa "Pedidos (N)": uma linha por aviso, cada uma com os botões dela, e
 * "Deixar todos" embaixo. É uma `region` com nome, não um diálogo modal: o
 * mestre continua mexendo no mapa enquanto os pedidos esperam.
 *
 * Sem ×: cada linha já tem o "Não", e fechar a caixa inteira sumiria com
 * perguntas que alguém do outro lado está esperando.
 *
 * O foco: responder uma linha pelo teclado tira o botão focado da tela. Se o
 * foco estava na caixa e ela continua, ele volta para o primeiro botão da
 * linha seguinte — senão cairia no `body` e quem usa teclado recomeçaria do
 * topo da página a cada resposta.
 */
function CaixaDeAvisos({ grupo, toasts, onDismiss }: CaixaDeAvisosProps) {
  const caixaRef = useRef<HTMLElement>(null)
  const devolverFoco = useRef(false)
  const titulo = tituloDaCaixa(grupo, toasts.length)

  useLayoutEffect(() => {
    if (!devolverFoco.current) return
    devolverFoco.current = false
    caixaRef.current?.querySelector('button')?.focus()
  }, [toasts.length])

  /** Guarda se o foco estava aqui antes de a resposta tirar o botão da tela. */
  const lembrarFoco = () => {
    const caixa = caixaRef.current
    devolverFoco.current = caixa !== null && caixa.contains(document.activeElement)
  }

  return (
    <section ref={caixaRef} role="region" aria-label={titulo} className="lb-panel lb-toast lb-toast--instrucao lb-toastcaixa">
      {/* Polido, e não alerta: o número mudando é notícia, não interrupção. */}
      <h2 className="lb-toastcaixa__title" aria-live="polite">
        {titulo}
      </h2>
      <ul className="lb-toastcaixa__rows lb-scroll">
        {toasts.map((toast) => (
          <li key={toast.id} className="lb-toastcaixa__row">
            <span className="lb-toast__text">{toast.text}</span>
            {toast.actions !== undefined && (
              <div className="lb-toast__actions">
                {toast.actions.map((action, index) => (
                  <button
                    key={action.label}
                    type="button"
                    // Na linha, o botão de latão é o "Deixar todos" da caixa;
                    // aqui a resposta esperada só ganha o contorno cheio.
                    className={index === 0 ? 'lb-btn' : 'lb-btn lb-btn--ghost'}
                    onClick={() => {
                      lembrarFoco()
                      onDismiss(toast.id)
                      action.run()
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="lb-btn lb-btn--primary lb-toastcaixa__all" onClick={() => deixarTodos(toasts, onDismiss)}>
        Deixar todos
      </button>
    </section>
  )
}
