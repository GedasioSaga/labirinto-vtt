import { useEffect, useRef, useState } from 'react'
import { duracaoDoCenarioS, movimentoInfo, type CenarioDoPino, type Enquadramento } from './catalogo'
import { AnimacaoDeEstilo } from './AnimacaoDeEstilo'
import { duracaoDoEstiloS, useEstilosDeCenario, type EstiloDeCenario } from './estilosDeCenario'
import './cenario.css'

interface AnimacaoCenarioProps {
  /** A imagem do pino (data URL). */
  imagem: string
  cenario: CenarioDoPino
  /** 0 a 1; 0 = mudo. Só vale com `cenario.som`. */
  volume: number
  /** Prévia do mestre: recomeça sozinha. No jogo: toca uma vez e chama `onFim`. */
  repetir?: boolean
  /** Muda o valor para recomeçar do zero. */
  rodada?: number
  onFim?: () => void
}

/** Partes da animação, em fração da duração: aparece, segura, anda, segura, apaga. */
const FASES = { entra: 0.08, comeca: 0.16, termina: 0.76, apaga: 0.9 }
const PARTICULAS = 60

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** Começa devagar, acelera no meio e assenta: movimento de grua de cinema. */
const grua = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}
const mistura = (a: Enquadramento, b: Enquadramento, u: number): Enquadramento => ({
  zoom: a.zoom + (b.zoom - a.zoom) * u,
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
})

/**
 * Deslocamento da foto (em px do quadro) para que o ponto `e.x, e.y` fique no
 * centro com o zoom `e.zoom`, sem nunca mostrar borda vazia.
 */
function deslocamento(e: Enquadramento, largura: number, altura: number) {
  const w = largura * e.zoom
  const h = altura * e.zoom
  const x = Math.min(0, Math.max(largura - w, largura / 2 - e.x * w))
  const y = Math.min(0, Math.max(altura - h, altura / 2 - e.y * h))
  return { x, y }
}

interface Particula {
  x: number
  y: number
  r: number
  prof: number
  vx: number
  vy: number
  fase: number
  folha: boolean
}

function novaParticula(qualquerAltura: boolean): Particula {
  const prof = Math.random()
  return {
    x: Math.random(),
    y: qualquerAltura ? Math.random() : 1.05,
    r: 0.6 + prof * 2.4,
    prof,
    vx: (Math.random() - 0.5) * 0.004,
    vy: -(0.006 + Math.random() * 0.01),
    fase: Math.random() * Math.PI * 2,
    folha: Math.random() < 0.25,
  }
}

/** Vento baixo, que sobe e desce devagar. Devolve quem para tudo. */
function ligarVento(volume: number): { parar: () => void; volume: (v: number) => void } | null {
  if (typeof AudioContext === 'undefined') return null
  try {
    const ctx = new AudioContext()
    const mestre = ctx.createGain()
    mestre.gain.value = volume
    mestre.connect(ctx.destination)
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
    const dados = buffer.getChannelData(0)
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
    const vento = ctx.createBufferSource()
    vento.buffer = buffer
    vento.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = 480
    const ganho = ctx.createGain()
    ganho.gain.value = 0.22
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.12
    const profundidade = ctx.createGain()
    profundidade.gain.value = 0.1
    lfo.connect(profundidade).connect(ganho.gain)
    vento.connect(filtro).connect(ganho).connect(mestre)
    vento.start()
    lfo.start()
    void ctx.resume().catch(() => undefined)
    return {
      parar: () => void ctx.close().catch(() => undefined),
      volume: (v) => {
        mestre.gain.value = v
      },
    }
  } catch {
    return null
  }
}

/**
 * A ANIMAÇÃO DO CENÁRIO. Com `cenario.estilo` de um estilo registrado (pacote
 * baixado), toca o módulo dele; sem estilo, com estilo ainda não baixado ou
 * com o módulo quebrado, toca a panorâmica embutida com os campos do cenário.
 * O "quando", o "Pular" e o fim continuam com quem chama.
 */
export function AnimacaoCenario(props: AnimacaoCenarioProps) {
  const { imagem, cenario, volume, repetir = false, rodada = 0, onFim } = props
  const estilos = useEstilosDeCenario()
  const estilo = cenario.estilo === undefined ? null : (estilos.find((e) => e.id === cenario.estilo) ?? null)
  // Guarda o OBJETO que falhou, não o id: um pacote novo com o mesmo id ganha outra chance.
  const [quebrado, setQuebrado] = useState<EstiloDeCenario | null>(null)
  if (estilo !== null && estilo !== quebrado) {
    return (
      <AnimacaoDeEstilo
        imagem={imagem}
        estilo={estilo}
        duracaoS={duracaoDoEstiloS(cenario, estilo)}
        volume={volume}
        repetir={repetir}
        rodada={rodada}
        onFim={onFim}
        onErro={(erro) => {
          console.warn(`estilo de cenário ${estilo.id}: falhou, tocando a panorâmica`, erro)
          setQuebrado(estilo)
        }}
      />
    )
  }
  return <AnimacaoPanoramica {...props} />
}

/**
 * A PANORÂMICA: a imagem do pino num quadro do tamanho dela (cabendo no espaço
 * dado), com a câmera andando pelo movimento escolhido. Névoa, raios e
 * partículas por cima, cada um só se o mestre ligou. Só `transform` e
 * `opacity` mudam a cada quadro.
 */
function AnimacaoPanoramica({ imagem, cenario, volume, repetir = false, rodada = 0, onFim }: AnimacaoCenarioProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const fotoRef = useRef<HTMLImageElement>(null)
  const nevoaARef = useRef<HTMLDivElement>(null)
  const nevoaBRef = useRef<HTMLDivElement>(null)
  const raiosRef = useRef<HTMLDivElement>(null)
  const particulasRef = useRef<HTMLCanvasElement>(null)
  const cortinaRef = useRef<HTMLDivElement>(null)
  const onFimRef = useRef(onFim)
  onFimRef.current = onFim
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const ventoRef = useRef<ReturnType<typeof ligarVento>>(null)
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null)

  // O quadro tem a proporção da foto, cabe na área e não passa do tamanho original.
  useEffect(() => {
    const area = areaRef.current
    const foto = fotoRef.current
    if (!area || !foto) return
    const medir = () => {
      if (!foto.naturalWidth || !foto.naturalHeight) return
      const escala = Math.min(1, area.clientWidth / foto.naturalWidth, area.clientHeight / foto.naturalHeight)
      setTamanho({ w: Math.round(foto.naturalWidth * escala), h: Math.round(foto.naturalHeight * escala) })
    }
    medir()
    foto.addEventListener('load', medir)
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    observador?.observe(area)
    return () => {
      foto.removeEventListener('load', medir)
      observador?.disconnect()
    }
  }, [imagem])

  useEffect(() => {
    if (!cenario.som) return
    ventoRef.current = ligarVento(volumeRef.current)
    return () => {
      ventoRef.current?.parar()
      ventoRef.current = null
    }
  }, [cenario.som, rodada])

  useEffect(() => {
    ventoRef.current?.volume(volume)
  }, [volume])

  useEffect(() => {
    if (!tamanho) return
    const foto = fotoRef.current
    const canvas = particulasRef.current
    if (!foto) return
    const reduzir = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const movimento = movimentoInfo(cenario.movimento)
    const duracao = duracaoDoCenarioS(cenario)
    const ctx2d = canvas?.getContext('2d') ?? null
    const pontos = Array.from({ length: PARTICULAS }, () => novaParticula(true))
    if (canvas) {
      canvas.width = Math.round(tamanho.w * Math.min(window.devicePixelRatio || 1, 2))
      canvas.height = Math.round(tamanho.h * Math.min(window.devicePixelRatio || 1, 2))
    }
    let inicio = performance.now()
    let anterior = inicio
    let anteriorU = 0
    let quadro = 0
    let acabou = false

    const passo = (agora: number) => {
      const dt = Math.min(0.05, (agora - anterior) / 1000)
      anterior = agora
      let t = (agora - inicio) / 1000
      if (t >= duracao) {
        if (repetir) {
          inicio = agora
          t = 0
        } else if (!acabou) {
          acabou = true
          if (cortinaRef.current) cortinaRef.current.style.opacity = '1'
          onFimRef.current?.()
          return
        }
      }
      const f = t / duracao
      const u = reduzir ? 1 : grua((f - FASES.comeca) / (FASES.termina - FASES.comeca))
      const e = mistura(movimento.inicio, movimento.fim, u)
      const d = deslocamento(e, tamanho.w, tamanho.h)
      const balanco = reduzir ? { x: 0, y: 0 } : { x: Math.sin(t * 0.6) * 2, y: Math.sin(t * 0.9) * 1.5 }
      foto.style.transform = `translate(${d.x + balanco.x}px, ${d.y + balanco.y}px) scale(${e.zoom})`

      // Névoa perto da câmera: anda no sentido contrário ao movimento, mais rápido que a foto.
      const dirX = movimento.fim.x - movimento.inicio.x
      const dirY = movimento.fim.y - movimento.inicio.y
      if (nevoaARef.current) nevoaARef.current.style.transform = `translate(${-dirX * u * 60 + Math.sin(t * 0.15) * 20}%, ${-dirY * u * 80 + 55}%)`
      if (nevoaBRef.current) nevoaBRef.current.style.transform = `translate(${-dirX * u * 90 + Math.cos(t * 0.12) * -25}%, ${-dirY * u * 110 + 10}%)`
      if (raiosRef.current) raiosRef.current.style.transform = `translateY(${(1 - u) * 12}%)`

      if (ctx2d && canvas) {
        const velocidade = (u - anteriorU) * 30
        const W = canvas.width
        const H = canvas.height
        ctx2d.clearRect(0, 0, W, H)
        for (const p of pontos) {
          p.y += (p.vy - dirY * velocidade * (0.4 + p.prof * 1.4)) * dt
          p.x += (p.vx - dirX * velocidade * (0.4 + p.prof * 1.4) + Math.sin(t * 0.8 + p.fase) * 0.002) * dt * 6
          if (p.y < -0.05 || p.y > 1.1 || p.x < -0.05 || p.x > 1.05) Object.assign(p, novaParticula(false))
          const alfa = 0.25 + p.prof * 0.55
          ctx2d.save()
          ctx2d.translate(p.x * W, p.y * H)
          if (p.folha) {
            ctx2d.rotate(t + p.fase)
            ctx2d.fillStyle = `rgba(120, 190, 90, ${alfa})`
            ctx2d.beginPath()
            ctx2d.ellipse(0, 0, p.r * 2.4, p.r, 0, 0, Math.PI * 2)
          } else {
            ctx2d.fillStyle = `rgba(255, 248, 220, ${alfa})`
            ctx2d.beginPath()
            ctx2d.arc(0, 0, p.r, 0, Math.PI * 2)
          }
          ctx2d.fill()
          ctx2d.restore()
        }
      }
      anteriorU = u

      const entra = 1 - clamp01(f / FASES.entra)
      const sai = clamp01((f - FASES.apaga) / (1 - FASES.apaga))
      if (cortinaRef.current) cortinaRef.current.style.opacity = String(Math.max(entra, sai))
      quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [tamanho, cenario.movimento, cenario.duracaoS, repetir, rodada])

  return (
    <div ref={areaRef} className="lb-cenario">
      <div className="lb-cenario__quadro" style={tamanho ? { width: tamanho.w, height: tamanho.h } : { visibility: 'hidden' }}>
        <img ref={fotoRef} className="lb-cenario__foto" src={imagem} alt="" draggable={false} style={tamanho ? { width: tamanho.w, height: tamanho.h } : undefined} />
        {cenario.raios && <div ref={raiosRef} className="lb-cenario__raios" aria-hidden="true" />}
        {cenario.nevoa && (
          <>
            <div ref={nevoaARef} className="lb-cenario__nevoa" aria-hidden="true" />
            <div ref={nevoaBRef} className="lb-cenario__nevoa lb-cenario__nevoa--alta" aria-hidden="true" />
          </>
        )}
        {cenario.particulas && <canvas ref={particulasRef} className="lb-cenario__particulas" aria-hidden="true" />}
        <div className="lb-cenario__vinheta" aria-hidden="true" />
        <div ref={cortinaRef} className="lb-cenario__cortina" aria-hidden="true" />
      </div>
    </div>
  )
}
