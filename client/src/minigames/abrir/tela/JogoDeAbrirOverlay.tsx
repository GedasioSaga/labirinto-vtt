import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type JSX, type PointerEvent as PointerDoReact, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { estaCalado, PREFERENCIA_DE_SOM_PADRAO, percentualDoVolume, useSomStore } from '../../../stores/somStore'
import { abafarJogo, GANHO_SUSTO, tocarSusto } from '../../armadilha/som'
import { ganhoDaMesa } from '../../danca/tela/audioDaDanca'
import { H, W } from '../desenho'
import type { JogoDoObjeto } from '../objeto'
import { LIMITE_S, NOME_DA_DIFICULDADE } from '../tipos'
import { JOGOS_NA_TELA } from './jogos'
import { MotorDeAbrir, type AmbienteDoMotor, type FaseDoMotor } from './motor'
import { armazemDoNavegador, gravarPreferencias, lerPreferencias, type ArmazemDeAbrir, type PreferenciasDeAbrir } from './preferencias'
import { FRASE_DO_SUSTO, linhaDaArmadilha, resumoDoAchado, textoDasMoedas } from './textos'
import './abrir.css'

export type { JogoDoObjeto } from '../objeto'

/** O que o host decidiu ao abrir (chega depois do `aoVencer`). */
export interface DesfechoDoObjetoNoJogador {
  armadilha: 'cobra' | 'aranha' | null
  /** false = o mapa desligou o susto: a versão parada (como no movimento reduzido), com som. */
  jumpscare: boolean
  itens: { nome: string; quantidade: number }[]
  moedas: number
  /** PV perdidos (0 sem armadilha). */
  dano: number
  /** 'Envenenado' | 'Lento' | null */
  efeito: string | null
  turnos: number
}

/** O som do jogo: o contexto, as saídas do jogo e do susto e o volume da mesa. */
export interface AudioDeAbrir {
  ctx: BaseAudioContext
  /** Saída dos efeitos do jogo, com o ganho do jogo. */
  jogo: AudioNode
  /** Saída dos sustos, com `GANHO_SUSTO`. */
  susto: AudioNode
  /** Abaixa o jogo enquanto o bicho aparece (o susto passa por cima). */
  abafar(bicho: 'cobra' | 'aranha'): void
  definirGanho(ganho: number): void
  retomar(): void
  fechar(): void
}

export type CriarAudioDeAbrir = (ganho: number, ganhoDoJogo: number) => AudioDeAbrir | null

export interface JogoDeAbrirOverlayProps {
  jogo: JogoDoObjeto
  /** 'Baú', 'Caixa', 'Barril' ou o nome que o mestre deu. */
  nomeDoObjeto: string
  semente: number
  dificuldade: 'normal' | 'dificil'
  /** Uma vez, quando o jogo abre; depois a tela anima a abertura e espera o `desfecho`. */
  aoVencer(): void
  /** Fechar ou Esc; antes de vencer, é desistir sem consequência. */
  aoFechar(): void
  /** Chega do host depois do `aoVencer`. */
  desfecho: DesfechoDoObjetoNoJogador | null
  /** O host recusou (ex.: 'Alguém já abriu.'): mostra o texto e o Fechar. */
  recusa?: string | null
  /** Trocas para o teste e a vitrine; o app usa as do navegador. */
  robo?: boolean
  ambiente?: AmbienteDoMotor
  criarAudio?: CriarAudioDeAbrir
  armazem?: ArmazemDeAbrir | null
}

/** Troca de volume sem estalo. */
const SUAVIZAR_GANHO_S = 0.02
/** A tela some com um fade curto antes de avisar quem montou. */
const SAIDA_MS = 180
/** O som sai um pouco depois do agora, para o agendamento não cair no passado. */
const FOLGA_DO_SOM_S = 0.005

export const criarAudioDoNavegador: CriarAudioDeAbrir = (ganho, ganhoDoJogo) => {
  if (typeof AudioContext !== 'function') return null
  try {
    const ctx = new AudioContext()
    const volume = ctx.createGain()
    volume.gain.value = ganho
    volume.connect(ctx.destination)
    const jogo = ctx.createGain()
    jogo.gain.value = ganhoDoJogo
    jogo.connect(volume)
    const susto = ctx.createGain()
    susto.gain.value = GANHO_SUSTO
    susto.connect(volume)
    return {
      ctx,
      jogo,
      susto,
      abafar: (bicho) => abafarJogo(jogo.gain, ganhoDoJogo, bicho, ctx.currentTime + FOLGA_DO_SOM_S),
      definirGanho: (g) => volume.gain.setTargetAtTime(g, ctx.currentTime, SUAVIZAR_GANHO_S),
      retomar: () => {
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      },
      fechar: () => void ctx.close().catch(() => undefined),
    }
  } catch {
    return null
  }
}

/**
 * JOGOS DE ABRIR na tela do jogador (baú dos Fechos Teimosos, caixa com pé
 * de cabra e barril no ritmo dos aros): camada de tela cheia por cima do
 * mapa, do "Começar" ao cartão do que tinha dentro. Porte da vitrine aprovada
 * em ~/jogos/bau-e-armadilhas (15/11/2026), sem mudar jogo nem número. Uma
 * montagem por objeto aberto.
 */
export function JogoDeAbrirOverlay(props: JogoDeAbrirOverlayProps): JSX.Element {
  return createPortal(<TelaDeAbrir key={`${props.jogo}|${props.semente}`} {...props} />, document.body)
}

type Tela = FaseDoMotor | 'recusa'

function movimentoReduzido(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
}

/**
 * Encaixa a cena (canvas + dica) no palco: escala inteira a partir de 2x
 * (pixel nítido), fracionária abaixo disso (celular), como o `usarEncaixe` da
 * pesca. Aqui o tamanho vai na caixa da cena, e a escala vira `--ab-escala`
 * (a letra da dica acompanha a tela).
 */
function usarEncaixeDaCena(palco: RefObject<HTMLElement | null>, cena: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const p = palco.current
    const c = cena.current
    if (p === null || c === null) return
    const medir = (): void => {
      const pw = p.clientWidth
      const ph = p.clientHeight
      if (pw <= 0 || ph <= 0) return
      let s = Math.min(pw / W, ph / H)
      s = s >= 2 ? Math.floor(s) : Math.max(0.5, s)
      c.style.width = `${Math.round(W * s)}px`
      c.style.height = `${Math.round(H * s)}px`
      c.style.setProperty('--ab-escala', s.toFixed(3))
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(p)
    return () => ro.disconnect()
  }, [palco, cena])
}

/** A área da dica em % da cena (acompanha qualquer escala). */
function estiloDaDica([x, y, w, h]: readonly [number, number, number, number]): { left: string; top: string; maxWidth: string; maxHeight: string } {
  const pct = (v: number, total: number): string => `${((v / total) * 100).toFixed(3)}%`
  return { left: pct(x, W), top: pct(y, H), maxWidth: pct(w, W), maxHeight: pct(h, H) }
}

/** Foco em botão, link ou campo: a tecla é dele, não do jogo. */
function focoEmControle(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest('button, a, input, textarea, select') !== null
}

function TelaDeAbrir({
  jogo: idDoJogo, nomeDoObjeto, semente, dificuldade, aoVencer, aoFechar, desfecho, recusa = null,
  robo = false, ambiente, criarAudio = criarAudioDoNavegador, armazem,
}: JogoDeAbrirOverlayProps) {
  const jogo = JOGOS_NA_TELA[idDoJogo]
  const aoVencerRef = useRef(aoVencer)
  aoVencerRef.current = aoVencer
  const aoFecharRef = useRef(aoFechar)
  aoFecharRef.current = aoFechar
  const desfechoRef = useRef(desfecho)
  desfechoRef.current = desfecho
  const [motor] = useState(() => new MotorDeAbrir(jogo, dificuldade, String(semente), { ambiente, robo, reduzido: movimentoReduzido()?.matches === true }))
  const inst = useSyncExternalStore(motor.assinar, motor.lerInstantaneo)
  const armazemDaTela = useMemo(() => (armazem === undefined ? armazemDoNavegador() : armazem), [armazem])
  const [prefs, setPrefs] = useState<PreferenciasDeAbrir>(() => lerPreferencias(armazemDaTela))
  const [saindo, setSaindo] = useState(false)
  const saidaRef = useRef<number | null>(null)
  const tentativasRef = useRef(0)
  const venceuRef = useRef(false)
  const audioRef = useRef<AudioDeAbrir | null>(null)
  const [dicaVisivel, setDicaVisivel] = useState(false)
  const palcoRef = useRef<HTMLElement>(null)
  const cenaRef = useRef<HTMLDivElement>(null)
  const telaRef = useRef<HTMLCanvasElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const idDoTitulo = useId()
  usarEncaixeDaCena(palcoRef, cenaRef)

  const volume = useSomStore((s) => s.volume)
  const mudo = useSomStore((s) => s.mudo)
  const somAtivo = prefs.som && !estaCalado({ volume, mudo })
  const ganho = somAtivo ? ganhoDaMesa({ volume, mudo }) : 0
  const ganhoRef = useRef(ganho)
  ganhoRef.current = ganho

  const tela: Tela = recusa !== null ? 'recusa' : inst.fase

  // ---------------------------------------------------------------- áudio

  /** Cria (ou retoma) o áudio. Só funciona de verdade dentro de um gesto (toque, tecla, clique). */
  const garantirAudio = useCallback((): void => {
    const atual = audioRef.current
    if (atual !== null) {
      atual.retomar()
      return
    }
    audioRef.current = criarAudio(ganhoRef.current, jogo.ganho)
  }, [criarAudio, jogo])

  useEffect(() => {
    audioRef.current?.definirGanho(ganho)
  }, [ganho])

  useEffect(() => {
    gravarPreferencias(armazemDaTela, prefs)
  }, [armazemDaTela, prefs])

  // ---------------------------------------------------------------- motor

  useEffect(() => {
    motor.ganchos = {
      som: (ev, origem) => {
        const a = audioRef.current
        if (a === null || ganhoRef.current <= 0) return
        const t = a.ctx.currentTime + FOLGA_DO_SOM_S
        if (origem === 'jogo') jogo.tocar(a.ctx, a.jogo, ev, t)
        else tocarSusto(a.ctx, a.susto, ev, t)
      },
      fase: (f) => {
        const bicho = desfechoRef.current?.armadilha ?? null
        if (f === 'susto' && bicho !== null) audioRef.current?.abafar(bicho)
      },
      venceu: () => {
        if (venceuRef.current) return
        venceuRef.current = true
        aoVencerRef.current()
      },
      primeiraEntrada: () => setDicaVisivel(false),
    }
    motor.iniciar()
    const consulta = movimentoReduzido()
    const mudou = (): void => {
      motor.reduzido = consulta?.matches === true
    }
    consulta?.addEventListener('change', mudou)
    return () => {
      consulta?.removeEventListener('change', mudou)
      motor.destruir()
      audioRef.current?.fechar()
      audioRef.current = null
      if (saidaRef.current !== null) window.clearTimeout(saidaRef.current)
    }
  }, [motor, jogo])

  useEffect(() => {
    motor.definirTela(telaRef.current?.getContext('2d') ?? null)
    return () => motor.definirTela(null)
  }, [motor])

  useEffect(() => {
    motor.definirDesfecho(desfecho === null ? null : { armadilha: desfecho.armadilha, jumpscare: desfecho.jumpscare })
  }, [motor, desfecho])

  // ---------------------------------------------------------------- ações

  const fechar = useCallback((): void => {
    if (saidaRef.current !== null) return
    setSaindo(true)
    saidaRef.current = window.setTimeout(() => aoFecharRef.current(), SAIDA_MS)
  }, [])

  const comecar = (): void => {
    garantirAudio()
    tentativasRef.current++
    // A primeira tentativa usa a semente do host; o "Tentar de novo", uma nova (local, sem consequência).
    motor.comecar(`${semente}|${tentativasRef.current}`)
    setDicaVisivel(true)
    palcoRef.current?.focus({ preventScroll: true })
  }

  const alternarSom = (): void => {
    if (somAtivo) {
      setPrefs({ som: false })
      return
    }
    // Som da mesa calado: ligar aqui liga a mesa também, senão o botão mentiria.
    const loja = useSomStore.getState()
    if (loja.mudo) loja.alternarMudo()
    if (!(percentualDoVolume(loja.volume) > 0)) loja.setVolume(PREFERENCIA_DE_SOM_PADRAO.volume)
    garantirAudio()
    setPrefs({ som: true })
  }

  // ---------------------------------------------------------------- teclado e foco da janela

  useEffect(() => {
    const desceu = (e: KeyboardEvent): void => {
      // Tela modal: o mapa atrás não ouve as teclas (setas e WASD mexeriam a ficha).
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey || e.altKey) return
      garantirAudio()
      if (e.code === 'Escape') {
        e.preventDefault()
        fechar()
        return
      }
      if (motor.faseAtual !== 'jogando' || focoEmControle(e.target)) return
      const alvo = jogo.teclas[e.code]
      if (alvo === undefined) return
      e.preventDefault()
      if (!e.repeat) motor.apertar(`k${e.code}`, alvo)
    }
    const subiu = (e: KeyboardEvent): void => {
      e.stopPropagation()
      motor.soltar(`k${e.code}`)
    }
    const perdeuFoco = (): void => motor.soltarTudo()
    const visibilidade = (): void => {
      if (document.hidden) motor.pausar()
      else motor.retomar()
    }
    window.addEventListener('keydown', desceu, true)
    window.addEventListener('keyup', subiu, true)
    window.addEventListener('blur', perdeuFoco)
    document.addEventListener('visibilitychange', visibilidade)
    return () => {
      window.removeEventListener('keydown', desceu, true)
      window.removeEventListener('keyup', subiu, true)
      window.removeEventListener('blur', perdeuFoco)
      document.removeEventListener('visibilitychange', visibilidade)
    }
  }, [motor, jogo, garantirAudio, fechar])

  // Cartão novo: o foco vai ao botão dele; jogando, ao palco (as teclas do jogo valem ali).
  useEffect(() => {
    const alvo = botaoRef.current ?? (tela === 'jogando' ? palcoRef.current : null)
    alvo?.focus({ preventScroll: true })
  }, [tela])

  // ---------------------------------------------------------------- ponteiro

  const soltarPonteiro = (e: PointerDoReact<HTMLElement>): void => motor.soltar(`p${e.pointerId}`)

  const apertarPonteiro = (e: PointerDoReact<HTMLElement>): void => {
    if (e.button > 0 || motor.faseAtual !== 'jogando' || focoEmControle(e.target)) return
    const cv = telaRef.current
    if (cv === null) return
    const r = cv.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const alvo = motor.alvoEm(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H)
    if (alvo < 0) return
    e.preventDefault()
    garantirAudio()
    palcoRef.current?.focus({ preventScroll: true })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Sem captura (ponteiro já solto): o soltar chega pelo pointerup.
    }
    motor.apertar(`p${e.pointerId}`, alvo)
  }

  // ---------------------------------------------------------------- leitor de tela

  const bicho = desfecho?.armadilha ?? null
  const linhaDoBicho = desfecho === null ? null : linhaDaArmadilha(desfecho)
  const anuncio = (() => {
    switch (tela) {
      case 'recusa':
        return recusa ?? ''
      case 'jogando':
        return `Valendo: a vela marca ${LIMITE_S} segundos. ${jogo.objetivo}`
      case 'aguardando':
        return 'Abrindo…'
      case 'susto':
        return bicho === null ? '' : FRASE_DO_SUSTO[bicho]
      case 'abriu':
        return desfecho === null ? 'Abriu!' : ['Abriu!', linhaDoBicho, resumoDoAchado(desfecho)].filter((p) => p !== null).join(' ')
      case 'naoAbriu':
        return 'Não abriu: a vela apagou.'
      default:
        return ''
    }
  })()

  const nomeDaDif = NOME_DA_DIFICULDADE[dificuldade]

  return (
    <div className="lb-abrir" data-saindo={saindo} role="dialog" aria-modal="true" aria-label={`Abrir: ${nomeDoObjeto}`} onPointerDownCapture={garantirAudio}>
      <header className="ab-topo">
        <p className="ab-titulo">
          <b>{nomeDoObjeto}</b>
          <span className="ab-dif">{nomeDaDif}</span>
        </p>
        {tela === 'jogando' && (
          <p className="ab-hud">
            <span>{inst.restaS} s</span>
            <span aria-hidden="true">·</span>
            <span>{inst.progresso}%</span>
          </p>
        )}
        <div className="ab-acoes">
          <button type="button" className="ab-btn ab-btn--sm" aria-pressed={somAtivo} onClick={alternarSom}>
            {somAtivo ? 'Som ligado' : 'Som desligado'}
          </button>
          <button type="button" className="ab-btn ab-btn--sm" onClick={fechar}>
            Fechar <kbd>Esc</kbd>
          </button>
        </div>
      </header>

      <section
        ref={palcoRef}
        className="ab-palco"
        tabIndex={-1}
        aria-label={`${jogo.nome}: ${jogo.instrucao}`}
        onPointerDown={apertarPonteiro}
        onPointerUp={soltarPonteiro}
        onPointerCancel={soltarPonteiro}
        onLostPointerCapture={soltarPonteiro}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div ref={cenaRef} className="ab-cena">
          <canvas ref={telaRef} width={W} height={H} aria-hidden="true" />
          {/* Dica de objetivo: na parede livre da cena, some no primeiro toque; o toque passa por ela. */}
          {tela === 'jogando' && (
            <p className="ab-dica" data-oculta={!dicaVisivel} style={estiloDaDica(jogo.areaDaDica)}>
              {jogo.objetivo}
            </p>
          )}
        </div>

        {tela === 'aguardando' && <p className="ab-abrindo">Abrindo…</p>}

        {tela === 'parado' && (
          <section className="ab-cartao" aria-labelledby={idDoTitulo}>
            <h2 id={idDoTitulo} className="ab-cartao__titulo">
              {nomeDoObjeto} <span className="ab-dif">{nomeDaDif}</span>
            </h2>
            <p>{jogo.instrucao}</p>
            <p className="ab-nota">A vela marca {LIMITE_S} s. Se apagar, dá para tentar de novo.</p>
            <button ref={botaoRef} type="button" className="ab-btn ab-btn--primario ab-btn--bloco" onClick={comecar}>
              Começar
            </button>
          </section>
        )}

        {tela === 'naoAbriu' && (
          <section className="ab-cartao" aria-labelledby={idDoTitulo}>
            <h2 id={idDoTitulo} className="ab-cartao__titulo">
              Não abriu
            </h2>
            <p>A vela apagou. Tentar de novo não tem consequência.</p>
            <button ref={botaoRef} type="button" className="ab-btn ab-btn--primario ab-btn--bloco" onClick={comecar}>
              Tentar de novo
            </button>
          </section>
        )}

        {tela === 'abriu' && desfecho !== null && (
          <section className="ab-cartao" aria-labelledby={idDoTitulo}>
            <h2 id={idDoTitulo} className="ab-cartao__titulo">
              Abriu!
            </h2>
            {linhaDoBicho !== null && <p className="ab-armadilha">{linhaDoBicho}</p>}
            {desfecho.itens.length > 0 && (
              <ul className="ab-itens" aria-label="Itens">
                {desfecho.itens.map((item, k) => (
                  <li key={`${k}|${item.nome}`}>
                    <span>{item.nome}</span>
                    <b>×{item.quantidade}</b>
                  </li>
                ))}
              </ul>
            )}
            {desfecho.moedas > 0 && <p className="ab-moedas">{textoDasMoedas(desfecho.moedas)}</p>}
            {desfecho.itens.length === 0 && desfecho.moedas <= 0 && <p className="ab-nota">Estava vazio.</p>}
            <button ref={botaoRef} type="button" className="ab-btn ab-btn--primario ab-btn--bloco" onClick={fechar}>
              Fechar
            </button>
          </section>
        )}

        {tela === 'recusa' && (
          <section className="ab-cartao" aria-labelledby={idDoTitulo}>
            <h2 id={idDoTitulo} className="ab-cartao__titulo">
              Não deu para abrir
            </h2>
            <p>{recusa}</p>
            <button ref={botaoRef} type="button" className="ab-btn ab-btn--primario ab-btn--bloco" onClick={fechar}>
              Fechar
            </button>
          </section>
        )}
      </section>

      <footer className="ab-rodape">{tela === 'jogando' && <p className="ab-instrucao">{jogo.instrucao}</p>}</footer>

      <p className="ab-sr" aria-live="polite">
        {anuncio}
      </p>
    </div>
  )
}
