import { useId } from 'react'
import type { MovementRules } from '../types/map'
import { MAX_STEP_CELLS_LIMIT, readMovementRules } from '../lib/movementRules'
import { Toggle } from './Toggle'

export interface MovementControlsProps {
  /** Regras da cena aberta; `undefined` = movimento livre. */
  movement: MovementRules | undefined
  /** Recebe as regras já limpas (`undefined` quando nada limita). */
  onMovementChange: (next: MovementRules | undefined) => void
}

/**
 * "Movimento dos jogadores" da janela Configurações do mapa. Vale só para a
 * cena aberta e só para as fichas dos jogadores: o mestre anda sem limite.
 * Toda mudança passa por `readMovementRules`, então o que chega à store é o
 * mesmo que o arquivo e o host aceitam (zero, negativo ou vazio = livre).
 */
export function MovementControls({ movement, onMovementChange }: MovementControlsProps) {
  const stepId = useId()
  const stepHintId = useId()
  const occupyHintId = useId()

  function change(patch: MovementRules) {
    onMovementChange(readMovementRules({ ...movement, ...patch }))
  }

  function changeStep(text: string) {
    const value = Number(text)
    // Vazio, zero ou inválido: tira o passo máximo (livre), mantém a ocupação.
    change({ maxStepCells: text.trim() === '' || !Number.isFinite(value) || value < 1 ? undefined : value })
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Movimento dos jogadores</h2>

      <div className="lb-field">
        <label className="lb-label" htmlFor={stepId}>
          Passo máximo (quadrados)
        </label>
        <input
          id={stepId}
          className="lb-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_STEP_CELLS_LIMIT}
          step={1}
          placeholder="Livre"
          aria-describedby={stepHintId}
          value={movement?.maxStepCells ?? ''}
          onChange={(event) => changeStep(event.target.value)}
        />
        <p id={stepHintId} className="lb-field__hint">
          Vazio é livre. A ficha do jogador para no último quadrado do alcance; o mestre anda sem limite.
        </p>
      </div>

      <div className="lb-field">
        <Toggle
          label="Fichas ocupam espaço"
          checked={movement?.tokensOccupy === true}
          describedBy={occupyHintId}
          onChange={(checked) => change({ tokensOccupy: checked })}
        />
        <p id={occupyHintId} className="lb-field__hint">
          Soltar a ficha sobre outra que o jogador vê volta com &quot;Lugar ocupado&quot;.
        </p>
      </div>
    </section>
  )
}
