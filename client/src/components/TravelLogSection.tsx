import { useId, useRef, useState } from 'react'
import { travelClock, travelLine, undoableTravelIds, type TravelLogEntry } from '../lib/travelLog'

export interface TravelLogSectionProps {
  /** A mais nova em cima (como a ponte entrega). */
  entries: TravelLogEntry[]
  /** "Desfazer" da última viagem de um jogador. `false` = não deu, e a linha mostra o aviso. */
  onUndo(entryId: string): boolean
}

export const TRAVEL_LOG_TITLE = 'Diário de viagens'
export const TRAVEL_LOG_EMPTY = 'Nenhuma viagem ainda.'
export const TRAVEL_UNDO_FAILED = 'Não deu para desfazer: a ficha ou a cena mudou desde a viagem. Use "Mandar para…" no Grupo.'

/**
 * DIÁRIO DE VIAGENS (G15), na aba Jogo, logo abaixo do Grupo: quem foi para
 * onde e quando, uma linha por viagem, a mais nova em cima. "Desfazer" só na
 * última viagem de cada jogador — desfazer uma do meio deixaria a ficha numa
 * cena de onde ela já saiu. Só o mestre vê: nada disto vai ao jogador.
 */
export function TravelLogSection({ entries, onUndo }: TravelLogSectionProps) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const undoable = undoableTravelIds(entries)

  const undo = (entryId: string) => {
    if (!onUndo(entryId)) {
      setFailedId(entryId)
      return
    }
    setFailedId(null)
    // A linha desfeita sai com o botão que tinha o foco: o teclado volta ao título do diário, não ao topo da página.
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  return (
    <section className="lb-party lb-travel-log" aria-labelledby={headingId}>
      <h3 id={headingId} ref={headingRef} className="lb-eyebrow" tabIndex={-1}>
        {TRAVEL_LOG_TITLE}
      </h3>
      {entries.length === 0 ? (
        <p className="lb-label">{TRAVEL_LOG_EMPTY}</p>
      ) : (
        <ul className="lb-party__list">
          {entries.map((entry) => (
            <li key={entry.id} className="lb-travel-log__item">
              <div className="lb-travel-log__row">
                {/* O espaço é do texto: sem ele o leitor de tela e a cópia leem "22:10Ana". */}
                <span className="lb-travel-log__line">
                  <time className="lb-travel-log__time" dateTime={new Date(entry.at).toISOString()}>
                    {travelClock(entry.at)}
                  </time>{' '}
                  {travelLine(entry)}
                </span>
                {undoable.has(entry.id) && (
                  <button
                    type="button"
                    className="lb-btn lb-btn--ghost"
                    aria-label={`Desfazer a viagem de ${entry.tokenName}: ${entry.fromSceneName} → ${entry.toSceneName}`}
                    onClick={() => undo(entry.id)}
                  >
                    Desfazer
                  </button>
                )}
              </div>
              {failedId === entry.id && (
                <p className="lb-room__error" role="alert">
                  {TRAVEL_UNDO_FAILED}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
