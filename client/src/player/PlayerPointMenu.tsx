import { useEffect, useRef } from 'react'
import { isEditableTarget } from '../lib/keymap'

export interface PlayerPointMenuProps {
  /** Onde o dedo segurou, em px da janela. */
  at: { x: number; y: number }
  /**
   * Há caminho pelas ruas que o jogador conhece. `false` = o item fica
   * esmaecido no mesmo lugar, com o motivo, e não anda.
   */
  canWalk: boolean
  onWalk(): void
  onClose(): void
}

/** Distância do menu até o ponto, em px de tela: o dedo que acabou de segurar não o cobre. */
const FINGER_CLEARANCE_PX = 28
/** Perto do alto da tela o menu abre ABAIXO do ponto, em vez de sair da janela. */
const ROOM_ABOVE_PX = 96
/** Meia largura reservada do menu: o centro fica longe o bastante da borda para o menu inteiro caber. */
const HALF_WIDTH_PX = 112
const SCREEN_MARGIN_PX = 8

/**
 * MENU DO TOQUE LONGO no mapa do jogador. Hoje tem uma ação, "Andar até
 * aqui"; sem caminho conhecido, ela aparece esmaecida com "Você não conhece o
 * caminho" (a ação não some: o jogador aprende onde ela fica).
 *
 * Fecha ao escolher, com Escape, ou com qualquer toque fora dele — e esse
 * toque segue para o mapa normalmente (arrastar, abrir porta), nunca é engolido.
 */
export function PlayerPointMenu({ at, canWalk, onWalk, onClose }: PlayerPointMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRef = useRef<HTMLButtonElement | null>(null)

  // Foco no item ao abrir; ao fechar, volta para quem tinha antes (o mapa).
  useEffect(() => {
    const before = document.activeElement
    itemRef.current?.focus({ preventScroll: true })
    return () => {
      if (before instanceof HTMLElement && document.contains(before)) before.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const alvo = event.target
      if (alvo instanceof HTMLElement && isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)) return
      onClose()
    }
    // Captura: fecha antes de o toque chegar ao mapa, sem pará-lo.
    const onPointerDown = (event: Event) => {
      const alvo = event.target
      if (alvo instanceof Node && menuRef.current?.contains(alvo)) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [onClose])

  const viewportWidth = window.innerWidth
  const left = Math.min(Math.max(at.x, HALF_WIDTH_PX + SCREEN_MARGIN_PX), Math.max(viewportWidth - HALF_WIDTH_PX - SCREEN_MARGIN_PX, HALF_WIDTH_PX + SCREEN_MARGIN_PX))
  const below = at.y < ROOM_ABOVE_PX

  return (
    <div
      ref={menuRef}
      className={below ? 'pp-point-menu pp-point-menu--below' : 'pp-point-menu'}
      role="menu"
      aria-label="Ações no ponto"
      style={{ left, top: below ? at.y + FINGER_CLEARANCE_PX : at.y - FINGER_CLEARANCE_PX }}
    >
      <button
        ref={itemRef}
        type="button"
        role="menuitem"
        className="pp-point-menu__item"
        aria-disabled={canWalk ? undefined : true}
        onClick={() => {
          if (!canWalk) return
          onWalk()
          onClose()
        }}
      >
        Andar até aqui
        {!canWalk && <span className="pp-point-menu__why">Você não conhece o caminho</span>}
      </button>
    </div>
  )
}
