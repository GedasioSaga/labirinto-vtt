import type { ReconnectInfo } from './playerConnection'

export interface ReconnectingOverlayProps {
  info: ReconnectInfo
  /** "Reconectar": tenta agora, sem esperar a próxima tentativa sozinha. */
  onRetry(): void
}

/**
 * A conexão caiu e o cliente está voltando sozinho. O mapa continua embaixo,
 * esmaecido — é a mesa de antes, não uma tela de erro — e o véu segura o
 * toque: mexer a ficha agora não chegaria ao mestre. O "Reconectar" só
 * aparece depois de 30 s fora (`info.manual`); antes disso não há o que
 * decidir, a volta é automática.
 */
export function ReconnectingOverlay({ info, onRetry }: ReconnectingOverlayProps) {
  return (
    <div className="pp-reconnecting">
      <div className="pp-reconnecting__card">
        <p className="pp-reconnecting__title" role="status" aria-live="polite">
          <span className="pe-dot" aria-hidden="true" />
          Reconectando…
        </p>
        {info.manual && (
          <>
            <p className="pp-reconnecting__hint">A rede ainda não voltou. Continuo tentando sozinho.</p>
            <button type="button" className="pe-btn pe-btn--primary" onClick={onRetry}>
              Reconectar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
