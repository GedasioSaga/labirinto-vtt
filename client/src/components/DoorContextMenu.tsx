import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useMapStore } from '../stores/mapStore'

export interface DoorContextMenuProps {
  /** A parede-porta clicada com o botão direito. */
  wallId: string
  /** Ponto do clique, em px da caixa do canvas (a âncora do menu). */
  x: number
  y: number
  onClose: () => void
}

/** Folga entre o menu e a borda do canvas quando o clique foi rente a ela. */
const EDGE_GAP_PX = 8

/**
 * Clique direito na porta (gestos rápidos do editor, 22/09/2026): Abrir/Fechar
 * e Trancar/Destrancar ali mesmo, com qualquer ferramenta na mão. Destrancar
 * custava 4-5 gestos — Selecionar, clicar na porta, achar o interruptor no
 * painel, voltar à ferramenta.
 *
 * Mesmo molde do menu "…" da cena (`ScenesSection`): o foco entra no primeiro
 * item, setas andam com volta, Home/End vão às pontas, Esc fecha sem mudar nada
 * e devolve o foco a quem o tinha, clique fora fecha. Cada item é um passo do
 * desfazer (as mesmas ações do painel da porta).
 */
export function DoorContextMenu({ wallId, x, y, onClose }: DoorContextMenuProps) {
  const door = useMapStore((state) => state.map.walls.find((w) => w.id === wallId)?.door ?? null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Quem tinha o foco antes de o menu abrir: o Esc devolve a ele.
  const focusBefore = useRef<Element | null>(document.activeElement)

  // A porta sumiu por baixo do menu (Ctrl+Z, outra ação): não há mais o que editar.
  useEffect(() => {
    if (door === null) onClose()
  }, [door, onClose])

  // Só ao abrir: o foco não volta ao primeiro item a cada render.
  useEffect(() => {
    itemRefs.current[0]?.focus()
  }, [])

  // Clique rente à borda direita ou de baixo: o menu recua para caber no canvas.
  useLayoutEffect(() => {
    const menu = menuRef.current
    const box = menu?.offsetParent
    if (!menu || !(box instanceof HTMLElement) || box.clientWidth === 0) return
    const left = Math.max(EDGE_GAP_PX, Math.min(x, box.clientWidth - menu.offsetWidth - EDGE_GAP_PX))
    const top = Math.max(EDGE_GAP_PX, Math.min(y, box.clientHeight - menu.offsetHeight - EDGE_GAP_PX))
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
  }, [x, y])

  useEffect(() => {
    // `pointerdown`, como no menu da cena: fecha antes de o clique acertar o que está por baixo.
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  if (door === null) return null

  const toggleOpen = () => {
    useMapStore.getState().setWallDoor(wallId, { ...door, open: !door.open })
    onClose()
  }
  const toggleLocked = () => {
    useMapStore.getState().setDoorLocked(wallId, !door.locked)
    onClose()
  }
  const items = [
    { label: door.open ? 'Fechar' : 'Abrir', onSelect: toggleOpen },
    { label: door.locked ? 'Destrancar' : 'Trancar', onSelect: toggleLocked },
  ]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla do menu vale como atalho do editor (Esc largaria a seleção, setas a moveriam).
    event.stopPropagation()
    const list = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null)
    const current = list.findIndex((el) => el === document.activeElement)
    const focusAt = (index: number) => {
      event.preventDefault()
      list[(index + list.length) % list.length]?.focus()
    }
    switch (event.key) {
      case 'Escape': {
        event.preventDefault()
        const before = focusBefore.current
        onClose()
        if (before instanceof HTMLElement && before.isConnected) before.focus()
        return
      }
      case 'Tab':
        onClose()
        return
      case 'ArrowDown':
        focusAt(current + 1)
        return
      case 'ArrowUp':
        focusAt(current < 0 ? list.length - 1 : current - 1)
        return
      case 'Home':
        focusAt(0)
        return
      case 'End':
        focusAt(list.length - 1)
        return
    }
  }

  return (
    <div
      ref={menuRef}
      className="lb-panel lb-portamenu"
      role="menu"
      aria-label="Porta"
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
      // O menu do navegador não abre por cima deste.
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => (
        <button
          key={index}
          ref={(node) => {
            itemRefs.current[index] = node
          }}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="lb-portamenu__item"
          // O destaque segue o ponteiro, como segue as setas.
          onPointerEnter={(event) => event.currentTarget.focus()}
          onClick={item.onSelect}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
