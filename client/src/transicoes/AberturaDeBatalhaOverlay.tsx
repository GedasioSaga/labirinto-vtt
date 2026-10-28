import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { estaCalado, useSomStore } from '../stores/somStore'
import { tocarAberturaDeBatalha, type ControleDeTransicao } from './motor'
import './transicoes.css'

/**
 * MODO BATALHA (fatia B5): a abertura da batalha (as espadas e o "Royals") em
 * tela cheia, no mestre, no jogador e na TV. Toca uma vez por `abertura.id` e
 * some com o mesmo fade curto da transição de local (`TransicaoOverlay.tsx`).
 * Sem `transicao` ("Nenhuma") não aparece; abertura que este app não tem
 * (pacote ainda não baixado) termina na hora pelo próprio motor.
 */

/** O pedido de tocar: `id` novo a cada batalha ligada. */
export interface AberturaPedida {
  id: number
  transicao?: string
  texto?: string
}

interface AberturaDeBatalhaOverlayProps {
  abertura: AberturaPedida | null | undefined
  /** 0 a 1. Ausente = o "Som da mesa" deste aparelho (volume e mudo). A TV passa o volume fixo dela. */
  volume?: number
}

/** Saída da cortina: o mesmo fade da transição de local. */
const SAIDA_MS = 260

function querMovimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function AberturaTela({ id, nome, volume, onFim }: { id: string; nome: string | undefined; volume: number; onFim: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cortinaRef = useRef<HTMLDivElement>(null)
  const controleRef = useRef<ControleDeTransicao | null>(null)
  const onFimRef = useRef(onFim)
  onFimRef.current = onFim
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let vivo = true
    const opcoesDoNome = nome === undefined ? {} : { nome }
    void tocarAberturaDeBatalha({
      canvas,
      id,
      ...opcoesDoNome,
      volume: volumeRef.current,
      reduzirMovimento: querMovimentoReduzido(),
      onFade: (opacidade) => {
        if (cortinaRef.current) cortinaRef.current.style.opacity = String(opacidade)
      },
      onFim: () => {
        if (vivo) onFimRef.current()
      },
    }).then((controle) => {
      if (vivo) controleRef.current = controle
      else controle.parar()
    })
    return () => {
      vivo = false
      controleRef.current?.parar()
      controleRef.current = null
    }
  }, [id, nome])

  useEffect(() => {
    controleRef.current?.definirVolume(volume)
  }, [volume])

  return (
    <div className="lb-transicao-tela">
      <canvas ref={canvasRef} className="lb-transicao-tela__cena" />
      <div ref={cortinaRef} className="lb-transicao-tela__cortina" aria-hidden="true" />
    </div>
  )
}

export function AberturaDeBatalhaOverlay({ abertura, volume }: AberturaDeBatalhaOverlayProps) {
  const [vista, setVista] = useState<number | null>(null)
  const [saindo, setSaindo] = useState(false)
  const pularRef = useRef<HTMLButtonElement>(null)
  const volumeDoAparelho = useSomStore((estado) => (estaCalado(estado) ? 0 : estado.volume))
  const pedido = abertura ?? null
  const ativa = pedido !== null && pedido.transicao !== undefined && vista !== pedido.id
  const nonce = pedido?.id ?? null

  useEffect(() => {
    setSaindo(false)
  }, [nonce])

  useEffect(() => {
    if (ativa) pularRef.current?.focus()
  }, [ativa, nonce])

  useEffect(() => {
    if (!saindo || nonce === null) return
    const timer = setTimeout(() => setVista(nonce), SAIDA_MS)
    return () => clearTimeout(timer)
  }, [saindo, nonce])

  if (!ativa || pedido === null || pedido.transicao === undefined) return null
  const terminar = () => setSaindo(true)

  return createPortal(
    <div className="lb-transicao-jogo" data-saindo={saindo} role="dialog" aria-modal="true" aria-label="Abertura da batalha">
      {/* `key`: outra batalha ligada no meio da animação recomeça do zero. */}
      <AberturaTela key={pedido.id} id={pedido.transicao} nome={pedido.texto} volume={volume ?? volumeDoAparelho} onFim={terminar} />
      <button ref={pularRef} type="button" className="lb-transicao-jogo__pular" onClick={terminar}>
        Pular
      </button>
    </div>,
    document.body,
  )
}
