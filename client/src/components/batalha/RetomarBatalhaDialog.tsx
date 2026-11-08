import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { CenaOferecida, OfertaDaBatalhaSalva } from '../../stores/batalhaSalvaNaMesa'

/**
 * "Retomar a batalha?" (conserto das fichas F1, fatia S5; P8): a mesa aberta
 * tem uma batalha guardada que não foi encerrada (o app fechou, ou foi
 * atualizado, no meio dela). Retomar volta a batalha do ponto em que ela e as
 * fichas foram salvas juntas (`stores/batalhaSalvaNaMesa.ts`); Encerrar acaba
 * com ela (as formas desligam, como no Encerrar do livro).
 *
 * `alertdialog` como o "Alterações não salvas" do App: o foco entra no botão
 * que não perde nada (Retomar), o clique no fundo não fecha e o Tab circula
 * dentro da caixa. Não há "cancelar": até a resposta nada grava por cima da
 * batalha guardada, então a pergunta precisa de uma das duas.
 */

/** A mesma entrada da caixa de "Alterações não salvas" (`App.tsx`). */
const ENTRADA_MS = 160

interface RetomarBatalhaDialogProps {
  oferta: OfertaDaBatalhaSalva
  onRetomar: () => void
  onEncerrar: () => void
}

function textoDaCena(cena: CenaOferecida): string {
  return `“${cena.nome}” (rodada ${cena.rodada})`
}

/** "na cena X (rodada 3)" ou "nas cenas X (rodada 3) e Y (rodada 1)". */
function ondeEstava(cenas: readonly CenaOferecida[]): string {
  const textos = cenas.map(textoDaCena)
  if (textos.length <= 1) return `na cena ${textos[0] ?? ''}`
  return `nas cenas ${textos.slice(0, -1).join(', ')} e ${textos[textos.length - 1]}`
}

export function RetomarBatalhaDialog({ oferta, onRetomar, onEncerrar }: RetomarBatalhaDialogProps) {
  const tituloId = useId()
  const textoId = useId()
  const caixaRef = useRef<HTMLDivElement>(null)
  const retomarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    retomarRef.current?.focus()
    const caixa = caixaRef.current
    // `animate` não existe no jsdom, e quem pediu menos movimento recebe a caixa já no lugar.
    if (!caixa || typeof caixa.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    caixa.animate([{ opacity: 0, transform: 'scale(0.95)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ENTRADA_MS, easing: 'ease-out' })
  }, [])

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Caixa modal: nenhuma tecla daqui vale como atalho do editor.
    event.stopPropagation()
    if (event.key !== 'Tab') return
    const botoes = Array.from(caixaRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
    if (botoes.length === 0) return
    const primeiro = botoes[0]
    const ultimo = botoes[botoes.length - 1]
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  return createPortal(
    <div className="lb-dialog-backdrop">
      <div ref={caixaRef} className="lb-panel lb-dialog" role="alertdialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={textoId} onKeyDown={onKeyDown}>
        <header className="lb-dialog__head">
          <h2 id={tituloId} className="lb-dialog__title">
            Batalha em andamento
          </h2>
        </header>
        <div className="lb-dialog__body" style={{ padding: 'var(--lb-space-4)' }}>
          <p id={textoId} style={{ margin: 0, lineHeight: 'var(--lb-font-leading-normal)' }}>
            Ficou uma batalha sem encerrar {ondeEstava(oferta.cenas)}. Retomar volta a batalha junto com as fichas, do jeito que ficaram salvas: a
            ordem, as recargas, os selos, os golpes esperando resposta e o registro. Encerrar acaba com ela, e as formas desligam.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lb-space-2)', justifyContent: 'flex-end', padding: 'var(--lb-space-4)', paddingTop: 0 }}>
          <button type="button" className="lb-btn lb-btn--danger" onClick={onEncerrar}>
            Encerrar
          </button>
          <button ref={retomarRef} type="button" className="lb-btn lb-btn--primary" onClick={onRetomar}>
            Retomar a batalha
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
