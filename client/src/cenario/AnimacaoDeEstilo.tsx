import { useEffect, useRef, useState } from 'react'
import type { EstiloDeCenario, InstanciaDeEstilo } from './estilosDeCenario'
import './cenario.css'

interface AnimacaoDeEstiloProps {
  /** A imagem do pino (data URL). */
  imagem: string
  estilo: EstiloDeCenario
  /** Já resolvida: a do mestre ou a natural do estilo. */
  duracaoS: number
  /** 0 a 1; 0 = mudo. Lido na criação de cada passada. */
  volume: number
  /** Prévia do mestre: recomeça sozinha. No jogo: toca uma vez e chama `onFim`. */
  repetir: boolean
  /** Muda o valor para recomeçar do zero. */
  rodada: number
  onFim?: () => void
  /** O módulo lançou: quem chamou troca para a panorâmica. */
  onErro: (erro: unknown) => void
  /** "Pular" da revelação do local: desenha o último instante e para ali. */
  pularParaOFim?: boolean
}

/** Teto da densidade de pixels: tela 3x pintaria 9x os pixels de uma 1x sem ganho visível. */
const DPR_MAX = 2

/** Px físicos do canvas para um quadro de `w` x `h` px de CSS. */
function pixelsFisicos(w: number, h: number): { largura: number; altura: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX)
  return { largura: Math.max(1, Math.round(w * dpr)), altura: Math.max(1, Math.round(h * dpr)) }
}

/**
 * Toca um ESTILO DE CENÁRIO do pacote: o mesmo quadro da panorâmica (proporção
 * da foto, cabendo na área, sem passar do tamanho original), com um canvas que
 * o módulo pinta. O relógio é do app (rAF); o módulo só desenha o instante que
 * recebe. Qualquer erro do módulo — no criar, num quadro ou no ajuste de tela —
 * para o relógio, solta o módulo e avisa `onErro`.
 */
export function AnimacaoDeEstilo({ imagem, estilo, duracaoS, volume, repetir, rodada, onFim, onErro, pularParaOFim = false }: AnimacaoDeEstiloProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const fotoRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const instanciaRef = useRef<InstanciaDeEstilo | null>(null)
  const onFimRef = useRef(onFim)
  onFimRef.current = onFim
  const onErroRef = useRef(onErro)
  onErroRef.current = onErro
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  // Lido a cada quadro: pular não recomeça o módulo, só o leva ao último instante.
  const pularRef = useRef(pularParaOFim)
  pularRef.current = pularParaOFim
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null)
  const temTamanho = tamanho !== null

  // A foto fica no DOM (escondida) para o módulo receber um <img> já carregado.
  useEffect(() => {
    const area = areaRef.current
    const foto = fotoRef.current
    if (!area || !foto) return
    const medir = () => {
      if (!foto.naturalWidth || !foto.naturalHeight) return
      const escala = Math.min(1, area.clientWidth / foto.naturalWidth, area.clientHeight / foto.naturalHeight)
      setTamanho({ w: Math.round(foto.naturalWidth * escala), h: Math.round(foto.naturalHeight * escala) })
    }
    // Sem a imagem não há o que entregar ao módulo: a panorâmica cuida do resto.
    const falhou = () => onErroRef.current(new Error('a imagem do pino não carregou'))
    medir()
    foto.addEventListener('load', medir)
    foto.addEventListener('error', falhou)
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    observador?.observe(area)
    return () => {
      foto.removeEventListener('load', medir)
      foto.removeEventListener('error', falhou)
      observador?.disconnect()
    }
  }, [imagem])

  // Quadro mudou de tamanho: troca os px do canvas e avisa o módulo vivo, sem recomeçar.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!tamanho || !canvas) return
    const { largura, altura } = pixelsFisicos(tamanho.w, tamanho.h)
    if (canvas.width === largura && canvas.height === altura) return
    canvas.width = largura
    canvas.height = altura
    const instancia = instanciaRef.current
    if (!instancia?.ajustarTela) return
    try {
      instancia.ajustarTela(largura, altura)
    } catch (erro) {
      instanciaRef.current = null
      soltar(instancia, estilo.id)
      onErroRef.current(erro)
    }
  }, [tamanho, estilo.id])

  useEffect(() => {
    const canvas = canvasRef.current
    const foto = fotoRef.current
    if (!temTamanho || !canvas || !foto) return
    const reduzirMovimento = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let quadro = 0
    let parado = false

    const falhar = (erro: unknown) => {
      parado = true
      cancelAnimationFrame(quadro)
      const instancia = instanciaRef.current
      instanciaRef.current = null
      if (instancia) soltar(instancia, estilo.id)
      onErroRef.current(erro)
    }

    // Cada passada é uma instância nova: o `tS` que o módulo recebe nunca volta para trás.
    const montar = (): boolean => {
      try {
        instanciaRef.current = estilo.criar(canvas, foto, { reduzirMovimento, volume: volumeRef.current })
        return true
      } catch (erro) {
        falhar(erro)
        return false
      }
    }

    if (!montar()) return
    let inicio = performance.now()

    const passo = (agora: number) => {
      if (parado) return
      let t = Math.max(0, (agora - inicio) / 1000)
      if (pularRef.current && !repetir && t < duracaoS) {
        // O contrato só promete `tS` crescente: um salto para a frente é permitido.
        try {
          instanciaRef.current?.atualizar(duracaoS)
        } catch (erro) {
          falhar(erro)
          return
        }
        t = duracaoS
      }
      if (t >= duracaoS) {
        if (!repetir) {
          // Fim: o último quadro fica na tela até quem chamou fechar (o jogador vê o cartão surgir por cima).
          parado = true
          onFimRef.current?.()
          return
        }
        const anterior = instanciaRef.current
        instanciaRef.current = null
        if (anterior) soltar(anterior, estilo.id)
        if (!montar()) return
        inicio = agora
        t = 0
      }
      const instancia = instanciaRef.current
      if (!instancia) return
      try {
        instancia.atualizar(t)
      } catch (erro) {
        falhar(erro)
        return
      }
      quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => {
      parado = true
      cancelAnimationFrame(quadro)
      const instancia = instanciaRef.current
      instanciaRef.current = null
      if (instancia) soltar(instancia, estilo.id)
    }
  }, [temTamanho, estilo, duracaoS, repetir, rodada])

  return (
    <div ref={areaRef} className="lb-cenario">
      <div className="lb-cenario__quadro" style={tamanho ? { width: tamanho.w, height: tamanho.h } : { visibility: 'hidden' }}>
        <img ref={fotoRef} src={imagem} alt="" draggable={false} hidden />
        {/* O visual é todo do módulo: sem vinheta nem cortina da panorâmica por cima. */}
        <canvas ref={canvasRef} className="lb-cenario__tela" aria-hidden="true" />
      </div>
    </div>
  )
}

/**
 * `descartar` que lança não pode derrubar a tela nem impedir a panorâmica:
 * o erro vira aviso no console, com o id do estilo para achar o pacote torto.
 */
function soltar(instancia: InstanciaDeEstilo, id: string): void {
  try {
    instancia.descartar()
  } catch (erro) {
    console.warn(`estilo de cenário ${id}: descartar falhou`, erro)
  }
}
