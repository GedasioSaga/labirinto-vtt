import { useEffect, useId, type ReactNode } from 'react'
import { isEditableTarget } from '../lib/keymap'

/** Título do cartão do TEXTO DE CHEGADA DA CENA (o mesmo cartão do recado). */
export const ARRIVAL_CARD_TITLE = 'Ao chegar'

export interface PlayerNoteCardProps {
  /** O recado como o mestre escreveu. Vai para a tela como TEXTO: HTML aparece literal. */
  text?: string
  /** Corpo além do texto (a lista do "Enquanto você esteve fora"). Também só texto do React, nunca HTML. */
  children?: ReactNode
  /**
   * Cabeçalho do cartão. Ausente = "Recado do mestre". O TEXTO DA SALA usa o
   * mesmo cartão com o nome da Sala aqui, e o TEXTO DE CHEGADA com
   * `ARRIVAL_CARD_TITLE`.
   */
  title?: string
  /** Linha pequena abaixo do texto. O recado diz que fica no Caderno; o texto da Sala não tem. */
  hint?: string
  onClose(): void
  /**
   * Escape fecha o cartão. Desligado enquanto outro cartão (o do pino) está
   * aberto: o Escape é dele, e um toque não pode fechar os dois.
   */
  escapeCloses?: boolean
  /** O mestre mandou só para este jogador: a faixa "Só para você" aparece sob o título. */
  onlyYou?: boolean
}

export const ONLY_YOU_LABEL = 'Só para você'

/**
 * O RECADO DO MESTRE na tela do jogador: fica até ele fechar ("Fechar" ou
 * Escape). Não rouba o foco nem tapa o mapa — chega sem o jogador pedir, e
 * ele pode estar no meio de arrastar a ficha ou de digitar o nome dela.
 *
 * O texto entra como filho de texto do React (nunca `innerHTML`): o React
 * escapa `<` e `>`, e o recado "<b>x</b>" aparece com os sinais na tela.
 */
export function PlayerNoteCard({ text, children, title = 'Recado do mestre', hint, onClose, escapeCloses = true, onlyYou = false }: PlayerNoteCardProps) {
  const titleId = useId()
  const onlyId = useId()

  useEffect(() => {
    if (!escapeCloses) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Dentro de campo de texto o Escape é da edição (renomear a ficha), não do cartão.
      const alvo = event.target
      if (alvo instanceof HTMLElement && isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [escapeCloses, onClose])

  return (
    // A faixa entra no nome da região: o leitor de tela lê "Recado do mestre, Só para você".
    <section className="pp-note" aria-labelledby={onlyYou ? `${titleId} ${onlyId}` : titleId}>
      <h2 id={titleId} className="pp-note__title">
        {title}
      </h2>
      {onlyYou && (
        <p id={onlyId} className="pp-note__only">
          {ONLY_YOU_LABEL}
        </p>
      )}
      {text !== undefined && <p className="pp-note__text">{text}</p>}
      {children}
      {hint !== undefined && <p className="pp-note__hint">{hint}</p>}
      <button type="button" className="pp-note__close" onClick={onClose}>
        Fechar
      </button>
    </section>
  )
}
