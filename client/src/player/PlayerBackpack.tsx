import { useId, useState } from 'react'
import { moedasLabel } from '../lib/troca'
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
  /** MOEDAS E TROCA: a bolsa que dá para pagar (a da ficha dele que mais tem). Ausente = zero. */
  moedas?: number
  /** "Pagar a…" um colega encostado. Ausente = sem o botão. */
  onPay?: (toTokenId: string, moedas: number) => void
}

/**
 * "Comigo": a mochila do jogador, no painel dele. Cada item tem "Dar a…",
 * que abre os colegas encostados; escolher um passa o item (o host confere
 * de novo quem está perto). Sem ninguém perto, a lista diz isso em vez de
 * abrir vazia. A bolsa aparece em cima, com "Pagar a…".
 */
export function PlayerBackpack({ items, colleagues, onGive, moedas = 0, onPay }: PlayerBackpackProps) {
  const headingId = useId()
  const [givingId, setGivingId] = useState<string | null>(null)
  return (
    <section className="pp-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="pp-heading">
        Comigo
      </h2>
      {moedas > 0 && <PurseLine moedas={moedas} colleagues={colleagues} onPay={onPay} />}
      {items.length === 0 ? (
        moedas > 0 ? null : <p className="pp-empty">Nada com você.</p>
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

interface PurseLineProps {
  moedas: number
  colleagues: BackpackColleague[]
  onPay: PlayerBackpackProps['onPay']
}

/**
 * A bolsa e o "Pagar a…": abre um campo de quantas moedas (começa em 1) e um
 * botão por colega encostado. Valor fora de 1..bolsa não oferece colega.
 */
function PurseLine({ moedas, colleagues, onPay }: PurseLineProps) {
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const [valor, setValor] = useState('1')
  const quanto = Number(valor)
  const valido = Number.isInteger(quanto) && quanto >= 1 && quanto <= moedas
  return (
    <div>
      <span className="pp-character__name">Bolsa: {moedasLabel(moedas)}</span>{' '}
      {onPay !== undefined && (
        <button type="button" className="pp-button" aria-expanded={open} onClick={() => setOpen((atual) => !atual)}>
          Pagar a…
        </button>
      )}
      {open && onPay !== undefined && (
        <div className="pp-troca__pagar">
          <label htmlFor={fieldId}>Quantas moedas</label>{' '}
          <input id={fieldId} type="number" inputMode="numeric" min={1} max={moedas} step={1} value={valor} onChange={(event) => setValor(event.target.value)} />
          {!valido ? (
            <p className="pp-empty" role="alert">
              Use um número inteiro de 1 a {moedas}
            </p>
          ) : colleagues.length === 0 ? (
            <p className="pp-empty">Ninguém encostado em você.</p>
          ) : (
            <ul className="pp-list" aria-label="Pagar a">
              {colleagues.map((colleague) => (
                <li key={colleague.tokenId}>
                  <button
                    type="button"
                    className="pp-button"
                    aria-label={`Pagar ${moedasLabel(quanto)} a ${colleague.name}`}
                    onClick={() => {
                      setOpen(false)
                      onPay(colleague.tokenId, quanto)
                    }}
                  >
                    {colleague.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
