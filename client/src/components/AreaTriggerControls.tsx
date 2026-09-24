import { useId } from 'react'
import type { AreaTriggerKind } from '../types/map'
import { AREA_TRIGGER_COLORS, AREA_TRIGGER_KINDS, AREA_TRIGGER_LABELS } from '../lib/areaTriggers'
import { Toggle } from './Toggle'

export interface AreaTriggerControlsProps {
  /** O gatilho da área selecionada; `null` = nenhum. */
  kind: AreaTriggerKind | null
  /** O mestre já mostrou a área aos jogadores. */
  revealed: boolean
  /** Marca a área, troca o tipo, ou limpa (`null`). */
  onKindChange: (kind: AreaTriggerKind | null) => void
  /** "Mostrar aos jogadores": liga ou desliga. */
  onRevealedChange: (revealed: boolean) => void
}

const OPTIONS: Array<{ kind: AreaTriggerKind | null; label: string }> = [
  { kind: null, label: 'Nenhum' },
  ...AREA_TRIGGER_KINDS.map((kind) => ({ kind, label: AREA_TRIGGER_LABELS[kind] })),
]

/** Amostra chapada da cor do gatilho no botão: a mesma cor que sai no mapa. */
function TriggerSwatch({ kind }: { kind: AreaTriggerKind | null }) {
  const fill = kind === null ? 'none' : `#${AREA_TRIGGER_COLORS[kind].toString(16).padStart(6, '0')}`
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="11" height="11" fill={fill} stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/**
 * GATILHO DE ÁREA no painel da Região/Sala: o mestre marca a área como
 * armadilha ou alarme (escolha única, no padrão `lb-seg` de `HazardControls`).
 * Com gatilho marcado, o texto diz o que acontece e o interruptor decide se
 * os jogadores veem a área marcada — escondida por padrão.
 */
export function AreaTriggerControls({ kind, revealed, onKindChange, onRevealedChange }: AreaTriggerControlsProps) {
  const hintId = `${useId()}-gatilho`
  return (
    <div className="lb-field">
      <span className="lb-label">Gatilho</span>
      <div className="lb-seg lb-seg--rows" role="radiogroup" aria-label="Gatilho da área">
        {OPTIONS.map((option) => (
          <button
            key={option.kind ?? 'nenhum'}
            type="button"
            role="radio"
            aria-checked={kind === option.kind}
            className="lb-seg__option"
            onClick={() => onKindChange(option.kind)}
          >
            <TriggerSwatch kind={option.kind} />
            {option.label}
          </button>
        ))}
      </div>
      {kind !== null && (
        <>
          <Toggle label="Mostrar aos jogadores" checked={revealed} onChange={onRevealedChange} describedBy={hintId} />
          <p className="lb-field__hint" id={hintId}>
            {revealed
              ? 'Os jogadores veem a área marcada. Você é avisado quando alguém entra.'
              : 'Só você sabe. Você é avisado quando a ficha de um jogador entra.'}
          </p>
        </>
      )}
    </div>
  )
}
