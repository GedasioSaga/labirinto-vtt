import type { PinLock } from '../types/map'
import { LOCK_ANSWER_MAX_LENGTH, normalizeLockAnswer, PIN_LOCK_FORM_LABELS, PIN_LOCK_FORMS, type LockDoorOption } from '../lib/pinLock'
import { Toggle } from './Toggle'

/** Uma porta trancada da cena que a fechadura pode destrancar junto (`lockDoorOptions`). */
export type PinLockDoorOption = LockDoorOption

export interface PinLockControlsProps {
  /** A fechadura do pino aberto no painel; `null` = sem fechadura. */
  lock: PinLock | null
  /** `undefined` tira a fechadura do pino. */
  onChange: (lock: PinLock | undefined) => void
  /** Portas trancadas da cena, a mais perto primeiro (e a já ligada, mesmo destrancada). */
  doors: readonly PinLockDoorOption[]
}

const ANSWER_ID = 'lb-pin-lock-answer'
const FORM_ID = 'lb-pin-lock-form'
const DOOR_ID = 'lb-pin-lock-door'

/** O que cada forma faz, dito ao mestre logo abaixo da escolha. */
const EFEITO_DA_FORMA: Record<PinLock['forma'], string> = {
  teclado: 'O jogador digita a combinação no cartão.',
  volantes: 'O jogador gira uma rodinha de 0 a 9 por número.',
}

/** A fechadura sem um campo: `aberta` e `abrePorta` são opcionais, e ausente não é `undefined` gravado. */
function without(lock: PinLock, key: 'aberta' | 'abrePorta'): PinLock {
  const next: PinLock = { resposta: lock.resposta, forma: lock.forma }
  if (key !== 'aberta' && lock.aberta === true) next.aberta = true
  if (key !== 'abrePorta' && lock.abrePorta !== undefined) next.abrePorta = lock.abrePorta
  return next
}

/**
 * FECHADURA COM SEGREDO no painel do pino (qualquer tipo). O mestre grava a
 * combinação, escolhe se o jogador digita ou gira volantes e, se quiser, a
 * porta trancada que acertar destranca junto. A combinação fica só no mapa
 * dele: o jogador vê a forma e as casas, e o host confere a tentativa.
 */
export function PinLockControls({ lock, onChange, doors }: PinLockControlsProps) {
  const certa = lock === null ? '' : normalizeLockAnswer(lock.resposta)
  const volanteComLetra = lock !== null && lock.forma === 'volantes' && certa !== '' && !/^[0-9]+$/.test(certa)
  return (
    <div className="lb-field">
      <Toggle
        label="Fechadura com segredo"
        checked={lock !== null}
        onChange={(on) => onChange(on ? { resposta: '', forma: 'teclado' } : undefined)}
      />
      {lock !== null && (
        <>
          <label className="lb-label" htmlFor={ANSWER_ID}>
            Combinação
          </label>
          <input
            id={ANSWER_ID}
            className="lb-input"
            type="text"
            value={lock.resposta}
            maxLength={LOCK_ANSWER_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onChange({ ...lock, resposta: event.target.value })}
          />
          {certa === '' && <span className="lb-label">Sem combinação, a fechadura não tranca nada.</span>}
          <span className="lb-label" id={FORM_ID}>
            Como o jogador abre
          </span>
          <div className="lb-seg" role="radiogroup" aria-labelledby={FORM_ID}>
            {PIN_LOCK_FORMS.map((forma) => (
              <button
                key={forma}
                type="button"
                role="radio"
                aria-checked={lock.forma === forma}
                className="lb-seg__option"
                onClick={() => onChange({ ...lock, forma })}
              >
                {PIN_LOCK_FORM_LABELS[forma]}
              </button>
            ))}
          </div>
          <p className="lb-travel__hint">
            {volanteComLetra ? 'Volante só gira números: com letras na combinação, o jogador vai digitar.' : EFEITO_DA_FORMA[lock.forma]}
          </p>
          <label className="lb-label" htmlFor={DOOR_ID}>
            Destranca também
          </label>
          <select
            id={DOOR_ID}
            className="lb-input"
            value={lock.abrePorta ?? ''}
            onChange={(event) => onChange(event.target.value === '' ? without(lock, 'abrePorta') : { ...lock, abrePorta: event.target.value })}
          >
            <option value="">Nenhuma porta</option>
            {doors.map((door) => (
              <option key={door.id} value={door.id}>
                {door.label}
              </option>
            ))}
          </select>
          {lock.aberta === true && (
            <>
              <span className="lb-label">Aberta: um jogador acertou a combinação.</span>
              <button type="button" className="lb-btn lb-btn--block" onClick={() => onChange(without(lock, 'aberta'))}>
                Trancar de novo
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
