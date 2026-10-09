import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { PlayerNoteDelivery } from '../net/hostSession'
import { useToastStore } from '../stores/toastStore'
import { NoteForm } from './ScenesSection'

/** Quem joga com o token: a mensagem do menu vai só a ele. */
export interface JogadorDoToken {
  playerId: string
  name: string
}

export interface TokenContextMenuProps {
  /** O nome do token, como o mestre o vê: o título do menu. */
  tokenName: string
  /** Ponto do clique, em px da caixa do canvas (a âncora do menu). */
  x: number
  y: number
  congelado: boolean
  onCongelar: (congelar: boolean) => void
  /** Os jogadores que controlam o token (em geral um só). */
  jogadores: readonly JogadorDoToken[]
  /** Manda a mensagem SÓ a este jogador. Ausente = sala fechada: não há quem leia, e o item some. */
  onMensagem?: (playerId: string, text: string) => PlayerNoteDelivery
  onClose: () => void
}

/** Folga entre o menu e a borda do canvas quando o clique foi rente a ela. */
const EDGE_GAP_PX = 8

/** O aviso depois do "Enviar": o que aconteceu com a mensagem. */
export function mensagemDoTokenFeedback(name: string, delivery: PlayerNoteDelivery): string {
  if (delivery === 'sent') return `Mensagem enviada a ${name}`
  if (delivery === 'queued') return `${name} recebe a mensagem ao voltar`
  return 'Não deu para enviar: a sala não está aberta.'
}

/**
 * Clique direito no token que um jogador controla: Congelar/Descongelar e
 * "Enviar mensagem…" ali mesmo, sem procurar a linha dele no Grupo. A
 * mensagem é o "Recado" só para ele (`playerNote`): chega como cartão "Só
 * para você" e, se ele caiu, fica guardada até voltar.
 *
 * Mesmo molde do menu da porta (`DoorContextMenu`): foco no primeiro item,
 * setas com volta, Home/End, Esc fecha e devolve o foco, clique fora fecha.
 * "Enviar mensagem…" troca os itens pelo campo do recado (`NoteForm`).
 */
export function TokenContextMenu({ tokenName, x, y, congelado, onCongelar, jogadores, onMensagem, onClose }: TokenContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  // Quem tinha o foco antes de o menu abrir: o Esc devolve a ele.
  const focusBefore = useRef<Element | null>(document.activeElement)
  const [escrevendoPara, setEscrevendoPara] = useState<JogadorDoToken | null>(null)

  // Só ao abrir: o foco não volta ao primeiro item a cada render.
  useEffect(() => {
    itemRefs.current[0]?.focus()
  }, [])

  // Clique rente à borda direita ou de baixo: o menu recua para caber no canvas.
  // O campo da mensagem é mais alto que a lista: refaz a conta quando ele abre.
  useLayoutEffect(() => {
    const menu = menuRef.current
    const box = menu?.offsetParent
    if (!menu || !(box instanceof HTMLElement) || box.clientWidth === 0) return
    const left = Math.max(EDGE_GAP_PX, Math.min(x, box.clientWidth - menu.offsetWidth - EDGE_GAP_PX))
    const top = Math.max(EDGE_GAP_PX, Math.min(y, box.clientHeight - menu.offsetHeight - EDGE_GAP_PX))
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
  }, [x, y, escrevendoPara])

  useEffect(() => {
    // `pointerdown`, como no menu da porta: fecha antes de o clique acertar o que está por baixo.
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  const enviar = (jogador: JogadorDoToken, text: string) => {
    if (onMensagem === undefined) return
    const delivery = onMensagem(jogador.playerId, text)
    useToastStore.getState().push(delivery === null ? 'error' : 'info', mensagemDoTokenFeedback(jogador.name, delivery))
    onClose()
  }

  const items = [
    {
      label: congelado ? 'Descongelar' : 'Congelar',
      onSelect: () => {
        onCongelar(!congelado)
        onClose()
      },
    },
    ...(onMensagem === undefined
      ? []
      : jogadores.map((jogador) => ({
          label: jogadores.length === 1 ? 'Enviar mensagem…' : `Mensagem para ${jogador.name}…`,
          onSelect: () => setEscrevendoPara(jogador),
        }))),
  ]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla do menu vale como atalho do editor (Esc largaria a seleção, setas moveriam o token).
    event.stopPropagation()
    if (escrevendoPara !== null) return
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
      className={escrevendoPara === null ? 'lb-panel lb-portamenu' : 'lb-panel lb-portamenu lb-tokenmenu--escrevendo'}
      role={escrevendoPara === null ? 'menu' : 'dialog'}
      aria-label={`Token: ${tokenName}`}
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
      // O menu do navegador não abre por cima deste.
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="lb-tokenmenu__titulo">{tokenName}</p>
      {escrevendoPara === null ? (
        items.map((item, index) => (
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
        ))
      ) : (
        <NoteForm label={`Mensagem só para ${escrevendoPara.name}`} onSend={(text) => enviar(escrevendoPara, text)} onCancel={onClose} />
      )}
    </div>
  )
}
