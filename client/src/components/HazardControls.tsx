import { useId } from 'react'
import type { HazardKind } from '../types/map'
import { HAZARD_COLORS, HAZARD_KINDS, HAZARD_LABELS } from '../lib/hazards'

export interface HazardControlsProps {
  /** O perigo que toma a Sala selecionada; `null` = nenhum. */
  kind: HazardKind | null
  /** Quantas salas a zona desta sala tem (a zona avança inteira). */
  roomCount: number
  /** Há porta aberta por onde o perigo passa: o próximo passo muda alguma coisa. */
  canAdvance: boolean
  /** Pinta a sala com o perigo, troca de perigo, ou limpa (`null`). */
  onKindChange: (kind: HazardKind | null) => void
  /** Leva a zona desta sala um passo adiante pelas portas abertas. */
  onAdvance: () => void
}

const OPTIONS: Array<{ kind: HazardKind | null; label: string }> = [
  { kind: null, label: 'Nenhum' },
  ...HAZARD_KINDS.map((kind) => ({ kind, label: HAZARD_LABELS[kind] })),
]

/** Amostra chapada da cor do perigo no botão: a mesma cor que sai no mapa. */
function HazardSwatch({ kind }: { kind: HazardKind | null }) {
  const fill = kind === null ? 'none' : `#${HAZARD_COLORS[kind].toString(16).padStart(6, '0')}`
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="11" height="11" fill={fill} stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/**
 * ZONA DE PERIGO no painel da Sala: o mestre escolhe o perigo que toma a sala
 * (escolha única, no padrão `lb-seg` de `DoorKindControls`) e aperta "Avançar
 * um passo" para o perigo passar pelas portas abertas. O botão diz por que
 * fica parado quando nenhuma porta aberta leva o perigo adiante — o mestre
 * não clica no escuro.
 */
export function HazardControls({ kind, roomCount, canAdvance, onKindChange, onAdvance }: HazardControlsProps) {
  const hintId = `${useId()}-perigo`
  return (
    <div className="lb-field">
      <span className="lb-label">Perigo</span>
      <div className="lb-seg lb-seg--rows" role="radiogroup" aria-label="Perigo na sala">
        {OPTIONS.map((option) => (
          <button
            key={option.kind ?? 'nenhum'}
            type="button"
            role="radio"
            aria-checked={kind === option.kind}
            className="lb-seg__option"
            onClick={() => onKindChange(option.kind)}
          >
            <HazardSwatch kind={option.kind} />
            {option.label}
          </button>
        ))}
      </div>
      {kind !== null && (
        <>
          <button
            type="button"
            className="lb-btn lb-btn--block"
            disabled={!canAdvance}
            aria-describedby={hintId}
            onClick={onAdvance}
          >
            Avançar um passo
          </button>
          <p className="lb-field__hint" id={hintId}>
            {`${HAZARD_LABELS[kind]} em ${roomCount === 1 ? '1 sala' : `${roomCount} salas`}. `}
            {canAdvance ? 'Avança pelas portas abertas.' : 'Nenhuma porta aberta leva o perigo adiante.'}
          </p>
        </>
      )}
    </div>
  )
}
