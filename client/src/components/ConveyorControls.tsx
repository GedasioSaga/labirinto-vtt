import { useId } from 'react'
import type { ConveyorDirection } from '../types/map'
import {
  CONVEYOR_DIRECTIONS,
  CONVEYOR_DIRECTION_LABELS,
  MAX_CONVEYOR_STEP,
  type ConveyorSetting,
} from '../lib/conveyors'

export interface ConveyorControlsProps {
  /** Para onde a esteira da Sala selecionada empurra; `null` = sala sem esteira. */
  direction: ConveyorDirection | null
  /** Casas por Avançar (o da esteira, ou o padrão de uma esteira nova). */
  stepCells: number
  /** Alguma ficha, em alguma esteira da cena, anda no próximo Avançar. */
  canAdvance: boolean
  /** Liga a esteira, troca direção/passo, ou desliga (`null`). */
  onChange: (setting: ConveyorSetting | null) => void
  /** O apito: todas as esteiras da cena empurram as fichas uma vez. */
  onAdvance: () => void
}

const OPTIONS: Array<{ direction: ConveyorDirection | null; label: string }> = [
  { direction: null, label: 'Nenhuma' },
  ...CONVEYOR_DIRECTIONS.map((direction) => ({ direction, label: CONVEYOR_DIRECTION_LABELS[direction] })),
]

const STEP_OPTIONS = Array.from({ length: MAX_CONVEYOR_STEP }, (_, i) => i + 1)

/** Rotação da seta (graus, horário a partir de "para cima"): o ícone aponta para onde a ficha vai. */
const ARROW_ROTATION: Record<ConveyorDirection, number> = { norte: 0, leste: 90, sul: 180, oeste: 270 }

/** Seta fina de traço, no estilo do minimapa: linha clara, sem preenchimento. */
function DirectionArrow({ direction }: { direction: ConveyorDirection | null }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {direction === null ? (
        <rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1" />
      ) : (
        <path
          d="M7 12V2M3 6l4-4 4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          transform={`rotate(${ARROW_ROTATION[direction]} 7 7)`}
        />
      )}
    </svg>
  )
}

function stepText(stepCells: number): string {
  return stepCells === 1 ? '1 casa' : `${stepCells} casas`
}

/**
 * ESTEIRA no painel da Sala: o mestre escolhe para onde a sala empurra
 * (escolha única, no padrão `lb-seg` de `HazardControls`), quantas casas por
 * vez, e aperta "Avançar esteiras" — o apito que move TODAS as esteiras da
 * cena. O botão diz por que fica parado quando ninguém tem para onde andar.
 */
export function ConveyorControls({ direction, stepCells, canAdvance, onChange, onAdvance }: ConveyorControlsProps) {
  const baseId = useId()
  const stepId = `${baseId}-passo`
  const hintId = `${baseId}-esteira`
  return (
    <div className="lb-field">
      <span className="lb-label">Esteira</span>
      <div className="lb-seg lb-seg--rows" role="radiogroup" aria-label="Esteira na sala">
        {OPTIONS.map((option) => (
          <button
            key={option.direction ?? 'nenhuma'}
            type="button"
            role="radio"
            aria-checked={direction === option.direction}
            className="lb-seg__option"
            onClick={() => onChange(option.direction === null ? null : { direction: option.direction, stepCells })}
          >
            <DirectionArrow direction={option.direction} />
            {option.label}
          </button>
        ))}
      </div>
      {direction !== null && (
        <>
          <label className="lb-label" htmlFor={stepId}>
            Passo (casas)
          </label>
          <select
            id={stepId}
            className="lb-input"
            value={String(stepCells)}
            onChange={(event) => onChange({ direction, stepCells: Number(event.target.value) })}
          >
            {STEP_OPTIONS.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="lb-btn lb-btn--block"
            disabled={!canAdvance}
            aria-describedby={hintId}
            onClick={onAdvance}
          >
            Avançar esteiras
          </button>
          <p className="lb-field__hint" id={hintId}>
            {`Empurra ${stepText(stepCells)} para ${CONVEYOR_DIRECTION_LABELS[direction].toLowerCase()} a cada Avançar, e para na parede. `}
            {canAdvance ? 'Move as fichas de todas as esteiras da cena.' : 'Nenhuma ficha em esteira pode andar agora.'}
          </p>
        </>
      )}
    </div>
  )
}
