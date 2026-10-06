import { useEffect, useRef } from 'react'
import { tocarTransicao, type ControleDeTransicao } from './motor'
import type { TransicaoEscolhida } from './catalogo'
import './transicoes.css'

interface TransicaoTelaProps {
  escolha: TransicaoEscolhida
  /** 0 a 1; 0 = mudo. */
  volume: number
  repetir?: boolean
  /** Muda o valor para recomeçar do zero (botão "Repetir" da prévia). */
  rodada?: number
  onFim?: () => void
}

/** Granulado de fita velha: 160×100 de ruído redesenhado a cada 3 quadros. */
function useGranulado(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = 160
    canvas.height = 100
    let quadro = 0
    let id = 0
    const desenhar = () => {
      if (quadro++ % 3 === 0) {
        const img = ctx.createImageData(canvas.width, canvas.height)
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 255
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v
          img.data[i + 3] = 255
        }
        ctx.putImageData(img, 0, 0)
      }
      id = requestAnimationFrame(desenhar)
    }
    id = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(id)
  }, [ref])
}

/**
 * A animação em si: canvas 3D, granulado, vinheta e a cortina preta dos fades.
 * Ocupa o contêiner inteiro; quem decide o tamanho é quem a usa (janela de
 * prévia do mestre ou tela cheia do jogador).
 */
export function TransicaoTela({ escolha, volume, repetir = false, rodada = 0, onFim }: TransicaoTelaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const granuladoRef = useRef<HTMLCanvasElement>(null)
  const cortinaRef = useRef<HTMLDivElement>(null)
  const controleRef = useRef<ControleDeTransicao | null>(null)
  const onFimRef = useRef(onFim)
  onFimRef.current = onFim
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  useGranulado(granuladoRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let vivo = true
    const reduzirMovimento = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    void tocarTransicao({
      canvas,
      escolha,
      volume: volumeRef.current,
      reduzirMovimento,
      repetir,
      onFade: (opacidade) => {
        if (cortinaRef.current) cortinaRef.current.style.opacity = String(opacidade)
      },
      onFim: () => {
        if (vivo) onFimRef.current?.()
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
  }, [escolha.id, escolha.duracaoS, repetir, rodada])

  useEffect(() => {
    controleRef.current?.definirVolume(volume)
  }, [volume])

  return (
    <div className="lb-transicao-tela">
      <canvas ref={canvasRef} className="lb-transicao-tela__cena" />
      <canvas ref={granuladoRef} className="lb-transicao-tela__granulado" aria-hidden="true" />
      <div className="lb-transicao-tela__vinheta" aria-hidden="true" />
      <div ref={cortinaRef} className="lb-transicao-tela__cortina" aria-hidden="true" />
    </div>
  )
}
