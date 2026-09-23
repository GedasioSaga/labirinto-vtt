import { useEffect, useId } from 'react'
import { isEditableTarget } from '../lib/keymap'

export interface PlayerNoteCardProps {
  /** O recado como o mestre escreveu. Vai para a tela como TEXTO: HTML aparece literal. */
  text: string
  /**
   * Cabeçalho do cartão. Ausente = "Recado do mestre". O TEXTO DA SALA usa o
   * mesmo cartão com o nome da Sala aqui.
   */
  title?: string
  onClose(): void
  /**
   * Escape fecha o cartão. Desligado enquanto outro cartão (o do pino) está
   * aberto: o Escape é dele, e um toque não pode fechar os dois.
   */
  escapeCloses?: boolean
}

/**
 * O RECADO DO MESTRE na tela do jogador: fica até ele fechar ("Fechar" ou
 * Escape). Não rouba o foco nem tapa o mapa — chega sem o jogador pedir, e
 * ele pode estar no meio de arrastar a ficha ou de digitar o nome dela.
 *
 * O texto entra como filho de texto do React (nunca `innerHTML`): o React
 * escapa `<` e `>`, e o recado "<b>x</b>" aparece com os sinais na tela.
 */
export function PlayerNoteCard({ text, title = 'Recado do mestre', onClose, escapeCloses = true }: PlayerNoteCardProps) {
  const titleId = useId()

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
    <section className="pp-note" aria-labelledby={titleId}>
      <h2 id={titleId} className="pp-note__title">
        {title}
      </h2>
      <p className="pp-note__text">{text}</p>
      <button type="button" className="pp-note__close" onClick={onClose}>
        Fechar
      </button>
    </section>
  )
}
