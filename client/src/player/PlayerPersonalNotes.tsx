import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PERSONAL_NOTE_MAX_LENGTH, cleanNoteText, groupNotesByMap, type PersonalNote } from './personalNotes'

export interface PersonalNoteDraftProps {
  /** Texto já limpo (uma linha, até 40), nunca vazio. */
  onSave(text: string): void
  onCancel(): void
}

/**
 * O cartão que pede o texto da anotação, logo depois do toque no mapa. Abre
 * com o foco no campo (quem tocou para anotar vai digitar); Enter salva,
 * Escape e "Cancelar" desistem. Vazio não salva: o campo fica marcado e diz o
 * que falta.
 */
export function PersonalNoteDraft({ onSave, onCancel }: PersonalNoteDraftProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const titleId = useId()
  const fieldId = useId()
  const hintId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // Escape desiste mesmo com o foco no campo: o campo é do próprio cartão.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = cleanNoteText(text)
    if (clean === '') {
      setError(true)
      inputRef.current?.focus({ preventScroll: true })
      return
    }
    onSave(clean)
  }

  const remaining = PERSONAL_NOTE_MAX_LENGTH - text.length

  return (
    <section className="pp-note pp-note-draft" aria-labelledby={titleId}>
      <h2 id={titleId} className="pp-note__title">
        Nova anotação
      </h2>
      <form className="pp-field" onSubmit={submit} noValidate>
        <label className="pp-label" htmlFor={fieldId}>
          O que anotar
        </label>
        <input
          ref={inputRef}
          id={fieldId}
          className="pp-input"
          type="text"
          value={text}
          maxLength={PERSONAL_NOTE_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          onChange={(event) => {
            setText(event.target.value)
            // O erro some assim que o valor fica válido.
            if (error && cleanNoteText(event.target.value) !== '') setError(false)
          }}
        />
        {error && (
          <p id={errorId} className="pp-error" role="alert">
            Escreva a anotação.
          </p>
        )}
        <p id={hintId} className="pp-note__hint">
          <span aria-live="polite">Faltam {remaining}</span> · Só você vê. Fica guardada neste aparelho.
        </p>
        <div className="pp-note-draft__actions">
          <button type="submit" className="pp-button">
            Salvar
          </button>
          <button type="button" className="pp-button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}

export interface PersonalNoteListProps {
  /** MINHAS NOTAS de TODOS os mapas, da mais antiga à mais nova. */
  notes: readonly PersonalNote[]
  /** O mapa da tela agora: só das notas dele a câmera vai até o ponto. */
  currentMapId?: string
  /** Como o jogador chama o lugar de outro mapa (o nome que ELE deu na aba Lugares, ou "Outro lugar"). */
  placeLabelOf(mapId: string): string
  onFocus(id: string): void
  onRemove(id: string): void
}

/**
 * MINHAS NOTAS no Caderno, por mapa: as deste lugar primeiro (tocar numa leva
 * a câmera até ela), depois as de cada outro mapa por onde ele passou, com o
 * nome que ele deu ao lugar — o caderno é do jogador, não da cena. "Apagar" é
 * o mesmo que o toque longo na nota, para quem usa teclado. O texto entra
 * como filho de texto do React: HTML digitado aparece literal.
 */
export function PersonalNoteList({ notes, currentMapId, placeLabelOf, onFocus, onRemove }: PersonalNoteListProps) {
  if (notes.length === 0) {
    return <p className="pp-empty">Nenhuma nota ainda. Em Marcações, toque em Anotar e depois no mapa; só você vê.</p>
  }
  return (
    <div className="pp-personal-notes__groups">
      {groupNotesByMap(notes, currentMapId).map((group) => {
        const title = group.here ? 'Neste lugar' : placeLabelOf(group.mapId)
        return (
          <section key={group.mapId} className="pp-personal-notes__group" aria-label={`Notas: ${title}`}>
            <h3 className="pp-subheading">{title}</h3>
            <ul className="pp-list pp-personal-notes">
              {group.notes.map((note) => (
                <li key={note.id} className="pp-personal-notes__item">
                  {group.here ? (
                    <button type="button" className="pp-character" aria-label={`Centralizar em ${note.text}`} onClick={() => onFocus(note.id)}>
                      <span className="pp-personal-notes__mark" aria-hidden="true" />
                      <span className="pp-character__name">{note.text}</span>
                    </button>
                  ) : (
                    <span className="pp-character pp-personal-notes__away">
                      <span className="pp-personal-notes__mark" aria-hidden="true" />
                      <span className="pp-character__name">{note.text}</span>
                    </span>
                  )}
                  <button type="button" className="pp-personal-notes__remove" aria-label={`Apagar nota ${note.text}`} onClick={() => onRemove(note.id)}>
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
