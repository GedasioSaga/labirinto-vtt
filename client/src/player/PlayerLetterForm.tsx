import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { LETTER_TEXT_MAX_LENGTH, LETTER_VIAS, letterViaName, letterViaPhrase, type LetterVia } from '../lib/correio'
import type { LetterPeers, LetterSend } from './playerConnection'

export interface PlayerLetterFormProps {
  /** A lista de colegas pedida ao host; ausente = ainda não pediu. */
  peers: LetterPeers | undefined
  /** O último bilhete mandado e a resposta do host. */
  status: LetterSend | undefined
  /** "Escrever bilhete": pede ao host a quem escrever. */
  onAskPeers(): void
  /** Manda o bilhete (já aparado). `false` = não saiu (conexão caída). */
  onSend(to: string, via: LetterVia, text: string): boolean
}

/** O meio que já vem marcado: o pombo é o correio que todo mundo reconhece. */
const DEFAULT_VIA: LetterVia = 'pombo'

/** Recusas do host, na língua de quem joga. `ok` e `sending` não são erro. */
const REFUSAL_TEXT: Record<'failed' | 'too_soon' | 'full', string> = {
  failed: 'O bilhete não saiu. Confira o nome e tente de novo.',
  too_soon: 'Espere um instante e mande de novo.',
  full: 'O mestre ainda não respondeu aos seus bilhetes. Espere um pouco.',
}

/**
 * CORREIO DE BILHETES no Painel: o jogador escolhe o colega (pelo nome na
 * sala, nunca a cena), o meio e escreve. O bilhete vai ao MESTRE, que entrega
 * ou intercepta — a confirmação diz isso, e nunca conta o que ele decidiu.
 *
 * Campo e seleção são nativos (`select`, `radio`, `textarea`): teclado,
 * inicial que salta para a opção e leitor de tela vêm de graça. O rascunho
 * fica aqui até sair: recusa ou conexão caída nunca apagam o texto.
 */
export function PlayerLetterForm({ peers, status, onAskPeers, onSend }: PlayerLetterFormProps) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [via, setVia] = useState<LetterVia>(DEFAULT_VIA)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  /** Mandou por este formulário: só então a resposta do host aparece aqui (e o `ok` limpa o texto). */
  const [sentHere, setSentHere] = useState(false)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const openRef = useRef<HTMLButtonElement | null>(null)
  const toId = useId()
  const textId = useId()
  const countId = useId()
  const errorId = useId()

  const names = peers?.phase === 'ready' ? peers.names : []
  // O escolhido que saiu da sala (ou nada escolhido ainda) cai no primeiro da lista.
  const chosen = names.includes(to) ? to : (names[0] ?? '')
  const phase = sentHere ? status?.phase : undefined
  const sending = phase === 'sending'
  const canSend = chosen !== '' && !sending

  useEffect(() => {
    if (phase === 'ok') setText('')
  }, [phase])

  function openForm() {
    setOpen(true)
    setError(null)
    onAskPeers()
  }

  function closeForm() {
    setOpen(false)
    setSentHere(false)
    setError(null)
    // O botão que abriu volta a existir: o foco não pode sumir com o formulário.
    requestAnimationFrame(() => openRef.current?.focus())
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend) return
    const limpo = text.trim()
    if (limpo === '') {
      setError('Escreva o bilhete antes de mandar.')
      textRef.current?.focus()
      return
    }
    if (!onSend(chosen, via, limpo)) {
      setError('Sem conexão com o mestre. Tente de novo.')
      return
    }
    setError(null)
    setSentHere(true)
  }

  if (!open) {
    return (
      <button ref={openRef} type="button" className="pp-button" onClick={openForm}>
        Escrever bilhete
      </button>
    )
  }

  const refusal = phase === 'failed' || phase === 'too_soon' || phase === 'full' ? REFUSAL_TEXT[phase] : null
  const shownError = error ?? refusal
  const left = LETTER_TEXT_MAX_LENGTH - text.length

  return (
    <form className="pp-letter" aria-label="Bilhete" onSubmit={submit} noValidate>
      <div className="pp-field">
        <label className="pp-label" htmlFor={toId}>
          Para
        </label>
        {peers?.phase === 'ready' && names.length === 0 ? (
          <p className="pp-empty">Ninguém mais na sala para receber.</p>
        ) : (
          <select id={toId} className="pp-input" value={chosen} disabled={peers?.phase !== 'ready'} onChange={(event) => setTo(event.target.value)}>
            {peers?.phase !== 'ready' ? (
              <option value="">Procurando quem está na sala…</option>
            ) : (
              names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      <fieldset className="pp-letter__via">
        <legend className="pp-label">Por</legend>
        {LETTER_VIAS.map((option) => (
          <label key={option} className="pp-check">
            <input type="radio" name={`${toId}-via`} value={option} checked={via === option} onChange={() => setVia(option)} />
            <span>{letterViaName(option)}</span>
          </label>
        ))}
      </fieldset>

      <div className="pp-field">
        <label className="pp-label" htmlFor={textId}>
          Bilhete
        </label>
        <textarea
          ref={textRef}
          id={textId}
          className="pp-input pp-letter__text"
          rows={3}
          value={text}
          maxLength={LETTER_TEXT_MAX_LENGTH}
          aria-invalid={error !== null && text.trim() === ''}
          aria-describedby={shownError === null ? countId : `${countId} ${errorId}`}
          onChange={(event) => {
            setText(event.target.value)
            if (error !== null) setError(null)
          }}
        />
        <p id={countId} className="pp-empty">
          Faltam {left} {left === 1 ? 'letra' : 'letras'}
        </p>
      </div>

      {shownError !== null && (
        <p id={errorId} className="pp-error" role="alert">
          {shownError}
        </p>
      )}
      {phase === 'ok' && status !== undefined && (
        <p className="pp-empty" role="status">
          {`Saiu ${letterViaPhrase(status.via)} para ${status.to}. Quem entrega é o mestre.`}
        </p>
      )}

      <div className="pp-letter__actions">
        <button type="submit" className="pp-button" disabled={!canSend}>
          {sending ? 'Mandando…' : 'Mandar'}
        </button>
        <button type="button" className="pp-button" onClick={closeForm}>
          Fechar
        </button>
      </div>
    </form>
  )
}
