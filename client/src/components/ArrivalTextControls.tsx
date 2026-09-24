import { useEffect, useId, useState } from 'react'
import { ARRIVAL_TEXT_MAX_LENGTH } from '../lib/arrivalText'

export interface ArrivalTextControlsProps {
  /** O texto de chegada da cena aberta; `''` = sem texto. */
  text: string
  /** Recebe o texto como o mestre deixou; `''` tira o texto da cena. */
  onChange: (next: string) => void
}

/**
 * "Texto de chegada" da janela Configurações do mapa: o que quem CHEGA à cena
 * aberta (viagem, escada, "Mandar para…") lê uma vez, num cartão só dele. O
 * texto só vale ao sair do campo — cada letra não vira um passo do desfazer —
 * e Escape desiste do rascunho.
 */
export function ArrivalTextControls({ text, onChange }: ArrivalTextControlsProps) {
  const fieldId = useId()
  const hintId = useId()
  const [draft, setDraft] = useState(text)
  // Desfazer, ou outra cena aberta com a janela aberta: o campo acompanha.
  useEffect(() => setDraft(text), [text])

  const commit = () => {
    if (draft.trim() !== text.trim()) onChange(draft)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Chegada na cena</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor={fieldId}>
          Texto de chegada
        </label>
        <textarea
          id={fieldId}
          className="lb-input"
          rows={3}
          value={draft}
          maxLength={ARRIVAL_TEXT_MAX_LENGTH}
          placeholder="Ex.: O ar cheira a enxofre."
          aria-describedby={hintId}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            // O Escape é do campo: desiste do rascunho sem fechar a janela.
            event.preventDefault()
            event.stopPropagation()
            setDraft(text)
          }}
        />
        <p id={hintId} className="lb-field__hint">
          Quem chegar a esta cena (viagem, escada, Mandar para…) lê uma vez, num cartão só dele. Vazio é sem texto.
        </p>
      </div>
    </section>
  )
}
