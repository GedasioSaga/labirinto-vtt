import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { estaCalado, useSomStore } from '../stores/somStore'
import type { TransicaoEscolhida } from './catalogo'
import { TransicaoTela } from './TransicaoTela'
import './transicoes.css'

interface TransicaoOverlayProps {
  /** Muda a cada travessia: a tela toca uma vez por valor. */
  nonce: number
  escolha: TransicaoEscolhida
}

/** Saída da cortina: a animação termina no preto e o mapa novo aparece por baixo. */
const SAIDA_MS = 260

/**
 * TRANSIÇÃO ESPECIAL na tela do jogador: tela cheia por cima do mapa novo
 * (que já carrega embaixo), com "Pular". Toca uma vez por `nonce` e some com
 * um fade curto. O som segue o volume e o mudo do "Som da mesa".
 */
export function TransicaoOverlay({ nonce, escolha }: TransicaoOverlayProps) {
  const [vista, setVista] = useState<number | null>(null)
  const [saindo, setSaindo] = useState(false)
  const pularRef = useRef<HTMLButtonElement>(null)
  const volume = useSomStore((estado) => (estaCalado(estado) ? 0 : estado.volume))
  const ativa = vista !== nonce

  useEffect(() => {
    setSaindo(false)
  }, [nonce])

  useEffect(() => {
    if (ativa) pularRef.current?.focus()
  }, [ativa, nonce])

  useEffect(() => {
    if (!saindo) return
    const id = setTimeout(() => setVista(nonce), SAIDA_MS)
    return () => clearTimeout(id)
  }, [saindo, nonce])

  if (!ativa) return null
  const terminar = () => setSaindo(true)

  return createPortal(
    <div className="lb-transicao-jogo" data-saindo={saindo} role="dialog" aria-modal="true" aria-label="Transição">
      {/* `key`: outra travessia no meio da animação recomeça do zero. */}
      <TransicaoTela key={nonce} escolha={escolha} volume={volume} onFim={terminar} />
      <button ref={pularRef} type="button" className="lb-transicao-jogo__pular" onClick={terminar}>
        Pular
      </button>
    </div>,
    document.body,
  )
}
