import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { estaCalado, useSomStore } from '../stores/somStore'
import { RevelacaoDoLocal, type ImagemDoLocal } from './revelacao/RevelacaoDoLocal'
import './cenario.css'

interface CenarioOverlayProps {
  /** A imagem do pino com a animação do cenário; `null` = pino "!" sem imagem (só o painel). */
  imagem: ImagemDoLocal | null
  /** "Nome do local" do pino: o título do painel. */
  nome: string
  descricao: string
  /** O jogador fechou: quem chamou mostra o cartão. */
  onFim: () => void
}

/** Saída curta: a tela escura some e o cartão do pino aparece por baixo. */
const SAIDA_MS = 260

/**
 * REVELAÇÃO DO LOCAL na tela do jogador: por cima de tudo, até o jogador
 * fechar ("Pular" leva ao fim e vira "Fechar"). O som segue o "Som da mesa"
 * (volume e mudo); o vento, também o interruptor do próprio pino.
 */
export function CenarioOverlay({ imagem, nome, descricao, onFim }: CenarioOverlayProps) {
  const [saindo, setSaindo] = useState(false)
  const onFimRef = useRef(onFim)
  onFimRef.current = onFim
  const volume = useSomStore((estado) => (estaCalado(estado) ? 0 : estado.volume))

  useEffect(() => {
    if (!saindo) return
    const id = setTimeout(() => onFimRef.current(), SAIDA_MS)
    return () => clearTimeout(id)
  }, [saindo])

  const titulo = nome.trim()
  return createPortal(
    <div className="lb-revelacao-jogo" data-saindo={saindo} role="dialog" aria-modal="true" aria-label={titulo === '' ? 'Local revelado' : titulo}>
      <RevelacaoDoLocal imagem={imagem} nome={nome} descricao={descricao} volume={volume} onFechar={() => setSaindo(true)} />
    </div>,
    document.body,
  )
}
