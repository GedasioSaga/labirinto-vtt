import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './batalha.css'

/**
 * Janela da batalha (o perfil da carta e as regras do campo), nas duas telas.
 * Própria, e não o `Dialogo` do grimório, porque o jogador não carrega o
 * grimório (player/folhaSemGrimorio.test.ts).
 *
 * Convenções de "Diálogo modal": o foco entra ao abrir e volta a quem abriu
 * ao fechar; Tab circula só dentro; Esc fecha; clique no fundo (apertar e
 * soltar no fundo) fecha. Entra com opacidade e escala 0,96 → 1 em 200 ms
 * (`@starting-style`); fecha na hora. Quem monta decide se está aberta: a
 * janela existe enquanto está montada.
 */

export interface JanelaDaBatalhaProps {
  titulo: string
  descricao?: ReactNode
  /** A ficha inteira (o perfil): 1100 px. Padrão: 560. */
  larga?: boolean
  onFechar: () => void
  children: ReactNode
}

const FOCAVEIS = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function JanelaDaBatalha({ titulo, descricao, larga, onFechar, children }: JanelaDaBatalhaProps) {
  const tituloId = useId()
  const descricaoId = useId()
  const janela = useRef<HTMLDivElement>(null)
  const fechar = useRef<HTMLButtonElement>(null)
  const apertouNoFundo = useRef(false)

  useLayoutEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    fechar.current?.focus({ preventScroll: true })
    return () => antes?.focus({ preventScroll: true })
  }, [])

  // A página atrás não rola com a janela aberta.
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // Janela modal: tecla nenhuma daqui vira atalho do mapa atrás dela.
    evento.stopPropagation()
    if (evento.key === 'Escape') {
      evento.preventDefault()
      onFechar()
      return
    }
    if (evento.key !== 'Tab') return
    const focaveis = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(FOCAVEIS))
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (primeiro === undefined || ultimo === undefined) {
      evento.preventDefault()
      return
    }
    const ativo = document.activeElement
    const fora = !focaveis.some((focavel) => focavel === ativo)
    if (evento.shiftKey ? ativo === primeiro || fora : ativo === ultimo || fora) {
      evento.preventDefault()
      ;(evento.shiftKey ? ultimo : primeiro).focus()
    }
  }

  return createPortal(
    <div
      className="bt-janela-fundo"
      onMouseDown={(evento) => {
        apertouNoFundo.current = evento.target === evento.currentTarget
      }}
      onMouseUp={(evento) => {
        const noFundo = apertouNoFundo.current && evento.target === evento.currentTarget
        apertouNoFundo.current = false
        if (noFundo) onFechar()
      }}
    >
      <div
        ref={janela}
        className={larga ? 'bt-janela bt-janela--larga' : 'bt-janela'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricao === undefined ? undefined : descricaoId}
        tabIndex={-1}
        onKeyDown={teclar}
      >
        <div className="bt-janela__topo">
          <div className="bt-janela__cabeca">
            <h2 className="bt-janela__tit" id={tituloId}>
              {titulo}
            </h2>
            {descricao !== undefined && (
              <p className="bt-janela__desc" id={descricaoId}>
                {descricao}
              </p>
            )}
          </div>
          <button ref={fechar} type="button" className="bt-botao bt-botao--fantasma bt-janela__fechar" aria-label="Fechar" onClick={onFechar}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="bt-janela__corpo">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
