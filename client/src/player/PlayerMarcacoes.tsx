import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { PlayerMarkForm, type PlayerMarkFormProps } from './PlayerMarkForm'

/** "Marcar destino": o próximo toque no mapa põe a marca "vamos para cá". */
export interface MarcacaoDestino {
  armed: boolean
  /** A marca dele está no mapa: o item vira "Mudar destino" e aparece "Tirar marca". */
  has: boolean
  onToggle: () => void
  onClear?: () => void
}

/** "Anotar": o próximo toque no mapa marca onde vai a nota pessoal. */
export interface MarcacaoNota {
  armed: boolean
  onToggle: () => void
}

export interface PlayerMarcacoesProps {
  destination?: MarcacaoDestino
  note?: MarcacaoNota
  /** "Deixar marca aqui…": o bilhete ou a seta de giz onde a ficha está. */
  markForm?: PlayerMarkFormProps
}

/** O que fica escrito embaixo do botão enquanto um modo de toque está ligado: é para onde o dedo vai. */
function armedHint(destination: MarcacaoDestino | undefined, note: MarcacaoNota | undefined): string | null {
  if (destination?.armed === true) return 'Toque no destino, no mapa. Esc sai.'
  if (note?.armed === true) return 'Toque onde anotar. Só você vê. Esc sai.'
  return null
}

/**
 * MARCAÇÕES no painel do jogador: um botão só no lugar de "Marcar destino",
 * "Anotar" e "Deixar marca aqui…", que abre um menu pequeno com os três — e o
 * "Tirar marca" quando há destino. Menu de verdade (`menu`/`menuitem`): o foco
 * entra no primeiro item, as setas andam com volta, Home/End vão às pontas,
 * Escape fecha e devolve o foco ao botão (sem fechar a gaveta junto), Tab e
 * tocar fora fecham. O menu mora no fluxo do painel, embaixo do botão: na
 * gaveta do celular ele rola junto, sem conta de posição.
 */
export function PlayerMarcacoes({ destination, note, markForm }: PlayerMarcacoesProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  /** Aberto pelo teclado (Enter/Espaço): o menu aparece sem a entrada animada, como todo atalho. */
  const [instant, setInstant] = useState(false)
  const [markOpen, setMarkOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    // Tocar fora fecha; o botão de abrir cuida de si (o clique dele alterna).
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && (menuRef.current?.contains(alvo) === true || buttonRef.current?.contains(alvo) === true)) return
      setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [menuOpen])

  if (destination === undefined && note === undefined && markForm === undefined) return null

  const closeMenu = () => {
    setMenuOpen(false)
    buttonRef.current?.focus()
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // O Escape é do menu: sem isto ele chega à janela e fecha a gaveta junto.
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
      return
    }
    if (event.key === 'Tab') {
      setMenuOpen(false)
      return
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    const current = items.findIndex((item) => item === document.activeElement)
    const last = items.length - 1
    let next: number | null = null
    if (event.key === 'ArrowDown') next = current >= last ? 0 : current + 1
    else if (event.key === 'ArrowUp') next = current <= 0 ? last : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    items[next]?.focus()
  }

  /** Escolher fecha o menu antes: o modo ligado fecha a gaveta, e o foco não pode ficar num item que sumiu. */
  const choose = (run: () => void) => {
    setMenuOpen(false)
    run()
  }

  const hint = armedHint(destination, note)
  const clearDestination = destination?.has === true ? destination.onClear : undefined

  return (
    <div className="pp-marcacoes">
      <button
        ref={buttonRef}
        type="button"
        className="pp-button pp-marcacoes__toggle"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={(event) => {
          // `detail` 0 = Enter/Espaço: quem veio pelo teclado não espera animação.
          setInstant(event.detail === 0)
          setMenuOpen((open) => !open)
        }}
      >
        Marcações
        <svg className="pp-marcacoes__chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menuOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Marcações"
          className={instant ? 'pp-marcacoes__menu pp-marcacoes__menu--instant' : 'pp-marcacoes__menu'}
          onKeyDown={onMenuKeyDown}
        >
          {destination !== undefined && (
            <button type="button" role="menuitem" className="pp-marcacoes__item" onClick={() => choose(destination.onToggle)}>
              {destination.armed ? 'Cancelar destino' : destination.has ? 'Mudar destino' : 'Marcar destino'}
            </button>
          )}
          {clearDestination !== undefined && (
            <button type="button" role="menuitem" className="pp-marcacoes__item" onClick={() => choose(clearDestination)}>
              Tirar marca
            </button>
          )}
          {note !== undefined && (
            <button type="button" role="menuitem" className="pp-marcacoes__item" onClick={() => choose(note.onToggle)}>
              {note.armed ? 'Cancelar nota' : 'Anotar'}
            </button>
          )}
          {markForm !== undefined && (
            <button type="button" role="menuitem" className="pp-marcacoes__item" onClick={() => choose(() => setMarkOpen(true))}>
              Deixar marca aqui…
            </button>
          )}
        </div>
      )}
      {hint !== null && (
        <p className="pp-empty" role="status">
          {hint}
        </p>
      )}
      {markForm !== undefined && markOpen && (
        <PlayerMarkForm
          {...markForm}
          onDismiss={() => {
            setMarkOpen(false)
            buttonRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
