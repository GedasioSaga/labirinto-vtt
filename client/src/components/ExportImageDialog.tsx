import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ImageExportOptions } from '../lib/mapImageExport'
import { CloseIcon } from './icons'
import './ExportImageDialog.css'

export interface ExportImageDialogProps {
  /** Estado inicial de "Incluir a grade": a grade como está no editor agora. */
  defaultGrid: boolean
  /** Imagem sendo gerada/gravada: o botão avisa e não aceita outro clique. */
  busy: boolean
  /** Falha da última tentativa, mostrada junto das ações; o diálogo continua aberto. */
  error?: string | null
  onExport: (options: ImageExportOptions) => void
  onClose: () => void
}

/** Entrada da janela: opacidade e escala de 0,95 a 1, curta (mesma da caixa de "não salvo"). */
const ENTER_MS = 160

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])'

/**
 * Janela "Exportar imagem": o mestre escolhe se a imagem leva a grade e os
 * objetos só do mestre, e confirma. "Só do mestre" começa DESLIGADO: a imagem
 * vai para o grupo, e esquecer a opção não pode entregar segredo.
 *
 * Ao fechar, o foco volta a quem abriu (o botão do rodapé).
 */
export function ExportImageDialog({ defaultGrid, busy, error = null, onExport, onClose }: ExportImageDialogProps) {
  const titleId = useId()
  const gridId = useId()
  const masterId = useId()
  const masterHintId = useId()
  const errorId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstOptionRef = useRef<HTMLInputElement>(null)
  // Fecha só se o clique COMEÇOU no fundo (mesmo cuidado de MapSettingsDialog).
  const pressStartedOnBackdrop = useRef(false)
  const [grid, setGrid] = useState(defaultGrid)
  const [masterOnly, setMasterOnly] = useState(false)

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    firstOptionRef.current?.focus()
    const box = dialogRef.current
    // `animate` não existe em jsdom, e quem pediu menos movimento não recebe nenhum.
    if (box && typeof box.animate === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      box.animate([{ opacity: 0, transform: 'scale(0.95)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ENTER_MS, easing: 'ease-out' })
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

  function confirm() {
    if (busy) return
    onExport({ grid, masterOnly })
  }

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="lb-panel lb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="lb-dialog__head">
          <h2 id={titleId} className="lb-dialog__title">
            Exportar imagem
          </h2>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-export-image__body">
          <p className="lb-field__hint" style={{ margin: 0 }}>
            Salva a cena atual como PNG, para imprimir ou mandar no grupo.
          </p>
          <label className="lb-export-image__option" htmlFor={gridId}>
            <input
              ref={firstOptionRef}
              id={gridId}
              type="checkbox"
              checked={grid}
              disabled={busy}
              onChange={(event) => setGrid(event.target.checked)}
            />
            <span>Incluir a grade</span>
          </label>
          <label className="lb-export-image__option" htmlFor={masterId}>
            <input
              id={masterId}
              type="checkbox"
              checked={masterOnly}
              disabled={busy}
              aria-describedby={masterHintId}
              onChange={(event) => setMasterOnly(event.target.checked)}
            />
            <span>Incluir objetos só do mestre</span>
          </label>
          <p id={masterHintId} className="lb-field__hint lb-export-image__hint">
            Desligado, o que está oculto para jogadores, as zonas ocultas e as salas secretas ficam fora da imagem.
          </p>
          {error !== null && (
            <p id={errorId} className="lb-export-image__error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="lb-export-image__actions">
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="lb-btn lb-btn--primary"
            disabled={busy}
            aria-describedby={error !== null ? errorId : undefined}
            onClick={confirm}
          >
            {busy ? 'Exportando…' : 'Exportar PNG'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
