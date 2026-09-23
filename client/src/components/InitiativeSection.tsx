import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { initiativeOrder, parseInitiativeInput, type InitiativeToken } from '../lib/initiative'
import { NEXT_TURN_SHORTCUT } from '../lib/keymap'

export interface InitiativeSectionProps {
  /** Fichas da cena aberta, secretas inclusive (o mestre as vê; o jogador não recebe nada delas). */
  tokens: InitiativeToken[]
  /** Valor de cada ficha nesta cena. Sem entrada = fora da ordem. */
  values: Readonly<Record<string, number>>
  /** A ficha da vez NESTA cena; `null` = ordem ainda não começada (ou a vez está em outra cena). */
  turnTokenId: string | null
  onValueChange(tokenId: string, value: number | null): void
  onStart(): void
  onNext(): void
  onStop(): void
}

export const INITIATIVE_EMPTY_HINT = 'Dê um valor a uma ficha para ela entrar na ordem.'
export const INITIATIVE_NO_TOKENS = 'Nenhuma ficha nesta cena.'
export const INITIATIVE_INVALID = 'Use um número (ou apague para tirar da ordem).'

interface FieldProps {
  token: InitiativeToken
  value: number | undefined
  onCommit(tokenId: string, value: number | null): void
}

/**
 * Um campo por ficha. O valor vale ao SAIR do campo (Tab, clique fora) ou no
 * Enter — reordenar a cada tecla faria a lista pular enquanto o mestre digita
 * "17" (o "1" jogaria a ficha para o fim). Lixo não sai: o texto fica, o aviso
 * aparece junto do campo, e some quando o valor fica bom.
 */
function InitiativeField({ token, value, onCommit }: FieldProps) {
  const inputId = useId()
  const errorId = useId()
  const committed = value === undefined ? '' : String(value)
  const [draft, setDraft] = useState(committed)
  const [invalid, setInvalid] = useState(false)

  // O valor mudou por fora (outra aba, desfazer do campo vizinho): o campo acompanha.
  useEffect(() => {
    setDraft(committed)
    setInvalid(false)
  }, [committed])

  const commit = () => {
    const parsed = parseInitiativeInput(draft)
    if (!parsed.ok) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    const unchanged = parsed.value === null ? value === undefined : parsed.value === value
    if (!unchanged) onCommit(token.id, parsed.value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit()
  }

  return (
    <div className="lb-initiative__field">
      <label className="lb-initiative__token" htmlFor={inputId}>
        {token.name}
      </label>
      <input
        id={inputId}
        className="lb-input lb-initiative__input"
        type="number"
        inputMode="numeric"
        step="any"
        aria-label={`Iniciativa de ${token.name}`}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          if (invalid && parseInitiativeInput(event.target.value).ok) setInvalid(false)
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {invalid && (
        <p id={errorId} className="lb-room__error lb-initiative__error" role="alert">
          {INITIATIVE_INVALID}
        </p>
      )}
    </div>
  )
}

/**
 * INICIATIVA, na aba Jogo: o mestre dá o valor de cada ficha da cena e a
 * ordem aparece do maior para o menor. "Começar" põe a vez no primeiro;
 * "Próxima vez" (ou Shift+N com o foco no mapa) passa adiante e, do último,
 * volta ao primeiro. A entrada da vez é marcada com `aria-current`.
 */
export function InitiativeSection({ tokens, values, turnTokenId, onValueChange, onStart, onNext, onStop }: InitiativeSectionProps) {
  const headingId = useId()
  const order = initiativeOrder(tokens, values)
  const started = turnTokenId !== null && order.some((entry) => entry.id === turnTokenId)

  return (
    <section className="lb-initiative" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Iniciativa
      </h3>
      {tokens.length === 0 ? (
        <p className="lb-label">{INITIATIVE_NO_TOKENS}</p>
      ) : (
        <>
          <div className="lb-initiative__fields">
            {tokens.map((token) => (
              <InitiativeField key={token.id} token={token} value={values[token.id]} onCommit={onValueChange} />
            ))}
          </div>
          {order.length === 0 ? (
            <p className="lb-label">{INITIATIVE_EMPTY_HINT}</p>
          ) : (
            <ol className="lb-initiative__order" aria-label="Ordem de iniciativa">
              {order.map((entry) => {
                const current = started && entry.id === turnTokenId
                return (
                  <li key={entry.id} className={current ? 'lb-initiative__entry is-current' : 'lb-initiative__entry'} aria-current={current ? 'true' : undefined}>
                    <span className="lb-initiative__name">{entry.name}</span>
                    <span className="lb-num">{entry.value}</span>
                  </li>
                )
              })}
            </ol>
          )}
          {order.length > 0 && (
            <div className="lb-initiative__actions">
              {started ? (
                <>
                  <button type="button" className="lb-btn lb-btn--primary" aria-keyshortcuts={NEXT_TURN_SHORTCUT} title={`Próxima vez (${NEXT_TURN_SHORTCUT})`} onClick={onNext}>
                    Próxima vez
                  </button>
                  <button type="button" className="lb-btn lb-btn--ghost" onClick={onStop}>
                    Encerrar
                  </button>
                </>
              ) : (
                <button type="button" className="lb-btn lb-btn--primary" onClick={onStart}>
                  Começar
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
