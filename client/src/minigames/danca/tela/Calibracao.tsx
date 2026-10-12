import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { somDeClique } from '../som'
import type { AudioDaDanca } from './audioDaDanca'
import { limitarAjuste } from './preferencias'
import { fmtMs } from './textos'

/** O que a tela (teclado e controle) chama durante a medição. */
export interface ToqueDaCalibracao {
  ativa: boolean
  toque(perfMs: number): void
}

interface CalibracaoProps {
  ajusteMs: number
  aoMudarAjuste: (ms: number) => void
  aoVoltar: () => void
  /** Cria ou retoma o áudio DENTRO do gesto do "Começar a medir". */
  garantirAudio: () => AudioDaDanca | null
  ligacao: MutableRefObject<ToqueDaCalibracao | null>
}

/** Metrônomo: 4 batidas para entrar e 8 para medir, a 100 BPM. */
const INTERVALO_S = 0.6
const BATIDAS_DE_ENTRADA = 4
const BATIDAS_MEDIDAS = 8
/** Toque a mais de 250 ms de qualquer batida não é toque no tempo: fica de fora da média. */
const LONGE_DEMAIS_S = 0.25
/** Menos que isso de 8 toques não dá média confiável. */
const TOQUES_MINIMOS = 5
/** A régua mostra de 200 ms antes a 200 ms depois. */
const REGUA_MS = 200
const PASSO_MANUAL_MS = 5

interface Medicao {
  batidas: number[]
  toques: number[]
  fimS: number
}

/**
 * AJUSTAR ATRASO: o jogador toca junto com o metrônomo, pelo que ouve; a média
 * aparada dos toques vira o ajuste. Para fone sem fio e TV, que atrasam o som
 * de um jeito que o navegador não conta. Também dá para ajustar à mão.
 */
export function Calibracao({ ajusteMs, aoMudarAjuste, aoVoltar, garantirAudio, ligacao }: CalibracaoProps) {
  const [ativa, setAtiva] = useState(false)
  const [status, setStatus] = useState('')
  const [marcas, setMarcas] = useState<number[]>([])
  const [ponto, setPonto] = useState(-1)
  const [medido, setMedido] = useState<number | null>(null)
  const [jaMediu, setJaMediu] = useState(false)
  const medicao = useRef<Medicao | null>(null)
  const audioRef = useRef<AudioDaDanca | null>(null)
  const raf = useRef<number | null>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    tituloRef.current?.focus({ preventScroll: true })
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      ligacao.current = null
    }
  }, [ligacao])

  function concluir(): void {
    const m = medicao.current
    medicao.current = null
    setAtiva(false)
    setJaMediu(true)
    if (m === null) return
    const v = [...m.toques].sort((a, b) => a - b)
    if (v.length < TOQUES_MINIMOS) {
      setMedido(null)
      setStatus(`Poucos toques (${v.length} de ${BATIDAS_MEDIDAS}). Meça de novo tocando em todas as batidas.`)
      return
    }
    // Média aparada: o toque mais cedo e o mais tarde saem (um tropeço não puxa a média).
    const meio = v.length >= 6 ? v.slice(1, -1) : v
    const media = Math.round(meio.reduce((a, b) => a + b, 0) / meio.length)
    setMedido(media)
    setStatus(media >= 0 ? `Seus toques chegam ${media} ms depois do som.` : `Seus toques chegam ${-media} ms antes do som.`)
  }

  function toque(perfMs: number): void {
    const m = medicao.current
    const audio = audioRef.current
    if (m === null || audio === null) return
    const t = audio.relogio.ouvidoEm(perfMs)
    let melhor: number | null = null
    for (const b of m.batidas) if (melhor === null || Math.abs(t - b) < Math.abs(melhor)) melhor = t - b
    if (melhor === null || Math.abs(melhor) > LONGE_DEMAIS_S) return
    const ms = melhor * 1000
    m.toques.push(ms)
    setMarcas((atual) => [...atual, ms])
  }

  useEffect(() => {
    // A tela (teclado, controle) toca por aqui; só vale com a medição rodando.
    ligacao.current = { ativa, toque }
  })

  async function comecar(): Promise<void> {
    const audio = garantirAudio()
    if (audio === null) {
      setStatus('Este navegador não deixou tocar o metrônomo. Confira se o som do aparelho está ligado.')
      return
    }
    audioRef.current = audio
    const rodando = await audio.retomar()
    if (!rodando) {
      setStatus('O navegador segurou o som. Toque em "Começar a medir" de novo.')
      return
    }
    const ctx = audio.ctx
    const inicio = ctx.currentTime + 0.3
    const t0 = inicio + BATIDAS_DE_ENTRADA * INTERVALO_S
    const batidas = Array.from({ length: BATIDAS_MEDIDAS }, (_, i) => t0 + i * INTERVALO_S)
    for (let i = 0; i < BATIDAS_DE_ENTRADA + BATIDAS_MEDIDAS; i += 1) somDeClique(ctx, audio.efeitos, inicio + i * INTERVALO_S, i === 0 || i === BATIDAS_DE_ENTRADA)
    audio.relogio.reiniciar()
    medicao.current = { batidas, toques: [], fimS: batidas[batidas.length - 1] + 0.5 }
    setMarcas([])
    setMedido(null)
    setPonto(-1)
    setAtiva(true)
    setStatus('Escute 4 batidas e comece a tocar na quinta.')
    const passo = (): void => {
      const m = medicao.current
      if (m === null) return
      const t = audio.relogio.ouvidoEm(performance.now())
      const atual = m.batidas.findIndex((b) => b > t) - 1
      setPonto(atual === -2 ? BATIDAS_MEDIDAS - 1 : atual)
      if (t > m.fimS) {
        concluir()
        return
      }
      raf.current = requestAnimationFrame(passo)
    }
    raf.current = requestAnimationFrame(passo)
  }

  const definir = (ms: number): void => aoMudarAjuste(limitarAjuste(ms))

  return (
    <div className="dz-tela">
      <button type="button" className="dz-btn dz-btn--fantasma dz-btn--pequeno dz-voltar" onClick={aoVoltar}>
        ‹ Voltar ao convite
      </button>
      <h2 ref={tituloRef} className="dz-titulo" tabIndex={-1}>
        Ajustar atraso
      </h2>
      <p className="dz-texto">
        Toque junto com o metrônomo, pelo que você ouve. São 4 batidas para entrar no tempo e 8 para medir. Vale qualquer seta, a barra de espaço ou o quadro abaixo.
      </p>
      <div className="dz-pontos" aria-hidden="true">
        {Array.from({ length: BATIDAS_MEDIDAS }, (_, i) => (
          <i key={i} data-on={i <= ponto ? '1' : '0'} />
        ))}
      </div>
      <div>
        <div className="dz-regua" aria-hidden="true">
          {marcas.map((ms, i) => (
            <i key={i} style={{ left: `${50 + (Math.max(-REGUA_MS, Math.min(REGUA_MS, ms)) / REGUA_MS) * 50}%` }} />
          ))}
        </div>
        <div className="dz-regua__legenda" aria-hidden="true">
          <span>200 ms antes</span>
          <span>na batida</span>
          <span>200 ms depois</span>
        </div>
      </div>
      <button
        type="button"
        className="dz-alvo"
        onPointerDown={(e) => {
          e.preventDefault()
          toque(e.timeStamp)
        }}
      >
        Toque aqui no tempo
      </button>
      <button type="button" className="dz-btn dz-btn--primario dz-btn--bloco" disabled={ativa} onClick={() => void comecar()}>
        {jaMediu ? 'Medir de novo' : 'Começar a medir'}
      </button>
      <p className="dz-status" role="status">
        {status}
      </p>
      {medido !== null && (
        <div>
          <button type="button" className="dz-btn dz-btn--primario" onClick={() => definir(medido)}>
            Usar {fmtMs(medido)}
          </button>
        </div>
      )}
      <div className="dz-manual">
        <span className="dz-rotulo">Ajuste à mão</span>
        <button type="button" className="dz-btn dz-btn--pequeno" aria-label="Diminuir 5 ms" onClick={() => definir(ajusteMs - PASSO_MANUAL_MS)}>
          −5
        </button>
        <output aria-live="polite">{fmtMs(ajusteMs)}</output>
        <button type="button" className="dz-btn dz-btn--pequeno" aria-label="Aumentar 5 ms" onClick={() => definir(ajusteMs + PASSO_MANUAL_MS)}>
          +5
        </button>
        <button type="button" className="dz-btn dz-btn--fantasma dz-btn--pequeno" onClick={() => definir(0)}>
          Zerar
        </button>
      </div>
      <p className="dz-nota">Positivo: as setas chegam mais tarde, para quem ouve com atraso (fone sem fio, TV). O ajuste fica guardado neste aparelho.</p>
    </div>
  )
}
