import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../components/icons'
import { CENARIO_DURACAO_NATURAL_S, duracaoDoCenarioS, movimentoInfo, type CenarioDoPino } from './catalogo'
import { AnimacaoCenario } from './AnimacaoCenario'
import './cenario.css'

interface CenarioPreviewDialogProps {
  imagem: string
  cenario: CenarioDoPino
  onClose: () => void
}

const ENTER_MS = 180
const FOCUSABLE = 'button:not([disabled])'

function segundos(s: number): string {
  return `${s.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`
}

/**
 * Janela no meio da tela com a ANIMAÇÃO DO CENÁRIO inteira sobre a imagem do
 * pino, repetindo até o mestre fechar. Mesmo molde do `TransicaoPreviewDialog`.
 */
export function CenarioPreviewDialog({ imagem, cenario, onClose }: CenarioPreviewDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const [som, setSom] = useState(true)
  const [rodada, setRodada] = useState(0)

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
      <div ref={dialogRef} className="lb-panel lb-dialog lb-cenario-previa" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <header className="lb-dialog__head">
          <h2 id={titleId} className="lb-dialog__title">
            Animação do Cenário · {movimentoInfo(cenario.movimento).nome}
          </h2>
          <button ref={closeRef} type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="lb-cenario-previa__palco">
          <AnimacaoCenario imagem={imagem} cenario={cenario} volume={som ? 0.5 : 0} repetir rodada={rodada} />
        </div>
        <div className="lb-cenario-previa__barra">
          <span className="lb-cenario-previa__info">
            {segundos(duracaoDoCenarioS(cenario))}
            {cenario.duracaoS === undefined ? ' · duração natural' : ` · natural tem ${segundos(CENARIO_DURACAO_NATURAL_S)}`}
          </span>
          <span className="lb-cenario-previa__acoes">
            {cenario.som && (
              <button type="button" className="lb-btn lb-btn--ghost" aria-pressed={som} onClick={() => setSom((ligado) => !ligado)}>
                {som ? 'Som ligado' : 'Som desligado'}
              </button>
            )}
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
