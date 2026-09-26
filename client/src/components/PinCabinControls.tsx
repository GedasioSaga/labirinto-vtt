import { useId } from 'react'
import type { CabinTarget } from '../lib/cabins'

export interface PinCabinControlsProps {
  /** Id da próxima parada deste pino; `null` = pino sem cabine. */
  target: string | null
  /** As paradas possíveis: os outros pinos "!"/"?" da cena ou, no pino de viagem, o par de cada saída. */
  targets: readonly CabinTarget[]
  /** O que dizer quando não há parada. Ausente = o texto do pino "!"/"?". */
  emptyHint?: string
  /** Alguém, em cabine ou esteira da cena, anda no próximo Avançar. */
  canAdvance: boolean
  /** Liga à parada, troca, ou desliga (`null`). */
  onChange: (targetId: string | null) => void
  /** O apito: as esteiras e as cabines da cena andam uma vez. */
  onAdvance: () => void
}

/** Valor do `<select>` para "sem cabine": nenhum id de pino é vazio (`readCabin`). */
const NONE = ''

/**
 * CABINE CONTÍNUA no painel do pino "!"/"?": o mestre escolhe a próxima
 * parada e aperta "Avançar esteiras" — o mesmo apito do painel da Sala, que
 * move as esteiras e as cabines juntas. O botão diz por que fica parado
 * quando ninguém tem para onde ir.
 */
export function PinCabinControls({ target, targets, emptyHint, canAdvance, onChange, onAdvance }: PinCabinControlsProps) {
  const baseId = useId()
  const selectId = `${baseId}-parada`
  const hintId = `${baseId}-cabine`
  const semParada = targets.length === 0
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={selectId}>
        Cabine contínua: leva a
      </label>
      <select
        id={selectId}
        className="lb-input"
        value={target ?? NONE}
        disabled={semParada && target === null}
        aria-describedby={semParada ? hintId : undefined}
        onChange={(event) => onChange(event.target.value === NONE ? null : event.target.value)}
      >
        <option value={NONE}>Nenhuma</option>
        {targets.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {semParada && target === null && (
        <p className="lb-field__hint" id={hintId}>
          {emptyHint ?? 'Crave outro pino nesta cena para ser a próxima parada.'}
        </p>
      )}
      {target !== null && (
        <>
          <button type="button" className="lb-btn lb-btn--block" disabled={!canAdvance} aria-describedby={hintId} onClick={onAdvance}>
            Avançar esteiras
          </button>
          <p className="lb-field__hint" id={hintId}>
            {'Quem ficar parado neste pino vai à próxima parada a cada Avançar. '}
            {canAdvance ? 'Move também as fichas das esteiras da cena.' : 'Ninguém parado em cabine ou esteira pode andar agora.'}
          </p>
        </>
      )}
    </div>
  )
}
