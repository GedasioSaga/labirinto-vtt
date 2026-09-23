import { useId, useState } from 'react'
import type { CarriedItem } from '../types/map'

/** Um colega a quem dar: a ficha dele encostada numa das do jogador. */
export interface BackpackColleague {
  tokenId: string
  name: string
}

interface PlayerBackpackProps {
  /** O que as fichas do jogador carregam. */
  items: CarriedItem[]
  /** Fichas de colegas encostadas agora — as únicas a quem dá para passar um item. */
  colleagues: BackpackColleague[]
  onGive: (itemId: string, toTokenId: string) => void
}

/**
 * "Comigo": a mochila do jogador, no painel dele. Cada item tem "Dar a…",
 * que abre os colegas encostados; escolher um passa o item (o host confere
 * de novo quem está perto). Sem ninguém perto, a lista diz isso em vez de
 * abrir vazia.
 */
export function PlayerBackpack({ items, colleagues, onGive }: PlayerBackpackProps) {
  const headingId = useId()
  const [givingId, setGivingId] = useState<string | null>(null)
  return (
    <section className="pp-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="pp-heading">
        Comigo
      </h2>
      {items.length === 0 ? (
        <p className="pp-empty">Nada com você.</p>
      ) : (
        <ul className="pp-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="pp-character__name">{item.nome}</span>{' '}
              <button
                type="button"
                className="pp-button"
                aria-label={`Dar ${item.nome} a…`}
                aria-expanded={givingId === item.id}
                onClick={() => setGivingId((current) => (current === item.id ? null : item.id))}
              >
                Dar a…
              </button>
              {givingId === item.id &&
                (colleagues.length === 0 ? (
                  <p className="pp-empty">Ninguém encostado em você.</p>
                ) : (
                  <ul className="pp-list" aria-label={`Dar ${item.nome} a`}>
                    {colleagues.map((colleague) => (
                      <li key={colleague.tokenId}>
                        <button
                          type="button"
                          className="pp-button"
                          onClick={() => {
                            setGivingId(null)
                            onGive(item.id, colleague.tokenId)
                          }}
                        >
                          {colleague.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
