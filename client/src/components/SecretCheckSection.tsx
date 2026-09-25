import { useId, useRef, useState, type FormEvent } from 'react'
import { SECRET_CHECK_LABEL_MAX_LENGTH } from '../net/protocol'
import type { SecretCheckState } from '../net/hostSession'

export interface SecretCheckPlayer {
  playerId: string
  name: string
  /** Tem ficha em jogo: só quem joga pode receber o pedido (quem aguarda não tem onde responder). */
  playing: boolean
}

export interface SecretCheckSectionProps {
  /** Todos da sala: dá nome às respostas, e quem joga vira caixa de marcar. */
  players: readonly SecretCheckPlayer[]
  /** Os testes, do mais antigo ao mais novo (`HostSession.secretChecks`). */
  checks: readonly SecretCheckState[]
  /** Pede o teste. Devolve quantos foram pedidos, ou `null` com a sala fechada. */
  onAsk(label: string, playerIds: string[]): number | null
  onClose(checkId: string): void
}

/** O que falta para pedir, dito junto ao campo com problema. */
export const SECRET_CHECK_ERRORS: Readonly<{ label: string; who: string }> = {
  label: 'Escreva o nome do teste.',
  who: 'Marque quem faz o teste.',
}

/** O aviso depois de "Pedir teste": para quantos foi, ou por que não foi. */
export function secretCheckFeedbackText(asked: number | null): string {
  if (asked === null) return 'Não deu: a sala não está aberta.'
  if (asked === 0) return 'Ninguém escolhido está jogando agora.'
  return asked === 1 ? 'Teste pedido a 1 jogador' : `Teste pedido a ${asked} jogadores`
}

/** "Ana: 17" ou "Bruno: aguardando" / "sem resposta" (encerrado sem ele responder). */
function answerLine(name: string, result: number | undefined, open: boolean): string {
  if (result !== undefined) return `${name}: ${result}`
  return `${name}: ${open ? 'aguardando' : 'sem resposta'}`
}

/**
 * "Teste secreto", na aba Jogo: o mestre escreve o teste, marca quem faz e
 * pede. Só os marcados recebem o pedido; as respostas aparecem só aqui (e num
 * aviso na hora), uma linha por jogador. O mais novo fica em cima. Pedir sem
 * nome ou sem ninguém marcado diz o que falta junto ao campo e leva o foco ao
 * primeiro erro; o erro some assim que o campo fica certo.
 */
export function SecretCheckSection({ players, checks, onAsk, onClose }: SecretCheckSectionProps) {
  const headingId = useId()
  const labelId = useId()
  const labelErrorId = useId()
  const whoErrorId = useId()
  const baseId = useId()
  const labelRef = useRef<HTMLInputElement>(null)
  const whoRef = useRef<HTMLFieldSetElement>(null)
  const [label, setLabel] = useState('')
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [feedback, setFeedback] = useState<string | null>(null)
  // Só depois de uma tentativa: o erro não aparece antes de o mestre pedir.
  const [tried, setTried] = useState(false)
  const playing = players.filter((player) => player.playing)
  // Quem saiu de jogo continua marcado no estado, mas não conta nem vai no pedido.
  const chosenIds = playing.filter((player) => chosen.has(player.playerId)).map((player) => player.playerId)
  const labelMissing = label.trim().length === 0
  const whoMissing = chosenIds.length === 0
  const showLabelError = tried && labelMissing
  const showWhoError = tried && whoMissing
  const nameOf = (playerId: string): string => players.find((player) => player.playerId === playerId)?.name ?? 'Jogador que saiu'

  const toggle = (playerId: string) => {
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const ask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (labelMissing || whoMissing) {
      setTried(true)
      setFeedback(null)
      if (labelMissing) labelRef.current?.focus()
      else whoRef.current?.querySelector('input')?.focus()
      return
    }
    const asked = onAsk(label.trim(), chosenIds)
    setFeedback(secretCheckFeedbackText(asked))
    // O nome sai do campo: um segundo clique não repete o teste sem querer.
    // A escolha fica: o mesmo grupo costuma fazer o teste seguinte.
    if (asked !== null && asked > 0) {
      setLabel('')
      setTried(false)
    }
  }

  return (
    <section className="lb-secret-check" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Teste secreto
      </h3>
      <form className="lb-secret-check__form" onSubmit={ask} noValidate>
        <label className="lb-label" htmlFor={labelId}>
          Teste
        </label>
        <input
          ref={labelRef}
          id={labelId}
          className="lb-input"
          type="text"
          placeholder="Percepção"
          maxLength={SECRET_CHECK_LABEL_MAX_LENGTH}
          value={label}
          aria-invalid={showLabelError ? true : undefined}
          aria-describedby={showLabelError ? labelErrorId : undefined}
          onChange={(event) => setLabel(event.target.value)}
        />
        {showLabelError && (
          <p id={labelErrorId} className="lb-secret-check__error" role="alert">
            {SECRET_CHECK_ERRORS.label}
          </p>
        )}
        <fieldset ref={whoRef} className="lb-secret-check__who" aria-describedby={showWhoError ? whoErrorId : undefined}>
          <legend className="lb-label">Para quem</legend>
          {playing.length === 0 ? (
            <p className="lb-label">Ninguém jogando agora.</p>
          ) : (
            playing.map((player) => {
              const id = `${baseId}-${player.playerId}`
              return (
                <div key={player.playerId} className="lb-secret-check__option">
                  <input id={id} type="checkbox" checked={chosen.has(player.playerId)} onChange={() => toggle(player.playerId)} />
                  <label htmlFor={id}>{player.name}</label>
                </div>
              )
            })
          )}
        </fieldset>
        {showWhoError && (
          <p id={whoErrorId} className="lb-secret-check__error" role="alert">
            {SECRET_CHECK_ERRORS.who}
          </p>
        )}
        <button type="submit" className="lb-btn lb-btn--primary lb-btn--block">
          Pedir teste
        </button>
      </form>
      {feedback !== null && (
        <p className="lb-label" role="status">
          {feedback}
        </p>
      )}
      {checks.length > 0 && (
        <ul className="lb-secret-check__list">
          {[...checks].reverse().map((check) => {
            const pending = check.asked.some((playerId) => check.answers[playerId] === undefined)
            return (
              <li key={check.id} className="lb-secret-check__item">
                <strong className="lb-secret-check__label">{check.label}</strong>
                <ul className="lb-secret-check__answers">
                  {check.asked.map((playerId) => (
                    <li key={playerId}>{answerLine(nameOf(playerId), check.answers[playerId], check.open)}</li>
                  ))}
                </ul>
                {check.open && pending && (
                  <button type="button" className="lb-btn lb-btn--ghost" aria-label={`Encerrar ${check.label}`} onClick={() => onClose(check.id)}>
                    Encerrar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
