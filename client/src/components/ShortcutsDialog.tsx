import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { shortcutColumns, type ShortcutCombo, type ShortcutGroup } from './shortcutSheet'
import './ShortcutsDialog.css'

export interface ShortcutsDialogProps {
  onClose: () => void
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

/** Letras e flags são fixas enquanto o app roda: a tela é montada uma vez. */
const COLUMNS = shortcutColumns()

/**
 * Tela de atalhos: o que cada letra e cada combinação faz no editor, agrupado
 * por assunto. Abre pela tecla `?` com o foco no mapa (sem pino selecionado —
 * com pino, o `?` é dele) e pelo botão da barra de ações; fecha com Esc, com o
 * `?` de novo, no X ou no fundo.
 *
 * Mesma casca da janela "Configurações do mapa": portal no `body` (o painel
 * lateral usa `backdrop-filter`, que prenderia a janela na coluna dele), foco
 * preso dentro e devolvido a quem abriu. Sem animação de entrada, de
 * propósito: a tela abre sobretudo pelo teclado, e movimento em resposta a
 * tecla só atrasa a leitura.
 */
export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  const titleId = useId()
  const ledeId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Fecha só se o clique COMEÇOU no fundo: arrastar de dentro para fora dispara
  // `click` no ancestral comum, que é o próprio fundo.
  const pressStartedOnBackdrop = useRef(false)

  // O foco entra pela lista — é ela que rola nas setas quando a janela é
  // baixa — e volta, ao fechar, para quem abriu: o botão da barra ou o mapa.
  useEffect(() => {
    const opener = document.activeElement
    bodyRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [])

  function keepTabInside(event: KeyboardEvent<HTMLDivElement>) {
    const items = focusablesIn(dialogRef.current)
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const last = items.length - 1
    const current = items.findIndex((item) => item === document.activeElement)
    // Foco fora da volta (no corpo da janela, depois de um clique no texto) ou
    // numa ponta: a volta continua por dentro, nunca na página atrás.
    if (current === -1) {
      event.preventDefault()
      items[event.shiftKey ? last : 0].focus()
    } else if (event.shiftKey && current === 0) {
      event.preventDefault()
      items[last].focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      items[0].focus()
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor atrás dela
    // (letra trocando de ferramenta, Delete apagando a seleção, Esc desmarcando).
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    // A mesma tecla que abriu fecha. Segurada, o teclado repete o `?`: sem a
    // trava a janela fecharia e o mapa a abriria de novo, piscando.
    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      if (!event.repeat) onClose()
      return
    }
    if (event.key === 'Tab') keepTabInside(event)
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
        className="lb-panel lb-dialog lb-shortcuts"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ledeId}
        // Clique no texto da janela deixa o foco AQUI, e não no `body` da
        // página — onde o Esc e o `?` iriam para o mapa atrás.
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="lb-dialog__head">
          <div className="lb-shortcuts__intro">
            <h2 id={titleId} className="lb-dialog__title">
              Atalhos do teclado
            </h2>
            <p id={ledeId} className="lb-shortcuts__lede">
              Valem fora dos campos de texto. Num campo, as letras escrevem.
            </p>
          </div>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div ref={bodyRef} className="lb-dialog__body lb-scroll lb-shortcuts__body" tabIndex={0}>
          {COLUMNS.map((groups) => (
            <div key={groups[0]?.title} className="lb-shortcuts__column">
              {groups.map((group) => (
                <ShortcutGroupView key={group.title} group={group} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Um assunto: título e as linhas "o que faz — tecla". */
function ShortcutGroupView({ group }: { group: ShortcutGroup }) {
  const headingId = useId()
  return (
    <div className="lb-shortcuts__group" role="group" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        {group.title}
      </h3>
      <ul className="lb-shortcuts__list">
        {group.rows.map((row) => (
          // O espaço em TEXTO entre as duas metades não é enfeite: sem ele a
          // linha se lê "PinoY" — para leitor de tela e para quem busca a
          // tecla no texto —, e a distância visual vem do CSS.
          <li key={`${row.what}|${row.combo.keys.join('+')}`} className="lb-shortcuts__row">
            <span className="lb-shortcuts__what">{row.what}</span> <Keys combo={row.combo} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * As teclas como estão no teclado — cada uma numa tecla desenhada, unidas por
 * "+" — e o gesto do mouse por extenso ("segurar L + arrastar").
 */
function Keys({ combo }: { combo: ShortcutCombo }) {
  const parts: ReactNode[] = []
  if (combo.hold) parts.push(<span key="hold">segurar</span>)
  combo.keys.forEach((key, index) => {
    if (index > 0) parts.push(<span key={`plus-${index}`}>+</span>)
    parts.push(
      <kbd key={`key-${index}`} className="lb-key">
        {key}
      </kbd>,
    )
  })
  if (combo.mouse) {
    if (combo.keys.length > 0) parts.push(<span key="plus-mouse">+</span>)
    parts.push(<span key="mouse">{combo.mouse}</span>)
  }
  // Espaço em texto entre as peças, pelo mesmo motivo da linha: "Ctrl + Z".
  return <span className="lb-shortcuts__keys">{parts.flatMap((part, index) => (index === 0 ? [part] : [' ', part]))}</span>
}
