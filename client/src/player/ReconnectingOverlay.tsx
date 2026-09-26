import { useState } from 'react'
import type { ReconnectInfo } from './playerConnection'

export interface ReconnectingOverlayProps {
  info: ReconnectInfo
  /** "Reconectar": tenta agora, sem esperar a próxima tentativa sozinha. */
  onRetry(): void
  /**
   * "Guardar meu caderno": baixa o caderno e devolve o nome do arquivo. Sem
   * ele (nada a levar), o botão não aparece.
   */
  onDownloadNotebook?: () => string
}

/**
 * A conexão caiu e o cliente está voltando sozinho. O mapa continua embaixo,
 * esmaecido — é a mesa de antes, não uma tela de erro — e o véu segura o
 * toque: mexer a ficha agora não chegaria ao mestre. O "Reconectar" só
 * aparece depois de 30 s fora (`info.manual`); antes disso não há o que
 * decidir, a volta é automática.
 *
 * LEVAR O CADERNO PARA CASA: o mestre fechar o app é o fim de sessão mais
 * comum, e a queda de quem já estava na sala cai aqui, não na tela de
 * "conexão caiu". O véu cobre o Painel (e o Caderno dele), então o "Guardar
 * meu caderno" vem junto do "Reconectar".
 */
export function ReconnectingOverlay({ info, onRetry, onDownloadNotebook }: ReconnectingOverlayProps) {
  /** O que o "Guardar meu caderno" disse por último. */
  const [download, setDownload] = useState<string | null>(null)
  const saveNotebook = (save: () => string): void => {
    try {
      setDownload(`Baixado: ${save()}`)
    } catch (erro) {
      setDownload(`Não deu para baixar: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`)
    }
  }
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
            {onDownloadNotebook !== undefined && (
              <button type="button" className="pe-btn" onClick={() => saveNotebook(onDownloadNotebook)}>
                Guardar meu caderno
              </button>
            )}
            {download !== null && <p className="pp-reconnecting__hint">{download}</p>}
          </>
        )}
      </div>
    </div>
  )
}
