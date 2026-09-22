import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { GatherCandidate } from '../lib/gatherParty'

export interface GatherControlsProps {
  /** Quem tem ficha em alguma cena: um por linha, todos marcados ao abrir. */
  candidates: GatherCandidate[]
  /** "Reunir" confirmado com os marcados. Quem aplica e avisa o que não deu é o App. */
  onGather(playerIds: string[]): void
}

/** O rótulo do botão que abre a lista: é por ele que o teste e o leitor de tela acham a ação. */
export const GATHER_LABEL = 'Reunir o grupo aqui'

/**
 * "REUNIR O GRUPO AQUI" (G5), no painel do pino: o botão abre, ali mesmo, a
 * lista de quem vem — uma caixa de marcar por jogador, TODAS marcadas, porque
 * o caso comum é juntar todo mundo e o mestre só desmarca a exceção. "Reunir"
 * confirma (Enter também, é um `<form>`), "Cancelar" e Esc fecham sem mexer
 * em nada.
 *
 * Guarda os DESMARCADOS, não os marcados: jogador que entra com a lista
 * aberta aparece já marcado, como os outros.
 */
export function GatherControls({ candidates, onGather }: GatherControlsProps) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set())
  const openButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const chosen = candidates.filter((c) => !unchecked.has(c.playerId)).map((c) => c.playerId)
  const hintId = `${baseId}-hint`

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setUnchecked(new Set())
    // O foco volta a quem abriu: o teclado não cai no começo da página.
    openButtonRef.current?.focus()
  }

  const toggle = (playerId: string, checked: boolean) => {
    setUnchecked((current) => {
      const next = new Set(current)
      if (checked) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (chosen.length === 0) return
    onGather(chosen)
    close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem reunir; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        className="lb-btn lb-btn--block"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-form` : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {GATHER_LABEL}
      </button>
      {open && (
        <form id={`${baseId}-form`} className="lb-party__send" aria-label="Quem vem para o pino" onSubmit={submit} onKeyDown={onKeyDown}>
          <span className="lb-label">Quem vem para cá</span>
          {candidates.length === 0 ? (
            <span className="lb-label" id={hintId}>
              Nenhum jogador tem ficha. Atribua as fichas na aba Jogo.
            </span>
          ) : (
            <ul className="lb-gather__list">
              {candidates.map((candidate) => (
                <li key={candidate.playerId}>
                  <label className="lb-gather__item">
                    <input
                      type="checkbox"
                      className="lb-gather__check"
                      checked={!unchecked.has(candidate.playerId)}
                      onChange={(event) => toggle(candidate.playerId, event.target.checked)}
                    />
                    <span className="lb-party__dot" style={{ background: candidate.color }} aria-hidden="true" />
                    <span className="lb-party__name">{candidate.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {candidates.length > 0 && chosen.length === 0 && (
            <span className="lb-label" id={hintId}>
              Marque ao menos um jogador.
            </span>
          )}
          <div className="lb-party__actions">
            <button type="button" className="lb-btn lb-btn--ghost" onClick={close}>
              Cancelar
            </button>
            <button
              ref={confirmRef}
              type="submit"
              className="lb-btn lb-btn--primary"
              disabled={chosen.length === 0}
              aria-describedby={chosen.length === 0 ? hintId : undefined}
            >
              Reunir
            </button>
          </div>
        </form>
      )}
    </>
  )
}
