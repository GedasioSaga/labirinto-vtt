import { useEffect, useRef, type KeyboardEvent } from 'react'
import { POINT_ACTION_KINDS, pointActionLabel, type PointActionKind } from '../lib/pointActions'
import { WalkHereItem, type WalkHereItemProps } from './PlayerPointMenu'

/**
 * Distância, em px de tela, entre o ponto do toque longo e o canto do menu.
 * O menu abre AO LADO do dedo, nunca por cima: segurar de novo no mesmo lugar
 * continua caindo no mapa, não num item do menu.
 */
export const POINT_MENU_OFFSET_PX = 16
/**
 * Tamanho do menu (o mesmo do CSS `.pp-pointmenu`), para virar de lado perto
 * da borda da tela. Largo o bastante para "Chamar o mestre aqui" caber numa
 * linha só, na letra de 15 px.
 */
export const POINT_MENU_WIDTH_PX = 192
/**
 * 2 itens de 44 px (o alvo de dedo do tema, `--lb-control-touch`), 1 vão de
 * 2 px, 4 px de respiro em cima e embaixo e 1 px de borda de cada lado. É
 * também o `max-height` do CSS: menor que a soma, os itens vazariam do menu.
 */
export const POINT_MENU_HEIGHT_PX = 100
/**
 * O "Andar até aqui" a mais (entre os dois), no caso mais alto: sem caminho, com o motivo
 * esmaecido em duas linhas embaixo. 8 px de respiro em cima e embaixo, o
 * rótulo (15 px na entrelinha 1,45 da página), 2 px, as duas linhas do motivo
 * (12 px na mesma entrelinha) e o vão de 2 px até o item de cima: 76,55 px,
 * arredondados para cima.
 */
export const POINT_MENU_WALK_HEIGHT_PX = 77
const EDGE_MARGIN_PX = 8

/**
 * Abre à direita/abaixo do dedo; sem espaço, vira para o outro lado — sem
 * cobrir o ponto. Sem espaço de nenhum dos dois lados (celular deitado), fica
 * preso à margem da tela, e aí cobre o ponto: não há onde mais caber.
 */
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
  /** "Chamar o mestre aqui": vira pedido com o ponto na Caixa do mestre. */
  onChoose: (action: PointActionKind) => void
  /**
   * ANDAR ATÉ AQUI, o item do meio: o mesmo toque longo, sem um segundo menu
   * no mesmo ponto. Ausente = sem ficha dele na cena, não há quem ande.
   */
  walk?: WalkHereItemProps
  onClose: () => void
}

/**
 * AÇÕES NO PONTO: o menu que abre depois do toque longo no mapa. O gesto só
 * avisou o mestre; aqui o jogador escolhe, nesta ordem: Sinalizar (o ponto
 * pisca para os colegas também), Andar até aqui e Chamar o mestre aqui — que
 * vira um pedido com o ponto na Caixa do mestre, sem piscar nada para os
 * colegas.
 *
 * Menu de verdade (`menu`/`menuitem`): o foco entra no primeiro item, as
 * setas andam com volta, Home/End vão às pontas e Escape fecha. Não é modal:
 * tocar no mapa fecha (quem fecha é o dono, pelo `onClose`).
 */
export function PointActionMenu({ screenX, screenY, onSignal, onChoose, walk, onClose }: PointActionMenuProps) {
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

  const height = walk === undefined ? POINT_MENU_HEIGHT_PX : POINT_MENU_HEIGHT_PX + POINT_MENU_WALK_HEIGHT_PX
  const left = menuStart(screenX, POINT_MENU_WIDTH_PX, window.innerWidth)
  const top = menuStart(screenY, height, window.innerHeight)

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Ações no ponto"
      className={walk === undefined ? 'pp-pointmenu' : 'pp-pointmenu pp-pointmenu--walk'}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        // A entrada (escala no CSS) parte do ponto do dedo, contado do canto do
        // menu: com o menu à direita e abaixo, fica fora do canto de cima à
        // esquerda; virado, fora do canto oposto; preso à margem, dentro dele.
        // Origem fixa num canto fazia o menu virado crescer longe do dedo.
        transformOrigin: `${screenX - left}px ${screenY - top}px`,
      }}
      onKeyDown={moveFocus}
    >
      <button type="button" role="menuitem" className="pp-pointmenu__item" onClick={onSignal}>
        Sinalizar
      </button>
      {walk !== undefined && <WalkHereItem canWalk={walk.canWalk} onWalk={walk.onWalk} />}
      {POINT_ACTION_KINDS.map((action) => (
        <button key={action} type="button" role="menuitem" className="pp-pointmenu__item" onClick={() => onChoose(action)}>
          {pointActionLabel(action)}
        </button>
      ))}
    </div>
  )
}
