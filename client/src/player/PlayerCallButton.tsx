import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { CALL_REASONS, CALL_REASON_LABELS, CALL_TEXT_MAX_LENGTH, type CallReason } from '../net/protocol'
import type { CallNotice } from './playerConnection'

export interface PlayerCallButtonProps {
  /** A mão agora (`playerConnection`): ausente = abaixada, nada a mostrar. */
  call: CallNotice | undefined
  /** Chama o mestre. `false` quando não saiu (socket fechado): o formulário fica, com o que foi escrito. */
  onRaise: (reason: CallReason, text?: string) => boolean
  onLower: () => void
}

const REASON_PADRAO: CallReason = 'ajuda'

/**
 * CHAMAR O MESTRE: a mão fixa no canto da tela do jogador. O toque abre um
 * formulário pequeno — o motivo (um dos cinco) e um texto curto opcional —
 * e "Chamar" acende a mão: "Esperando o mestre", com o motivo, até o mestre
 * marcar Visto ou responder. Enquanto acesa, não há como chamar de novo:
 * cinco toques não viram cinco chamados.
 *
 * Não é um diálogo modal: o mapa continua vivo atrás. Esc fecha o formulário
 * e devolve o foco à mão.
 */
export function PlayerCallButton({ call, onRaise, onLower }: PlayerCallButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<CallReason>(REASON_PADRAO)
  const [text, setText] = useState('')
  const [failed, setFailed] = useState(false)
  const formId = useId()
  const textId = useId()
  const legendId = useId()
  const handRef = useRef<HTMLButtonElement>(null)
  const firstRadioRef = useRef<HTMLInputElement>(null)
  const returnFocus = useRef(false)
  const waiting = call?.phase === 'waiting'

  // Mão acesa por outro caminho (confirmação do mestre depois de reconectar): o formulário não sobra aberto.
  useEffect(() => {
    if (waiting) setOpen(false)
  }, [waiting])

  useLayoutEffect(() => {
    if (open) {
      firstRadioRef.current?.focus()
      return
    }
    if (!returnFocus.current) return
    returnFocus.current = false
    handRef.current?.focus()
  }, [open])

  function close(): void {
    returnFocus.current = true
    setOpen(false)
    setFailed(false)
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const clean = text.trim()
    if (!onRaise(reason, clean === '' ? undefined : clean)) {
      setFailed(true)
      return
    }
    setOpen(false)
    setFailed(false)
    setText('')
    setReason(REASON_PADRAO)
  }

  function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
    if (event.key !== 'Escape') return
    // O Escape é do formulário: não fecha junto o cartão do pino nem o recado.
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    close()
  }

  return (
    <div className={waiting ? 'pp-call is-waiting' : 'pp-call'}>
      {call?.phase === 'waiting' ? (
        <>
          <p className="pp-call__lit" role="status">
            {`Esperando o mestre · ${CALL_REASON_LABELS[call.reason]}`}
          </p>
          <button type="button" className="pp-call__lower" onClick={onLower}>
            Baixar a mão
          </button>
        </>
      ) : (
        <>
          {call !== undefined && (
            <p key={call.id} className="pp-call__notice" role="status">
              {call.phase === 'seen' ? 'O mestre viu' : 'Espere um instante para chamar de novo'}
            </p>
          )}
          <button
            ref={handRef}
            type="button"
            className="pp-call__hand"
            aria-expanded={open}
            aria-controls={open ? formId : undefined}
            onClick={() => (open ? close() : setOpen(true))}
          >
            Chamar o mestre
          </button>
        </>
      )}
      {open && !waiting && (
        <form id={formId} className="pp-call__form" onSubmit={submit} onKeyDown={onFormKeyDown}>
          <fieldset className="pp-call__reasons" aria-labelledby={legendId}>
            <legend id={legendId} className="pp-label">
              Motivo
            </legend>
            {CALL_REASONS.map((value, index) => (
              <label key={value} className={value === 'urgente' ? 'pp-call__reason is-urgent' : 'pp-call__reason'}>
                <input
                  ref={index === 0 ? firstRadioRef : undefined}
                  type="radio"
                  name={`${formId}-motivo`}
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                <span>{CALL_REASON_LABELS[value]}</span>
              </label>
            ))}
          </fieldset>
          <label className="pp-label" htmlFor={textId}>
            Detalhe (opcional)
          </label>
          <input
            id={textId}
            className="pp-input"
            type="text"
            value={text}
            maxLength={CALL_TEXT_MAX_LENGTH}
            aria-describedby={`${textId}-restantes`}
            onChange={(event) => setText(event.target.value)}
          />
          <p id={`${textId}-restantes`} className="pp-empty">
            {`${CALL_TEXT_MAX_LENGTH - text.length} caracteres restantes`}
          </p>
          {failed && (
            <p className="pp-error" role="alert">
              Não deu para chamar: a conexão com o mestre caiu. Tente de novo.
            </p>
          )}
          <div className="pp-call__actions">
            <button type="submit" className="pp-button pp-button--primary">
              Chamar
            </button>
            <button type="button" className="pp-button" onClick={close}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
