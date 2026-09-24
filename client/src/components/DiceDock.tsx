import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { DiceRequest } from '../lib/dice'
import { DiceFeed, DiceForm, type DiceFeedRoll } from './DiceControls'

interface DiceDockProps {
  /** As rolagens da mesa, da mais antiga à mais nova (a escondida do mestre, marcada). */
  rolls: readonly DiceFeedRoll[]
  onRoll: (request: DiceRequest, hidden: boolean) => void
}

/**
 * DADO ROLADO NA SALA na tela do mestre, no canto de baixo à direita, acima do
 * zoom: a lista das rolagens da mesa (sempre à vista, para ele ver o que os
 * jogadores tiraram sem abrir nada), o painel "Dados" e o botão que o abre.
 * O painel fecha no Esc e no mesmo botão, e não perde o que estava escolhido
 * — inclusive o "Rolar escondido", que a lista marca em cada rolagem.
 */
export function DiceDock({ rolls, onRoll }: DiceDockProps) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()

  function closeFromPanel(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return
    // O Esc é do painel: não chega ao atalho "cancelar" do editor.
    event.stopPropagation()
    setOpen(false)
    toggleRef.current?.focus()
  }

  return (
    <div className="lb-dice-dock">
      <DiceFeed rolls={rolls} className="lb-dice-dock__feed" />
      <section id={panelId} className="lb-panel lb-dice-dock__panel" aria-label="Dados" hidden={!open} onKeyDown={closeFromPanel}>
        <DiceForm onRoll={onRoll} allowHidden />
      </section>
      <button
        ref={toggleRef}
        type="button"
        className="lb-panel lb-dice-dock__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Dados
      </button>
    </div>
  )
}
