import { useEffect, useRef, type PointerEvent as EventoDePonteiro } from 'react'
import { ROTULO_TECLA, type ModoTeclas } from '../entrada'
import { DIF } from '../regras'
import type { DificuldadeDanca, TrilhaDanca } from '../tipos'
import type { InstantaneoDoMotor, MotorDaDanca } from './motor'

const TRILHAS: readonly { lane: TrilhaDanca; nome: string }[] = [
  { lane: 0, nome: 'Esquerda' },
  { lane: 1, nome: 'Baixo' },
  { lane: 2, nome: 'Cima' },
  { lane: 3, nome: 'Direita' },
]

/** A seta grossa da pista, apontando para baixo (o CSS gira por trilha). */
function Seta() {
  return (
    <svg viewBox="-1 -1 2 2" aria-hidden="true">
      <path d="M-.34-.92H.34V.02H.8L0 .9-.8.02H-.34Z" />
    </svg>
  )
}

interface PistaProps {
  motor: MotorDaDanca
  inst: InstantaneoDoMotor
  dif: DificuldadeDanca
  teclas: ModoTeclas
  aoTocarMusica: () => void
  aoSair: () => void
}

/**
 * PISTA: placar no topo (pontos, precisão, vida no Expert, barra da música),
 * as 4 trilhas no canvas que o motor desenha, o 3-2-1, o julgamento e o combo
 * por cima, e os 4 botões grandes para o dedo. A pausa cobre a pista.
 */
export function Pista({ motor, inst, dif, teclas, aoTocarMusica, aoSair }: PistaProps) {
  const campo = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const contagem = useRef<HTMLDivElement>(null)
  const aguarde = useRef<HTMLParagraphElement>(null)
  const julg = useRef<HTMLDivElement>(null)
  const combo = useRef<HTMLDivElement>(null)
  const comboN = useRef<HTMLElement>(null)
  const pontos = useRef<HTMLSpanElement>(null)
  const precisao = useRef<HTMLSpanElement>(null)
  const vida = useRef<HTMLDivElement>(null)
  const vidaBarra = useRef<HTMLElement>(null)
  const progresso = useRef<HTMLElement>(null)
  const continuar = useRef<HTMLButtonElement>(null)
  const comVida = DIF[dif].vida
  const pausada = inst.fase === 'pausada'
  const pausaDoMestre = inst.pausadaPeloMestre

  useEffect(() => {
    const el = {
      campo: campo.current,
      canvas: canvas.current,
      contagem: contagem.current,
      aguarde: aguarde.current,
      julg: julg.current,
      combo: combo.current,
      comboN: comboN.current,
      pontos: pontos.current,
      precisao: precisao.current,
      progresso: progresso.current,
    }
    if (Object.values(el).some((v) => v === null)) return
    motor.ligarPista({
      campo: el.campo as HTMLElement,
      canvas: el.canvas as HTMLCanvasElement,
      contagem: el.contagem as HTMLElement,
      aguarde: el.aguarde as HTMLElement,
      julg: el.julg as HTMLElement,
      combo: el.combo as HTMLElement,
      comboN: el.comboN as HTMLElement,
      pontos: el.pontos as HTMLElement,
      precisao: el.precisao as HTMLElement,
      progresso: el.progresso as HTMLElement,
      vida: vida.current,
      vidaBarra: vidaBarra.current,
    })
    campo.current?.focus({ preventScroll: true })
    return () => motor.ligarPista(null)
  }, [motor])

  useEffect(() => {
    if (pausada && !pausaDoMestre) continuar.current?.focus({ preventScroll: true })
    else if (!pausada) campo.current?.focus({ preventScroll: true })
  }, [pausada, pausaDoMestre])

  const apertou = (lane: TrilhaDanca) => (e: EventoDePonteiro<HTMLButtonElement>) => {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Sem captura (ponteiro já solto): o pointerup ainda chega no botão.
    }
    e.currentTarget.dataset.on = '1'
    motor.apertar(lane, `p${e.pointerId}`, e.timeStamp)
  }
  const soltou = (lane: TrilhaDanca) => (e: EventoDePonteiro<HTMLButtonElement>) => {
    e.currentTarget.dataset.on = '0'
    motor.soltar(lane, `p${e.pointerId}`, e.timeStamp)
  }

  return (
    <div className="dz-tela dz-tela--pista">
      <div className="dz-hud">
        <span className="dz-hud__pontos" ref={pontos}>
          0
        </span>
        <span className="dz-hud__prec">
          Precisão <span ref={precisao}>—</span>
        </span>
        <button type="button" className="dz-btn dz-btn--pequeno" onClick={() => motor.alternarPausa()} disabled={pausaDoMestre || inst.fase === 'fim'}>
          Pausar <kbd>Esc</kbd>
        </button>
        {comVida && (
          <div ref={vida} className="dz-vida" role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={60}>
            <span className="dz-rotulo">Vida</span>
            <div>
              <i ref={vidaBarra} />
            </div>
          </div>
        )}
        <div className="dz-barra" aria-hidden="true">
          <i ref={progresso} />
        </div>
      </div>
      <div ref={campo} className="dz-campo" tabIndex={-1} aria-label="Trilhas das setas">
        <canvas ref={canvas} aria-hidden="true" />
        <p ref={aguarde} className="dz-aguarde" hidden>
          Todos prontos. A música começa já.
        </p>
        <div ref={contagem} className="dz-contagem" aria-hidden="true" />
        <div ref={julg} className="dz-julg" aria-hidden="true" />
        <div ref={combo} className="dz-combo" aria-hidden="true" hidden>
          <b ref={comboN}>0</b>
          <span>combo</span>
        </div>
        {inst.precisaDeToque && inst.fase !== 'fim' && (
          <div className="dz-tocar">
            <p>O navegador segurou a música. Toque para entrar no ponto em que os outros estão.</p>
            <button type="button" className="dz-btn dz-btn--primario" onClick={aoTocarMusica}>
              Tocar a música
            </button>
          </div>
        )}
      </div>
      <div className="dz-pads" role="group" aria-label="Setas para tocar">
        {TRILHAS.map(({ lane, nome }) => (
          <button
            key={lane}
            type="button"
            className="dz-pad"
            data-lane={lane}
            aria-label={nome}
            onPointerDown={apertou(lane)}
            onPointerUp={soltou(lane)}
            onPointerCancel={soltou(lane)}
            onLostPointerCapture={soltou(lane)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Seta />
            <kbd>{ROTULO_TECLA[teclas][lane]}</kbd>
          </button>
        ))}
      </div>
      {pausada && (
        <div className="dz-pausa">
          <div className="dz-pausa__caixa" role="dialog" aria-modal="true" aria-labelledby="dz-pausa-titulo">
            <h2 id="dz-pausa-titulo">{pausaDoMestre ? 'O mestre pausou a dança' : 'Pausado'}</h2>
            <p className="dz-nota">
              {pausaDoMestre ? 'A música volta quando o mestre retomar, com 3, 2, 1.' : 'A música para no ponto em que está. Ao continuar, conta 3, 2, 1.'}
            </p>
            {!pausaDoMestre && (
              <button ref={continuar} type="button" className="dz-btn dz-btn--primario dz-btn--bloco" onClick={() => motor.retomar('jogador')}>
                Continuar
              </button>
            )}
            <button type="button" className="dz-btn dz-btn--fantasma dz-btn--bloco" onClick={aoSair}>
              Sair da dança
            </button>
            <p className="dz-nota">Sair encerra a sua dança: as setas que faltam contam como erro.</p>
          </div>
        </div>
      )}
    </div>
  )
}
