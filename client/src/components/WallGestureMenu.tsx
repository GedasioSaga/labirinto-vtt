import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import './WallGestureMenu.css'

/** Folga, em px, entre o menu e a borda do mapa quando ele precisa recuar para caber. */
const MARGEM_DA_BORDA = 8

export const WALL_GESTURE_MENU_LABEL = 'Parede'

interface ItemDoMenu {
  label: string
  description: string
  onSelect: () => void
}

export interface WallGestureMenuProps {
  /** Ponto do clique direito, em px do contêiner do mapa: o canto do menu nasce ali. */
  x: number
  y: number
  /** Tamanho do contêiner, para o menu recuar em vez de sair pela borda. */
  limite: { width: number; height: number }
  onAbrirVao: () => void
  onDesabar: () => void
  onClose: () => void
}

/**
 * O gesto do mestre SOBRE a parede, no meio da sessão: clique direito na
 * linha abre este menu no ponto clicado, sem trocar de ferramenta.
 *
 * - "Abrir vão aqui": passagem de uma célula no ponto do clique;
 * - "Desabar parede": a parede inteira cai.
 * Os dois valem dos dois lados da divisa (`lib/abrirVao.ts`).
 *
 * Teclado como o menu da imagem de fundo (ActionBar.tsx): foco no primeiro
 * item ao abrir, setas/Home/End andam, Esc e Tab fecham. Clique fora fecha.
 */
export function WallGestureMenu({ x, y, limite, onAbrirVao, onDesabar, onClose }: WallGestureMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [posicao, setPosicao] = useState({ left: x, top: y })

  const itens: ItemDoMenu[] = [
    { label: 'Abrir vão aqui', description: 'Passagem de uma célula, dos dois lados da parede.', onSelect: onAbrirVao },
    { label: 'Desabar parede', description: 'A parede cai inteira, dos dois lados.', onSelect: onDesabar },
  ]

  // Recuo para caber: medido depois de montar, antes de pintar.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const left = Math.max(MARGEM_DA_BORDA, Math.min(x, limite.width - menu.offsetWidth - MARGEM_DA_BORDA))
    const top = Math.max(MARGEM_DA_BORDA, Math.min(y, limite.height - menu.offsetHeight - MARGEM_DA_BORDA))
    setPosicao({ left, top })
  }, [x, y, limite.width, limite.height])

  useEffect(() => {
    itemRefs.current[0]?.focus()
  }, [x, y])

  // Clique fora fecha — `pointerdown`, para fechar antes de o clique seguinte
  // começar outro gesto no mapa. A roda também: o mapa andaria por baixo e o
  // menu ficaria apontando para outra parede.
  useEffect(() => {
    const foraDoMenu = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', foraDoMenu)
    document.addEventListener('wheel', foraDoMenu, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', foraDoMenu)
      document.removeEventListener('wheel', foraDoMenu)
    }
  }, [onClose])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Nenhuma tecla do menu vale como atalho do editor (Esc largando a
    // seleção, setas movendo o item selecionado no mapa).
    event.stopPropagation()
    const botoes = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null)
    const atual = botoes.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        onClose()
        return
      case 'Tab':
        onClose()
        return
      case 'ArrowDown':
        event.preventDefault()
        botoes[(atual + 1) % botoes.length]?.focus()
        return
      case 'ArrowUp':
        event.preventDefault()
        botoes[(atual - 1 + botoes.length) % botoes.length]?.focus()
        return
      case 'Home':
        event.preventDefault()
        botoes[0]?.focus()
        return
      case 'End':
        event.preventDefault()
        botoes[botoes.length - 1]?.focus()
        return
    }
  }

  return (
    <div
      ref={menuRef}
      className="lb-panel lb-wall-menu"
      role="menu"
      aria-label={WALL_GESTURE_MENU_LABEL}
      onKeyDown={onKeyDown}
      // O clique direito DENTRO do menu não abre o do navegador por cima.
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: posicao.left, top: posicao.top }}
    >
      {itens.map((item, index) => (
        <BotaoDoMenu
          key={item.label}
          item={item}
          buttonRef={(node) => {
            itemRefs.current[index] = node
          }}
          onSelect={() => {
            onClose()
            item.onSelect()
          }}
        />
      ))}
    </div>
  )
}

/** Nome acessível = o rótulo; a explicação vai como descrição, não no nome. */
function BotaoDoMenu({ item, buttonRef, onSelect }: { item: ItemDoMenu; buttonRef: (node: HTMLButtonElement | null) => void; onSelect: () => void }) {
  const labelId = useId()
  const descriptionId = useId()
  return (
    <button
      ref={buttonRef}
      type="button"
      role="menuitem"
      tabIndex={-1}
      className="lb-wall-menu__item"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      onClick={onSelect}
    >
      <span id={labelId} className="lb-wall-menu__label">
        {item.label}
      </span>
      <span id={descriptionId} className="lb-wall-menu__desc">
        {item.description}
      </span>
    </button>
  )
}
