import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { estaCalado, useSomStore } from '../stores/somStore'
import type { CenarioDoPino } from './catalogo'
import { AnimacaoCenario } from './AnimacaoCenario'
import './cenario.css'

interface CenarioOverlayProps {
  imagem: string
  cenario: CenarioDoPino
  /** A animação acabou ou o jogador pulou: quem chamou mostra o cartão. */
  onFim: () => void
}

/** Saída curta: a tela escura some e o cartão do pino aparece por baixo. */
const SAIDA_MS = 260

/**
 * ANIMAÇÃO DO CENÁRIO na tela do jogador: por cima de tudo, com "Pular". O som
 * segue o "Som da mesa" (volume e mudo) e o interruptor do próprio pino.
 */
export function CenarioOverlay({ imagem, cenario, onFim }: CenarioOverlayProps) {
  const [saindo, setSaindo] = useState(false)
  const pularRef = useRef<HTMLButtonElement>(null)
  const onFimRef = useRef(onFim)
  onFimRef.current = onFim
  const volume = useSomStore((estado) => (estaCalado(estado) ? 0 : estado.volume))

  useEffect(() => {
    pularRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!saindo) return
    const id = setTimeout(() => onFimRef.current(), SAIDA_MS)
    return () => clearTimeout(id)
  }, [saindo])

  const terminar = () => setSaindo(true)

  return createPortal(
    <div className="lb-cenario-jogo" data-saindo={saindo} role="dialog" aria-modal="true" aria-label="Animação do cenário">
      <AnimacaoCenario imagem={imagem} cenario={cenario} volume={volume} onFim={terminar} />
      <button ref={pularRef} type="button" className="lb-cenario-jogo__pular" onClick={terminar}>
        Pular
      </button>
    </div>,
    document.body,
  )
}
