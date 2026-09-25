import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { gatherGroups, type GatherCandidate } from '../lib/gatherParty'

export interface GatherControlsProps {
  /** Quem tem ficha em alguma cena: um por linha, agrupados por cena ao abrir. */
  candidates: GatherCandidate[]
  /** "Reunir" confirmado com os marcados. Quem aplica e avisa o que não deu é o App. */
  onGather(playerIds: string[]): void
}

/** O rótulo do botão que abre a lista: é por ele que o teste e o leitor de tela acham a ação. */
export const GATHER_LABEL = 'Reunir o grupo aqui'

/**
 * "REUNIR O GRUPO AQUI" (G5), no painel do pino: o botão abre, ali mesmo, a
 * lista de quem vem, AGRUPADA POR CENA — "PC - Cais (3)", "Sobrado (3)" —,
 * cada grupo com uma caixa que marca ou desmarca todos dele num clique. Quem
 * está longe vem marcado (o caso comum é trazer esse pessoal); quem já está em
 * volta do pino fica no grupo "Já aqui", por último e desmarcado. "Reunir"
 * confirma (Enter também, é um `<form>`), "Cancelar" e Esc fecham sem mexer
 * em nada.
 *
 * Guarda só o que o mestre MUDOU à mão, não os marcados: jogador que entra
 * com a lista aberta aparece com o padrão do lugar onde está, como os outros.
 */
export function GatherControls({ candidates, onGather }: GatherControlsProps) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const [changed, setChanged] = useState<ReadonlyMap<string, boolean>>(new Map())
  const openButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const groups = gatherGroups(candidates)
  const isChecked = (candidate: GatherCandidate): boolean => changed.get(candidate.playerId) ?? !candidate.alreadyHere
  // Na ordem da lista: quem vem de longe senta primeiro, nas casas mais perto do pino.
  const chosen = groups.flatMap((group) => group.candidates.filter(isChecked).map((c) => c.playerId))
  const hintId = `${baseId}-hint`

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setChanged(new Map())
    // O foco volta a quem abriu: o teclado não cai no começo da página.
    openButtonRef.current?.focus()
  }

  const mark = (playerIds: readonly string[], checked: boolean) => {
    setChanged((current) => {
      const next = new Map(current)
      for (const playerId of playerIds) next.set(playerId, checked)
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
              {groups.map((group) => {
                const marked = group.candidates.filter(isChecked).length
                return (
                  <li key={group.key} className="lb-gather__group">
                    <GroupCheckbox
                      label={group.label}
                      checked={marked === group.candidates.length}
                      mixed={marked > 0 && marked < group.candidates.length}
                      onChange={(checked) => mark(group.candidates.map((c) => c.playerId), checked)}
                    />
                    <ul className="lb-gather__list lb-gather__list--members" aria-label={group.label}>
                      {group.candidates.map((candidate) => (
                        <li key={candidate.playerId}>
                          <label className="lb-gather__item">
                            <input
                              type="checkbox"
                              className="lb-gather__check"
                              checked={isChecked(candidate)}
                              onChange={(event) => mark([candidate.playerId], event.target.checked)}
                            />
                            <span className="lb-party__dot" style={{ background: candidate.color }} aria-hidden="true" />
                            <span className="lb-party__name">{candidate.name}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
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

interface GroupCheckboxProps {
  label: string
  checked: boolean
  /** Parte do grupo marcada: a caixa mostra o traço de "misto" (o leitor de tela lê "parcialmente marcada"). */
  mixed: boolean
  onChange(checked: boolean): void
}

/** A caixa de um grupo inteiro. `indeterminate` só existe como propriedade do DOM, não como atributo: vai por ref. */
function GroupCheckbox({ label, checked, mixed, onChange }: GroupCheckboxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current !== null) inputRef.current.indeterminate = mixed
  }, [mixed])

  return (
    <label className="lb-gather__item">
      <input ref={inputRef} type="checkbox" className="lb-gather__check" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="lb-gather__scene">{label}</span>
    </label>
  )
}
