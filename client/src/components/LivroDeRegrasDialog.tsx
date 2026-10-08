import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { CapituloDoLivro, SistemaDeRpg } from '../lib/sistemaDeRpg'
import { CloseIcon } from './icons'
import { LivroDeRegras } from './LivroDeRegras'

export interface LivroDeRegrasDialogProps {
  sistema: SistemaDeRpg
  onClose: () => void
}

/** Sistema só com catálogos: a mesma lista vazia a cada render, para o índice da busca não refazer à toa. */
const SEM_CAPITULOS: readonly CapituloDoLivro[] = []

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * Janela do LIVRO DE REGRAS do mestre, aberta pela zona Aventura ("Livro de
 * regras") ou pela ficha ("Livro"). Mesma casca da janela da ficha: portal no
 * `body`, foco preso dentro, Esc fecha. Montada DEPOIS da ficha em
 * `RpgDialogs`, então abre por cima dela, e fechar volta o foco ao "Livro".
 */
export function LivroDeRegrasDialog({ sistema, onClose }: LivroDeRegrasDialogProps) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)

  useEffect(() => {
    const opener = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor (nem da ficha) atrás dela.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    const first = items.at(0)
    const last = items.at(-1)
    if (first === undefined || last === undefined) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
    pressStartedOnBackdrop.current = false
  }

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={(event) => (pressStartedOnBackdrop.current = event.target === event.currentTarget)} onClick={onBackdropClick}>
      <div ref={dialogRef} className="lb-panel lb-dialog lb-livro-janela" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onKeyDown={onKeyDown}>
        <header className="lb-dialog__head">
          <p className="lb-eyebrow" id={tituloId}>
            Livro de regras · {sistema.nome}
          </p>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar o livro" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-livro-janela__corpo">
          <LivroDeRegras sistema={sistema} livro={sistema.livro ?? SEM_CAPITULOS} catalogos={sistema.catalogos} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
