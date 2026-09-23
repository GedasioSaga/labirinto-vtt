import { useEffect, useRef, type KeyboardEvent } from 'react'
import { POINT_ACTION_KINDS, pointActionLabel, type PointActionKind } from '../lib/pointActions'

/**
 * Distância, em px de tela, entre o ponto do toque longo e o canto do menu.
 * O menu abre AO LADO do dedo, nunca por cima: segurar de novo no mesmo lugar
 * continua caindo no mapa, não num item do menu.
 */
export const POINT_MENU_OFFSET_PX = 16
/** Tamanho do menu (o mesmo do CSS `.pp-pointmenu`), para virar de lado perto da borda da tela. */
export const POINT_MENU_WIDTH_PX = 148
/** 5 itens de 40 px, 4 vãos de 2 px, 4 px de respiro em cima e embaixo e 1 px de borda de cada lado. */
export const POINT_MENU_HEIGHT_PX = 218
const EDGE_MARGIN_PX = 8

/** Abre à direita/abaixo do dedo; sem espaço, vira para o outro lado — sem nunca cobrir o ponto. */
function menuStart(point: number, size: number, viewport: number): number {
  const after = point + POINT_MENU_OFFSET_PX
  if (after + size <= viewport - EDGE_MARGIN_PX) return after
  return Math.max(EDGE_MARGIN_PX, point - POINT_MENU_OFFSET_PX - size)
}

interface PointActionMenuProps {
  /** Onde o dedo segurou, em px de tela. */
  screenX: number
  screenY: number
  /** "Sinalizar": o ponto pisca também para os colegas. Não vira pedido. */
  onSignal: () => void
  onChoose: (action: PointActionKind) => void
  onClose: () => void
}

/**
 * AÇÕES NO PONTO: o menu que abre depois do toque longo no mapa. O gesto só
 * avisou o mestre; aqui o jogador escolhe: Sinalizar (o ponto pisca para os
 * colegas também) ou Procurar, Escutar, Espiar e Revistar — cada um vira um
 * pedido com o ponto na Caixa do mestre, sem piscar nada para os colegas.
 *
 * Menu de verdade (`menu`/`menuitem`): o foco entra no primeiro item, as
 * setas andam com volta, Home/End vão às pontas e Escape fecha. Não é modal:
 * tocar no mapa fecha (quem fecha é o dono, pelo `onClose`).
 */
export function PointActionMenu({ screenX, screenY, onSignal, onChoose, onClose }: PointActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [])

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    const current = items.findIndex((item) => item === document.activeElement)
    const last = items.length - 1
    let next: number | null = null
    if (event.key === 'ArrowDown') next = current >= last ? 0 : current + 1
    else if (event.key === 'ArrowUp') next = current <= 0 ? last : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (next === null) return
    event.preventDefault()
    items[next]?.focus()
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Ações no ponto"
      className="pp-pointmenu"
      style={{ left: `${menuStart(screenX, POINT_MENU_WIDTH_PX, window.innerWidth)}px`, top: `${menuStart(screenY, POINT_MENU_HEIGHT_PX, window.innerHeight)}px` }}
      onKeyDown={moveFocus}
    >
      <button type="button" role="menuitem" className="pp-pointmenu__item" onClick={onSignal}>
        Sinalizar
      </button>
      {POINT_ACTION_KINDS.map((action) => (
        <button key={action} type="button" role="menuitem" className="pp-pointmenu__item" onClick={() => onChoose(action)}>
          {pointActionLabel(action)}
        </button>
      ))}
    </div>
  )
}
