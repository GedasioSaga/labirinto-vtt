import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../components/icons'
import { CENARIO_DURACAO_NATURAL_S, duracaoDoCenarioS, movimentoInfo, type CenarioDoPino } from './catalogo'
import { AnimacaoCenario } from './AnimacaoCenario'
import { duracaoDoEstiloS, useEstilosDeCenario } from './estilosDeCenario'
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
  const estilos = useEstilosDeCenario()
  const estilo = cenario.estilo === undefined ? null : (estilos.find((e) => e.id === cenario.estilo) ?? null)
  const nome = estilo !== null ? estilo.nome : movimentoInfo(cenario.movimento).nome
  const duracaoS = estilo !== null ? duracaoDoEstiloS(cenario, estilo) : duracaoDoCenarioS(cenario)
  const naturalS = estilo !== null ? estilo.duracaoNaturalS : CENARIO_DURACAO_NATURAL_S

  function alternarSom() {
    setSom((ligado) => !ligado)
    // O estilo do pacote só recebe o volume ao ser criado: recomeça para o botão valer na hora.
    if (estilo !== null) setRodada((n) => n + 1)
  }

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
            Animação do Cenário · {nome}
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
            {segundos(duracaoS)}
            {cenario.duracaoS === undefined ? ' · duração natural' : ` · natural tem ${segundos(naturalS)}`}
          </span>
          <span className="lb-cenario-previa__acoes">
            {/* "Som do vento" é só da panorâmica; o estilo do pacote pode ter som próprio. */}
            {(estilo !== null || cenario.som) && (
              <button type="button" className="lb-btn lb-btn--ghost" aria-pressed={som} onClick={alternarSom}>
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
