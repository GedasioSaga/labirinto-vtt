import { memo, useEffect, useRef } from 'react'
import type { DancaPlacarAoVivo } from '../../../net/protocoloDaDanca'
import { COLEGAS_NO_PALCO } from '../palco'
import type { MotorDaDanca } from './motor'
import { fmtPct } from './textos'

/** Meia cara da desafiante em pixel art (14 x 15, espelhada no meio), como no protótipo. */
const MEIA_CARA: readonly string[] = ['...oooo', '..ohhhh', '.ohhHhh', '.ohhhhh', 'ohhssss', 'ohsssss', 'ohggggs', 'ohgeegs', 'ohsgggs', '.osssss', '.ossSww', '..osSSs', '...oooo', '.orrrrr', 'orrRrrr']
const CORES_DA_CARA: Readonly<Record<string, string>> = { o: '#1b1208', h: '#c9c2b6', H: '#8f887c', s: '#d39a70', S: '#a8714d', g: '#e0a44a', e: '#1b1208', w: '#f1e6d2', r: '#e2645a', R: '#a9473f' }

/** Canvas sem 2D (jsdom, navegador sem canvas): não desenha, e a tela segue. */
function contexto2d(cv: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return cv.getContext('2d')
  } catch {
    return null
  }
}

/** Retrato da desafiante: canvas de 14 x 15 ampliado em pixel, no cabeçalho do convite. */
export const Retrato = memo(function Retrato() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (cv === null) return
    const g = contexto2d(cv)
    if (g === null) return
    cv.width = 14
    cv.height = 15
    MEIA_CARA.forEach((linha, y) => {
      const cheia = linha + [...linha].reverse().join('')
      ;[...cheia].forEach((c, x) => {
        const cor = CORES_DA_CARA[c]
        if (cor === undefined) return
        g.fillStyle = cor
        g.fillRect(x, y, 1, 1)
      })
    })
  }, [])
  return <canvas ref={ref} aria-hidden="true" />
})

interface PalcoProps {
  motor: MotorDaDanca
  colegas: readonly { playerId: string; nome: string }[]
  placares: Readonly<Record<string, DancaPlacarAoVivo>>
}

/**
 * O PALCO EM PIXEL ART: o canvas que o motor desenha a cada quadro, as
 * etiquetas com o nome de quem dança (o motor põe cada uma nos pés do dono) e
 * a mesa-mini com a precisão de todos. Os colegas além de 4 aparecem só na mesa.
 */
export function Palco({ motor, colegas, placares }: PalcoProps) {
  const containerRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mesaEuRef = useRef<HTMLElement>(null)
  const noPalco = colegas.slice(0, COLEGAS_NO_PALCO)
  const quem = noPalco.map((c) => c.nome).join(', ')

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (container === null || canvas === null) return
    motor.ligarPalco({ container, canvas, mesaEu: mesaEuRef.current })
    return () => motor.ligarPalco(null)
  }, [motor])

  // Etiquetas novas (colegas chegaram no "começar"): o motor recoloca cada uma no lugar.
  const chaveDosColegas = noPalco.map((c) => c.playerId).join('|')
  useEffect(() => {
    motor.remedir()
  }, [motor, chaveDosColegas])

  return (
    <section ref={containerRef} className="dz-palco" aria-label={quem ? `Pista de dança: você no centro, ${quem} ao lado, a porta ao fundo` : 'Pista de dança: você no centro, a porta ao fundo'}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="dz-mesa-mini" aria-label="Precisão de cada dançarino">
        <span>Você</span>
        <b ref={mesaEuRef}>—</b>
        {colegas.map((c) => {
          const placar = placares[c.playerId]
          return [<span key={`n${c.playerId}`}>{c.nome}</span>, <b key={`p${c.playerId}`}>{placar !== undefined && placar.julgadas > 0 ? fmtPct(placar.precisao) : '—'}</b>]
        })}
      </div>
      <span className="dz-tag dz-tag--voce" data-lugar="voce">
        Você
      </span>
      {noPalco.map((c, i) => (
        <span key={c.playerId} className="dz-tag" data-lugar={i}>
          {c.nome}
        </span>
      ))}
    </section>
  )
}
