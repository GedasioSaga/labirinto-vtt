import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Token } from '../types/map'
import { TOKEN_ACTIONS, TOKEN_ACTION_LABELS, TOKEN_ACTION_PROMPTS, TOKEN_ACTIONS_NEED_TEXT, TOKEN_ACTION_TEXT_MAX_LENGTH, type TokenAction } from '../lib/tokenActions'
import { tokenCardName } from './tokenCard'

interface PlayerTokenCardProps {
  /** A ficha como o JOGADOR a recebe (recorte do host): o nome é o "Nome para os jogadores". */
  token: Token
  onClose: () => void
  /** Manda o pedido ao mestre. `text` vem aparado; `''` = sem texto. */
  onSend: (action: TokenAction, text: string) => void
  /** Já há um pedido esperando o mestre: as ações ficam desligadas. */
  waiting: boolean
}

/** Controles focáveis dentro do cartão, na ordem do DOM: é por eles que o Tab circula. */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled)'

/**
 * CARTÃO DA FICHA ALHEIA (NPC ou colega): o nome que o jogador vê e as ações
 * que viram pedido na Caixa do mestre. Escolher a ação abre o campo do que ele
 * diz, oferece ou pede; "Enviar ao mestre" manda. O mesmo lugar e a mesma
 * pintura do cartão do pino (`PlayerPinCard`): encostado à direita, com o mapa
 * à vista, e fecha por Escape, pelo "Fechar" e por tocar fora.
 *
 * O nome vai como TEXTO (o React escapa): é o mestre quem o escreve, e ele
 * chega pela rede.
 */
export function PlayerTokenCard({ token, onClose, onSend, waiting }: PlayerTokenCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const firstActionRef = useRef<HTMLButtonElement | null>(null)
  const fieldRef = useRef<HTMLInputElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [chosen, setChosen] = useState<TokenAction | null>(null)
  const [text, setText] = useState('')
  const fieldId = useId()
  const name = tokenCardName(token)

  useEffect(() => {
    // Foco dentro do cartão ao abrir e ao voltar da escolha: quem chegou pelo
    // teclado segue daqui. Esperando o mestre, as ações estão desligadas: o foco vai ao "Fechar".
    if (chosen !== null) fieldRef.current?.focus()
    else if (waiting) closeRef.current?.focus()
    else firstActionRef.current?.focus()
  }, [chosen, waiting])

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
  const canSend = chosen !== null && !waiting && (said !== '' || !TOKEN_ACTIONS_NEED_TEXT.has(chosen))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (chosen === null || !canSend) return
    onSend(chosen, said)
  }
  const back = () => {
    setChosen(null)
    setText('')
  }

  return (
    <div className="pp-pincard__backdrop">
      <div ref={cardRef} className="pp-pincard pp-tokencard" role="dialog" aria-modal="true" aria-label={`Ficha: ${name}`}>
        <p className="pp-tokencard__name">{name}</p>
        {waiting && <p className="pp-pincard__locked">Você já tem um pedido esperando o mestre. Espere a resposta para pedir outra coisa.</p>}
        {chosen === null ? (
          <div className="pp-tokencard__actions" role="group" aria-label="O que você faz">
            {TOKEN_ACTIONS.map((action, index) => (
              <button
                key={action}
                ref={index === 0 ? firstActionRef : undefined}
                type="button"
                className="pp-pincard__travel"
                disabled={waiting}
                onClick={() => setChosen(action)}
              >
                {TOKEN_ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        ) : (
          <form className="pp-pincard__confirm" onSubmit={submit}>
            <label className="pp-pincard__question" htmlFor={fieldId}>
              {TOKEN_ACTION_LABELS[chosen]}: {TOKEN_ACTION_PROMPTS[chosen]}
            </label>
            <input
              ref={fieldRef}
              id={fieldId}
              className="pp-tokencard__field"
              type="text"
              value={text}
              maxLength={TOKEN_ACTION_TEXT_MAX_LENGTH}
              required={TOKEN_ACTIONS_NEED_TEXT.has(chosen)}
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
        <button ref={closeRef} type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
