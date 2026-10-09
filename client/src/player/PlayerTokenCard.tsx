import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { CarriedItem, Token } from '../types/map'
import { TOKEN_ACTIONS, TOKEN_ACTION_LABELS, TOKEN_ACTION_PROMPTS, TOKEN_ACTION_TEXT_MAX_LENGTH, type TokenAction } from '../lib/tokenActions'
import { ImagemOuIniciais } from '../components/FichaPecas'
import { tokenCardName } from './tokenCard'

/**
 * O que "Entregar item" pode fazer com esta ficha. O host só aceita o
 * `item.give` para a ficha de um COLEGA encostada numa ficha do jogador
 * (NPC é do mestre): a tela diz por quê antes de mandar algo que voltaria
 * recusado.
 */
export type TokenCardGive =
  | { kind: 'ready'; items: readonly CarriedItem[]; onGive: (itemId: string) => void }
  | { kind: 'empty' }
  | { kind: 'far' }
  | { kind: 'npc' }

/** O retrato do PRÓPRIO jogador ao lado das ações: a foto da ficha dele, ou as iniciais do nome. */
export interface TokenCardPortrait {
  name: string
  image: string | null
}

interface PlayerTokenCardProps {
  /** A ficha como o JOGADOR a recebe (recorte do host): o nome é o "Nome para os jogadores". */
  token: Token
  onClose: () => void
  /** Manda o pedido ao mestre. `text` vem aparado e nunca vazio. */
  onSend: (action: TokenAction, text: string) => void
  /** Já há um pedido esperando o mestre: "Falar" e "Ação" ficam desligadas ("Entregar item" não passa pelo mestre). */
  waiting: boolean
  portrait: TokenCardPortrait
  give: TokenCardGive
}

type Chosen = TokenAction | 'entregar'

/** Controles focáveis dentro do cartão, na ordem do DOM: é por eles que o Tab circula. */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled)'

/** Por que não dá para entregar, na voz do jogador. */
function giveBlockedText(give: Exclude<TokenCardGive, { kind: 'ready' }>, name: string): string {
  switch (give.kind) {
    case 'empty':
      return 'Sua mochila está vazia.'
    case 'far':
      return `Chegue perto de ${name} para entregar.`
    case 'npc':
      return `Só dá para entregar a outro jogador. Para oferecer algo a ${name}, use Ação.`
  }
}

/**
 * CARTÃO DA FICHA ALHEIA (NPC ou colega): o retrato do jogador ao lado das três
 * coisas que ele pode fazer com ela. "Falar" e "Ação" (agir com ou contra a
 * ficha: beijar, lutar) pedem o texto e viram pedido na Caixa do mestre;
 * "Entregar item" abre a mochila e o item vai direto, pelo `item.give`. O
 * mesmo lugar e a mesma pintura do cartão do pino (`PlayerPinCard`): encostado
 * à direita, com o mapa à vista, e fecha por Escape, pelo "Fechar" e por
 * tocar fora.
 *
 * O nome vai como TEXTO (o React escapa): é o mestre quem o escreve, e ele
 * chega pela rede.
 */
export function PlayerTokenCard({ token, onClose, onSend, waiting, portrait, give }: PlayerTokenCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const actionsRef = useRef<HTMLDivElement | null>(null)
  const fieldRef = useRef<HTMLInputElement | null>(null)
  const firstItemRef = useRef<HTMLButtonElement | null>(null)
  const backRef = useRef<HTMLButtonElement | null>(null)
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [text, setText] = useState('')
  const fieldId = useId()
  const name = tokenCardName(token)

  useEffect(() => {
    // Foco dentro do cartão ao abrir e a cada troca de vista: quem chegou pelo teclado segue daqui.
    if (chosen === 'entregar') (firstItemRef.current ?? backRef.current)?.focus()
    else if (chosen !== null) fieldRef.current?.focus()
    // Esperando o mestre, Falar e Ação estão desligadas: o foco vai ao primeiro que responde.
    else actionsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [chosen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      // Tab não sai do cartão: do último controle volta ao primeiro, e ao contrário.
      const card = cardRef.current
      if (card === null) return
      const controls = [...card.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (first === undefined || last === undefined) return
      const inside = document.activeElement instanceof Node && card.contains(document.activeElement)
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    // Tocar fora fecha. No mapa, o toque só fecha: não arrasta o mapa nem abre outra ficha.
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && cardRef.current?.contains(alvo)) return
      onClose()
      if (alvo instanceof HTMLCanvasElement) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  const said = text.trim()
  const asking = chosen === 'falar' || chosen === 'acao' ? chosen : null
  const canSend = asking !== null && !waiting && said !== ''
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (asking === null || !canSend) return
    onSend(asking, said)
  }
  const back = () => {
    setChosen(null)
    setText('')
  }

  return (
    <div className="pp-pincard__backdrop">
      <div ref={cardRef} className="pp-pincard pp-tokencard" role="dialog" aria-modal="true" aria-label={`Ficha: ${name}`}>
        <p className="pp-tokencard__name">{name}</p>
        <div className="pp-tokencard__body">
          <figure className="pp-tokencard__me">
            <span className="pp-tokencard__face">
              <ImagemOuIniciais imagem={portrait.image} nome={portrait.name} />
            </span>
            <figcaption className="pp-tokencard__me-name">{portrait.name}</figcaption>
          </figure>
          <div className="pp-tokencard__main">
            {waiting && asking === null && chosen !== 'entregar' && (
              <p className="pp-pincard__locked">Você já tem um pedido esperando o mestre. Entregar item continua valendo.</p>
            )}
            {chosen === null && (
              <div ref={actionsRef} className="pp-tokencard__actions" role="group" aria-label="O que você faz">
                {TOKEN_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="pp-pincard__travel"
                    disabled={waiting}
                    onClick={() => setChosen(action)}
                  >
                    {TOKEN_ACTION_LABELS[action]}
                  </button>
                ))}
                <button type="button" className="pp-pincard__travel" onClick={() => setChosen('entregar')}>
                  Entregar item
                </button>
              </div>
            )}
            {asking !== null && (
              <form className="pp-pincard__confirm" onSubmit={submit}>
                <label className="pp-pincard__question" htmlFor={fieldId}>
                  {TOKEN_ACTION_LABELS[asking]}: {TOKEN_ACTION_PROMPTS[asking]}
                </label>
                <input
                  ref={fieldRef}
                  id={fieldId}
                  className="pp-tokencard__field"
                  type="text"
                  value={text}
                  maxLength={TOKEN_ACTION_TEXT_MAX_LENGTH}
                  required
                  placeholder={asking === 'acao' ? 'beijar, atacar com a espada…' : undefined}
                  aria-describedby={`${fieldId}-count`}
                  onChange={(event) => setText(event.target.value)}
                />
                <p id={`${fieldId}-count`} className="pp-tokencard__count" aria-live="polite">
                  Faltam {TOKEN_ACTION_TEXT_MAX_LENGTH - text.length} caracteres
                </p>
                <div className="pp-pincard__choices">
                  <button type="submit" className="pp-pincard__travel" disabled={!canSend}>
                    Enviar ao mestre
                  </button>
                  <button type="button" className="pp-pincard__close pp-pincard__close--inline" onClick={back}>
                    Voltar
                  </button>
                </div>
              </form>
            )}
            {chosen === 'entregar' && (
              <div className="pp-pincard__confirm">
                <p className="pp-pincard__question">Entregar a {name}</p>
                {give.kind === 'ready' ? (
                  <ul className="pp-tokencard__items" aria-label="Itens da sua mochila">
                    {give.items.map((item, index) => (
                      <li key={item.id}>
                        <button ref={index === 0 ? firstItemRef : undefined} type="button" className="pp-tokencard__item" onClick={() => give.onGive(item.id)}>
                          <span className="pp-tokencard__item-face">
                            <ImagemOuIniciais imagem={item.imagem} nome={item.nome} />
                          </span>
                          <span className="pp-tokencard__item-name">{item.nome}</span>
                          {item.quantidade !== undefined && item.quantidade > 1 && <span className="pp-tokencard__item-qty">×{item.quantidade}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pp-empty">{giveBlockedText(give, name)}</p>
                )}
                <div className="pp-pincard__choices">
                  <button ref={backRef} type="button" className="pp-pincard__close pp-pincard__close--inline" onClick={back}>
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <button type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
