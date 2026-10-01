import { useEffect, useId, useRef, useState } from 'react'
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
 * O painel abre com o foco no primeiro dado, fecha no Esc e no mesmo botão, e
 * não perde o que estava escolhido — inclusive o "Rolar escondido", que a
 * lista marca em cada rolagem.
 */
export function DiceDock({ rolls, onRoll }: DiceDockProps) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const panelId = useId()

  // Abriu: o foco entra no painel, no primeiro dado — pelo teclado, escolher e
  // rolar começam dali, sem caçar o painel com Tab.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>('.lb-dice-form__die')?.focus()
  }, [open])

  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape') return
    // Com o painel aberto, o Esc é dele, venha de onde vier no canto — o
    // próprio "Dados" inclusive, que fica fora do painel. Sem isto ele chegava
    // ao atalho "cancelar" do editor: largava a seleção do mapa e o painel
    // continuava aberto.
    event.stopPropagation()
    setOpen(false)
    toggleRef.current?.focus()
  }

  return (
    // Fechado, o Esc passa direto: largar a seleção continua sendo do editor.
    <div className="lb-dice-dock" onKeyDown={open ? closeOnEscape : undefined}>
      <DiceFeed rolls={rolls} className="lb-dice-dock__feed" />
      <section ref={panelRef} id={panelId} className="lb-panel lb-dice-dock__panel" aria-label="Dados" hidden={!open}>
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
