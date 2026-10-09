import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../components/icons'
import { assinarTransicoes, duracaoEfetivaS, transicaoInfo, type TransicaoEscolhida } from './catalogo'
import { TransicaoTela } from './TransicaoTela'
import './transicoes.css'

interface TransicaoPreviewDialogProps {
  escolha: TransicaoEscolhida
  onClose: () => void
}

const ENTER_MS = 180
const FOCUSABLE = 'button:not([disabled])'

export function formatarSegundos(segundos: number): string {
  return `${segundos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`
}

/**
 * Janela no meio da tela com a animação inteira, na duração escolhida,
 * repetindo até o mestre fechar. Mesmo molde de `ExportImageDialog`: foco
 * preso, Esc fecha, clique fora fecha.
 */
export function TransicaoPreviewDialog({ escolha, onClose }: TransicaoPreviewDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const [som, setSom] = useState(true)
  const [rodada, setRodada] = useState(0)
  // Viva: o pacote pode ser trocado com a janela aberta (botão "Procurar
  // animações novas"); a transição que sumiu vira "não instalada", não erro.
  const info = useSyncExternalStore(assinarTransicoes, () => transicaoInfo(escolha.id))

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const box = dialogRef.current
    if (box && typeof box.animate === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      box.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ENTER_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
    }
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    pressStartedOnBackdrop.current = event.target === event.currentTarget
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
    pressStartedOnBackdrop.current = false
  }

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="lb-panel lb-dialog lb-transicao-previa"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="lb-dialog__head">
          <h2 id={titleId} className="lb-dialog__title">
            {info?.nome ?? escolha.id}
          </h2>
          <button ref={closeRef} type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="lb-transicao-previa__palco">
          <TransicaoTela escolha={escolha} volume={som ? 1 : 0} repetir rodada={rodada} />
        </div>
        <div className="lb-transicao-previa__barra">
          <span className="lb-transicao-previa__info">
            {info === undefined ? (
              'Não instalada neste app'
            ) : (
              <>
                {formatarSegundos(duracaoEfetivaS(escolha, info))}
                {escolha.duracaoS === undefined ? ' · animação completa' : ` · completa tem ${formatarSegundos(info.duracaoNaturalS)}`}
              </>
            )}
          </span>
          <span className="lb-transicao-previa__acoes">
            <button type="button" className="lb-btn lb-btn--ghost" aria-pressed={som} onClick={() => setSom((ligado) => !ligado)}>
              {som ? 'Som ligado' : 'Som desligado'}
            </button>
            <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setRodada((n) => n + 1)}>
              Repetir
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
