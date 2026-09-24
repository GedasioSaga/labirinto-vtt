import { useState, type FormEvent } from 'react'
import type { PinLockPublic } from '../types/map'
import { LOCK_ANSWER_MAX_LENGTH } from '../lib/pinLock'

interface PlayerLockPadProps {
  pinId: string
  /** O que o jogador sabe da fechadura: forma e casas. A resposta nunca chega aqui. */
  lock: PinLockPublic
  /** Tentativa no ar: "Tentar" fica desligado até o host responder. */
  sending: boolean
  /** Ausente = só mostra a fechadura, sem "Tentar". */
  onTry?: (tentativa: string) => void
}

/** Um volante mostra um dígito: gira de 0 a 9 e dá a volta. */
const VOLANTE_MAX = 9

function girar(valor: number, passo: 1 | -1): number {
  return (valor + passo + VOLANTE_MAX + 1) % (VOLANTE_MAX + 1)
}

/**
 * FECHADURA COM SEGREDO no cartão do pino. Duas formas:
 *
 * - `teclado`: um campo com rótulo "Combinação" e "Tentar" (Enter também tenta);
 * - `volantes`: uma rodinha de 0 a 9 por casa, cada uma com "girar para cima" e
 *   "girar para baixo", e "Tentar" manda os dígitos na ordem.
 *
 * Só manda a tentativa: quem confere é o host, e a resposta dele chega pelo
 * `lockPhase` do cartão. Nada aqui sabe a combinação certa.
 */
export function PlayerLockPad({ pinId, lock, sending, onTry }: PlayerLockPadProps) {
  const [texto, setTexto] = useState('')
  const [volantes, setVolantes] = useState<number[]>(() => Array.from({ length: lock.casas }, () => 0))
  const inputId = `pp-lock-input-${pinId}`
  const tentativa = lock.forma === 'volantes' ? volantes.join('') : texto.trim()
  const podeTentar = onTry !== undefined && !sending && tentativa.length > 0

  const tentar = (event: FormEvent) => {
    event.preventDefault()
    if (podeTentar) onTry(tentativa)
  }

  const girarVolante = (indice: number, passo: 1 | -1) => {
    setVolantes((atual) => atual.map((valor, i) => (i === indice ? girar(valor, passo) : valor)))
  }

  return (
    <form className="pp-lock" onSubmit={tentar} aria-label="Fechadura com segredo">
      {lock.forma === 'teclado' ? (
        <div className="pp-lock__field">
          <label className="pp-lock__label" htmlFor={inputId}>
            Combinação
          </label>
          <input
            id={inputId}
            className="pp-lock__input"
            type="text"
            value={texto}
            maxLength={LOCK_ANSWER_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => setTexto(event.target.value)}
          />
        </div>
      ) : (
        <div className="pp-lock__wheels" role="group" aria-label={`${lock.casas} volantes`}>
          {volantes.map((valor, indice) => (
            <div key={indice} className="pp-lock__wheel">
              <button type="button" className="pp-lock__turn" aria-label={`Girar o volante ${indice + 1} para cima`} onClick={() => girarVolante(indice, 1)}>
                <span aria-hidden="true">▲</span>
              </button>
              <output className="pp-lock__digit" aria-label={`Volante ${indice + 1}`}>
                {valor}
              </output>
              <button type="button" className="pp-lock__turn" aria-label={`Girar o volante ${indice + 1} para baixo`} onClick={() => girarVolante(indice, -1)}>
                <span aria-hidden="true">▼</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {onTry !== undefined && (
        <button type="submit" className="pp-pincard__travel" disabled={!podeTentar}>
          {sending ? 'Conferindo…' : 'Tentar'}
        </button>
      )}
    </form>
  )
}
