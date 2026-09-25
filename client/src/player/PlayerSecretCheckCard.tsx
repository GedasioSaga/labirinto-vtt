import { useId, useRef, useState, type FormEvent } from 'react'
import { SECRET_CHECK_RESULT_MAX, SECRET_CHECK_RESULT_MIN, isSecretCheckResult } from '../net/protocol'
import type { SecretCheckNoticeKind } from './playerConnection'

export interface PlayerSecretCheckCardProps {
  /** O nome do teste como o mestre escreveu ("Percepção"). Vai para a tela como TEXTO. */
  label: string
  /** O jogador mandou o resultado (inteiro, já dentro da faixa). */
  onAnswer(result: number): void
}

export const SECRET_CHECK_PRIVACY_HINT = 'Só o mestre vê o resultado.'
export const SECRET_CHECK_INVALID_TEXT = `Use um número inteiro de ${SECRET_CHECK_RESULT_MIN} a ${SECRET_CHECK_RESULT_MAX}.`
/** O aviso que fica quando o cartão fecha (`PlayerState.secretCheckNotice`). Nunca repete o resultado. */
export const SECRET_CHECK_NOTICE_TEXT: Record<SecretCheckNoticeKind, string> = {
  sent: 'Resultado enviado ao mestre',
  closed: 'O mestre encerrou o teste',
}

/** O que o jogador digitou vira resultado? `null` = ainda não (vazio, fração, fora da faixa). */
function parseTypedResult(typed: string): number | null {
  const trimmed = typed.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return isSecretCheckResult(value) ? value : null
}

/**
 * O TESTE SECRETO na tela do jogador escolhido: o mestre pediu um teste
 * ("Percepção") e ele manda o número que tirou. Os colegas não recebem este
 * cartão, e o resultado vai só ao mestre. Fica até ele enviar ou o mestre
 * encerrar. Não rouba o foco nem tapa o mapa: chega sem ele pedir, e ele pode
 * estar no meio de arrastar a ficha. Enter no campo envia (é um formulário);
 * enviar vazio ou inválido diz o que corrigir junto ao campo e leva o foco a ele.
 */
export function PlayerSecretCheckCard({ label, onAnswer }: PlayerSecretCheckCardProps) {
  const titleId = useId()
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [typed, setTyped] = useState('')
  // Só depois de uma tentativa de envio: o erro não aparece a cada tecla da primeira digitação.
  const [tried, setTried] = useState(false)
  const result = parseTypedResult(typed)
  const showError = tried && result === null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (result !== null) {
      onAnswer(result)
      return
    }
    setTried(true)
    inputRef.current?.focus()
  }

  return (
    <section className="pp-note pp-note--secret" aria-labelledby={titleId}>
      <h2 id={titleId} className="pp-note__title">
        Teste secreto
      </h2>
      <p className="pp-note__text">{label}</p>
      <form className="pp-secret__form" onSubmit={submit} noValidate>
        <label className="pp-secret__label" htmlFor={inputId}>
          Seu resultado
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="pp-secret__input"
          type="number"
          inputMode="numeric"
          step={1}
          min={SECRET_CHECK_RESULT_MIN}
          max={SECRET_CHECK_RESULT_MAX}
          value={typed}
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? `${errorId} ${hintId}` : hintId}
          onChange={(event) => setTyped(event.target.value)}
        />
        <button type="submit" className="pp-note__close">
          Enviar
        </button>
      </form>
      {showError && (
        <p id={errorId} className="pp-secret__error" role="alert">
          {SECRET_CHECK_INVALID_TEXT}
        </p>
      )}
      <p id={hintId} className="pp-secret__hint">
        {SECRET_CHECK_PRIVACY_HINT}
      </p>
    </section>
  )
}
