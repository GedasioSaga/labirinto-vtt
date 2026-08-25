import type { Selection } from '../types/tools'
import { SELECTION_LABELS } from './labels'
import { TokenIcon } from './icons'

export interface SelectionControlsProps {
  selection: Selection | null
  onAddToken: () => void
  onRemoveSelected: () => void
}

/**
 * Ações sobre o que está selecionado no mapa.
 *
 * O texto do botão de apagar é verificado byte a byte pelos testes e2e
 * (`toHaveText('Apagar parede selecionada(o)')`), então ele não pode ganhar
 * ícone nem qualquer outro nó de texto.
 */
export function SelectionControls({ selection, onAddToken, onRemoveSelected }: SelectionControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Seleção</h2>
      <button type="button" className="lb-btn lb-btn--block" onClick={onAddToken}>
        <TokenIcon size={16} />
        Adicionar token
      </button>
      <button
        type="button"
        className={`lb-btn lb-btn--block${selection ? ' lb-btn--danger' : ''}`}
        onClick={onRemoveSelected}
        disabled={!selection}
      >
        {selection ? `Apagar ${SELECTION_LABELS[selection.kind]} selecionada(o)` : 'Nada selecionado'}
      </button>
    </section>
  )
}
