import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as PointerDoReact, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { TiroDesfecho, TiroNumeros, TiroParticipante, TiroStatus, TiroUltimaRodada, TiroVivo } from '../../../net/protocoloDoTiro'
import { tiroAceitaPronto, tiroAtirando, type TiroDoJogador } from '../../../player/estadoDoTiro'
import { estaCalado, PREFERENCIA_DE_SOM_PADRAO, percentualDoVolume, useSomStore } from '../../../stores/somStore'
import { ganhoDaMesa } from '../../danca/tela/audioDaDanca'
import { usarEncaixe } from '../../pesca/tela/Telas'
import { H, W, type DificuldadeSim } from '../sim'
import { cadeia, SONS } from '../som'
import type { MedalhaTiro } from '../tipos'
import { AMBIENTE_DO_NAVEGADOR, MotorDoTiro, type AmbienteDoTiro, type InstantaneoDoTiro, type ResultadoDaRodada } from './motor'
import { armazemDoNavegador, gravarPreferencias, lerPreferencias, type ArmazemDoTiro, type PreferenciasDoTiro } from './preferencias'
import { ARCO_DA_CARGA, Convite, Jogo, Pausa, Resultado, type PinturaDoQuadro } from './Telas'
import { NOMES_MED } from './textos'
import './tiro.css'

/** O que a tela pede à conexão do jogador (`PlayerConnection`). */
export interface AcoesDoTiro {
  prontoTiro(dificuldade: DificuldadeSim): boolean
  vivoTiro(vivo: Omit<TiroVivo, 'rodada'>): boolean
  fimTiro(fim: TiroNumeros & { desfecho: TiroDesfecho }): boolean
  fecharTiro(): void
}

/** O som do tiro: o contexto e a entrada da cadeia do protótipo (ganho + compressor) sob o volume da mesa. */
export interface AudioDoTiro {
  ctx: BaseAudioContext
  fx: AudioNode
  definirGanho(ganho: number): void
  retomar(): void
  fechar(): void
}

export type CriarAudioDoTiro = (ganho: number) => AudioDoTiro | null

/** Troca de volume sem estalo: chega lá em ~60 ms. */
const SUAVIZAR_GANHO_S = 0.02

export const criarAudioDoNavegador: CriarAudioDoTiro = (ganho) => {
  // Só PC (WebView2 e navegadores de mesa): o AudioContext sem prefixo basta.
  if (typeof window.AudioContext !== 'function') return null
  try {
    const ctx = new window.AudioContext()
    const volume = ctx.createGain()
    volume.gain.value = ganho
    volume.connect(ctx.destination)
    const fx = cadeia(ctx, volume)
    return {
      ctx,
      fx,
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

export interface TiroOverlayProps {
  tiro: TiroDoJogador
  playerId: string | undefined
  acoes: AcoesDoTiro
  /** Trocas para o teste; o app usa as do navegador. */
  criarAudio?: CriarAudioDoTiro
  armazem?: ArmazemDoTiro | null
  ambiente?: AmbienteDoTiro
  motor?: MotorDoTiro
  /** Onde a tela entra (o portal). Ausente = o `body`. A Visão de jogador passa a caixa da tela do jogador. */
  raiz?: Element
}

/** O que a página que monta a tela do jogador troca no tiro (a Visão de jogador); o resto vem da conexão. */
export type AjustesDaTelaDoTiro = Pick<TiroOverlayProps, 'raiz'>

/**
 * MINIGAME DE TIRO na tela do jogador: camada de tela cheia por cima do mapa
 * (portal, como a pesca), do convite ao resultado. Palco à esquerda e coluna
 * à direita, como o protótipo aprovado (docs/design/minigame-tiro/prototipo).
 * Liga `state.tiro` ao `MotorDoTiro`: o Pronto vai ao host, a rodada só
 * começa com o `tiro.inicio` dele (a semente e a tentativa são do host), o
 * vivo sai a cada quadro (a conexão limita a 4/s) e o fim uma vez por
 * rodada. Uma montagem por pino: a reabertura do mestre (sessão nova) não
 * apaga o resultado da tela.
 */
export function TiroOverlay(props: TiroOverlayProps) {
  return createPortal(<TelaDoTiro key={props.tiro.convite.pinId} {...props} />, props.raiz ?? document.body)
}

/** A tela some com um fade curto antes de o estado do tiro sair. */
const SAIDA_MS = 180

type Tela = 'convite' | 'jogo' | 'resultado'

function telaDe(inst: InstantaneoDoTiro): Tela {
  if (inst.fase === 'resultado') return 'resultado'
  return inst.fase === 'convite' ? 'convite' : 'jogo'
}

function movimentoReduzido(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
}

/** Por que não dá para começar uma rodada agora; `null` = dá. */
function bloqueioDe(tiro: TiroDoJogador): string | null {
  if (tiro.encerrada === 'mestre') return 'O mestre encerrou a barraca para todos.'
  if (tiro.encerrada === 'saiu') return 'A barraca fechou para você.'
  if (tiro.pausada) return 'O mestre pausou a barraca para todos.'
  if (tiro.usadas >= tiro.convite.tentativas) return 'Acabaram as suas tentativas. O mestre pode liberar mais no painel do pino.'
  return null
}

/** O que este jogador está fazendo, para a mesa no canto do palco (o `textoJogador` do protótipo). */
function meuEstado(inst: InstantaneoDoTiro, pausadaPeloMestre: boolean): string {
  const tela = telaDe(inst)
  if (pausadaPeloMestre && tela === 'jogo') return 'pausado pelo mestre'
  if (inst.pausado) return 'pausou'
  if (tela === 'resultado' && inst.resultado !== null) {
    const r = inst.resultado
    return r.tipo === 'encerrado' ? 'encerrado' : `terminou: ${r.medalha === null ? 'sem medalha' : NOMES_MED[r.medalha]}`
  }
  if (inst.fase === 'contagem') return 'contagem'
  if (inst.fase === 'rodada' || inst.fase === 'fim') return inst.hud.recarregando ? 'recarregando' : 'atirando'
  return 'no convite'
}

const PALAVRA_DO_STATUS: Readonly<Record<TiroStatus, string>> = { convidado: 'no convite', atirando: 'atirando', terminou: 'terminou', saiu: 'saiu' }

/** Um colega na mesa: quem já fechou rodada mostra como ela acabou, igual ao placar do mestre ("terminou: Ouro"). */
function estadoDoColega(p: { status: TiroStatus; ultima?: TiroUltimaRodada }): string {
  if (p.status === 'saiu' || p.status === 'atirando' || p.ultima === undefined) return PALAVRA_DO_STATUS[p.status]
  if (p.ultima === 'encerrado' || p.ultima === 'desistiu') return p.ultima
  return `terminou: ${p.ultima === 'nenhuma' ? 'sem medalha' : NOMES_MED[p.ultima]}`
}

/** Os números da rodada como o `tiro.fim` os leva. */
function numerosDe(r: ResultadoDaRodada): TiroNumeros {
  return { t: r.t, pontos: r.pontos, tiros: r.tiros, acertos: r.acertos, comboMax: r.comboMax, proibidos: r.proibidos, secos: r.secos, recargas: r.recargas, derrubados: r.derrubados }
}

function TelaDoTiro({ tiro, playerId, acoes, criarAudio = criarAudioDoNavegador, armazem, ambiente = AMBIENTE_DO_NAVEGADOR, motor: motorDeFora, raiz }: TiroOverlayProps) {
  const acoesRef = useRef(acoes)
  acoesRef.current = acoes
  const tiroRef = useRef(tiro)
  tiroRef.current = tiro
  const [motor] = useState(() => motorDeFora ?? new MotorDoTiro(ambiente, movimentoReduzido()?.matches === true))
  const inst = useSyncExternalStore(motor.assinar, motor.lerInstantaneo)
  const armazemDaTela = useMemo(() => (armazem === undefined ? armazemDoNavegador() : armazem), [armazem])
  const [prefs, setPrefs] = useState<PreferenciasDoTiro>(() => lerPreferencias(armazemDaTela))
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs
  const { convite } = tiro
  const dif: DificuldadeSim = convite.permitida !== 'escolha' ? convite.permitida : prefs.dif
  const [erro, setErro] = useState<string | null>(null)
  const [saindo, setSaindo] = useState(false)
  const [melhor, setMelhor] = useState<{ medalha: MedalhaTiro | null; pontos: number } | null>(null)
  const audioRef = useRef<AudioDoTiro | null>(null)
  const volume = useSomStore((s) => s.volume)
  const mudo = useSomStore((s) => s.mudo)
  const somAtivo = prefs.som && !estaCalado({ volume, mudo })
  const ganho = somAtivo ? ganhoDaMesa({ volume, mudo }) : 0
  const ganhoRef = useRef(ganho)
  ganhoRef.current = ganho
  const barraRef = useRef<HTMLElement>(null)
  const cargaRef = useRef<SVGCircleElement>(null)
  const pintura = useMemo<PinturaDoQuadro>(() => ({ barra: barraRef, carga: cargaRef }), [])

  const tela = telaDe(inst)
  const telaRef = useRef(tela)
  telaRef.current = tela
  const bloqueio = bloqueioDe(tiro)
  const esperando = tiro.pedindo !== undefined

  // ---------------------------------------------------------------- áudio

  /** Cria (ou retoma) o áudio. Só funciona de verdade dentro de um gesto (clique, tecla). */
  const garantirAudio = useCallback((): void => {
    const atual = audioRef.current
    if (atual !== null) {
      atual.retomar()
      return
    }
    audioRef.current = criarAudio(ganhoRef.current)
  }, [criarAudio])

  useEffect(() => {
    audioRef.current?.definirGanho(ganho)
  }, [ganho])

  useEffect(() => {
    gravarPreferencias(armazemDaTela, prefs)
  }, [armazemDaTela, prefs])

  // ---------------------------------------------------------------- motor

  const vivoEnviado = useRef('')
  const pintado = useRef({ barra: '', carga: '' })
  const confirmarRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    motor.ganchos = {
      som: (nome, v) => {
        const a = audioRef.current
        if (a === null || ganhoRef.current <= 0) return
        if (nome === 'realejo' && !prefsRef.current.realejo) return
        SONS[nome](a.ctx, a.fx, a.ctx.currentTime + 0.005, v)
      },
      fimDaRodada: (r) => {
        if (r.tipo === 'encerrado') return
        if (r.tipo === 'fim') setMelhor((m) => (m === null || r.pontos > m.pontos ? { medalha: r.medalha, pontos: r.pontos } : m))
        const t = tiroRef.current
        // Só a rodada que o host liberou e ainda está aberta: a de outra sessão já foi dada por perdida.
        if (!tiroAtirando(t) || t.rodada.n !== r.rodada) return
        acoesRef.current.fimTiro({ desfecho: r.tipo, ...numerosDe(r) })
      },
      quadro: () => {
        const v = motor.vivoDoQuadro()
        const barra = barraRef.current
        const escala = `scaleX(${v.tempo.toFixed(3)})`
        if (barra !== null && pintado.current.barra !== escala) {
          pintado.current.barra = escala
          barra.style.transform = escala
        }
        const carga = cargaRef.current
        const arco = v.recarga > 0 ? (ARCO_DA_CARGA * v.recarga).toFixed(1) : String(ARCO_DA_CARGA)
        if (carga !== null && pintado.current.carga !== arco) {
          pintado.current.carga = arco
          carga.style.strokeDashoffset = arco
        }
        const t = tiroRef.current
        const R = motor.rodada
        if (!tiroAtirando(t) || R === null || !motor.emJogo || motor.J.rodada !== t.rodada.n) return
        const recarregando = R.recarga > 0
        // Só o que mudou (e o tempo de quarto em quarto de segundo); o que a conexão segurou sai no próximo quadro.
        const chave = `${t.rodada.n}|${R.pontos}|${R.tiros}|${R.acertos}|${R.balas}|${recarregando}|${Math.floor(R.t * 4)}`
        if (chave === vivoEnviado.current) return
        const vivo = { t: Math.round(Math.min(R.t, R.D.tempo) * 1000) / 1000, pontos: R.pontos, tiros: R.tiros, acertos: R.acertos, balas: R.balas, recarregando }
        if (acoesRef.current.vivoTiro(vivo)) vivoEnviado.current = chave
      },
      confirmar: () => confirmarRef.current(),
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
    }
  }, [motor])

  // O host liberou a rodada (o início chegou): começa uma vez por rodada (a reabertura recomeça a conta).
  const comecada = useRef('')
  useEffect(() => {
    const r = tiro.rodada
    const chave = `${tiro.sessao}|${r?.n ?? 0}`
    if (r === undefined || tiro.encerrada !== undefined || comecada.current === chave) return
    comecada.current = chave
    setErro(null)
    motor.comecar(r.dificuldade, r.semente, r.n)
  }, [motor, tiro.sessao, tiro.rodada, tiro.encerrada])

  // A rodada saiu da conexão sem terminar aqui (convite novo, aba nova): o host já a deu por perdida.
  useEffect(() => {
    if (tiro.rodada === undefined && tiro.encerrada === undefined && motor.emJogo) motor.voltarAoConvite()
  }, [motor, tiro.rodada, tiro.encerrada, tiro.convites])

  useEffect(() => {
    motor.definirPausaDoMestre(tiro.pausada)
  }, [motor, tiro.pausada])

  useEffect(() => {
    if (tiro.encerrada !== undefined) motor.encerrar()
    else motor.reabrir()
  }, [motor, tiro.encerrada, tiro.sessao])

  // ---------------------------------------------------------------- teclado e foco da janela

  useEffect(() => {
    const desceu = (e: KeyboardEvent): void => {
      // Tela modal: o mapa atrás não ouve as teclas (setas e WASD mexeriam a ficha).
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey || e.altKey) return
      garantirAudio()
      if (e.target instanceof Element && e.target.closest('input, textarea, select') !== null) return
      if (motor.tecla(e.code, true, e.repeat)) e.preventDefault()
    }
    const subiu = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (motor.tecla(e.code, false, false)) e.preventDefault()
    }
    const perdeuFoco = (): void => motor.soltarTudo()
    const visibilidade = (): void => {
      if (document.hidden) motor.pausar()
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
  }, [motor, garantirAudio])

  // ---------------------------------------------------------------- ações da tela

  const mudarDif = (nova: DificuldadeSim): void => setPrefs((p) => ({ ...p, dif: nova }))

  const comecar = (): void => {
    if (!tiroAceitaPronto(tiroRef.current)) return
    setErro(null)
    garantirAudio()
    if (!acoesRef.current.prontoTiro(dif)) setErro('Não deu para avisar o mestre. Confira a conexão com a sala e tente de novo.')
  }

  const alternarSom = (): void => {
    if (somAtivo) {
      setPrefs((p) => ({ ...p, som: false }))
      return
    }
    // Som da mesa calado: ligar aqui liga a mesa também, senão o botão mentiria.
    const loja = useSomStore.getState()
    if (loja.mudo) loja.alternarMudo()
    if (!(percentualDoVolume(loja.volume) > 0)) loja.setVolume(PREFERENCIA_DE_SOM_PADRAO.volume)
    garantirAudio()
    setPrefs((p) => ({ ...p, som: true }))
  }

  const desistir = (): void => {
    // A tentativa já contou no host: sai sem medalha e volta ao convite, como no protótipo.
    motor.desistir()
    motor.voltarAoConvite()
  }

  const fechar = (): void => {
    if (saindo) return
    setSaindo(true)
    window.setTimeout(() => acoesRef.current.fecharTiro(), SAIDA_MS)
  }

  confirmarRef.current = () => {
    if (tela === 'convite' || tela === 'resultado') comecar()
  }

  const mostraPausa = tela === 'jogo' && (inst.pausado || inst.pausaDoMestre)
  const restam = Math.max(0, convite.tentativas - tiro.usadas)

  // ---------------------------------------------------------------- mesa no canto do palco

  const status = tiro.estado?.participantes ?? convite.participantes.map<TiroParticipante & { status: TiroStatus }>((p) => ({ ...p, status: 'convidado' }))
  const mesa = [{ id: 'eu', nome: 'Você', estado: meuEstado(inst, tiro.pausada) }, ...status.filter((p) => p.playerId !== playerId).map((p) => ({ id: p.playerId, nome: p.nome, estado: estadoDoColega(p) }))]

  return (
    <div
      className="lb-tiro"
      data-saindo={saindo}
      data-na-caixa={raiz === undefined ? undefined : ''}
      role="dialog"
      aria-modal="true"
      aria-label={`Barraca de tiro: ${convite.npc || 'Desafiante'}`}
      onPointerDownCapture={garantirAudio}
    >
      <Palco motor={motor} inst={inst} barraca={convite.barraca || 'Barraca sem nome'} mesa={mesa} />
      <aside className="tz-coluna" data-tela={tela}>
        {tela === 'convite' && (
          <Convite
            convite={convite}
            dif={dif}
            aoMudarDif={mudarDif}
            bloqueio={bloqueio}
            esperando={esperando}
            erro={erro}
            melhor={melhor}
            usadas={tiro.usadas}
            som={somAtivo}
            realejo={prefs.realejo}
            aoAlternarSom={alternarSom}
            aoAlternarRealejo={() => setPrefs((p) => ({ ...p, realejo: !p.realejo }))}
            aoComecar={comecar}
            aoSair={fechar}
          />
        )}
        {tela === 'jogo' && (
          <Jogo
            hud={inst.hud}
            dif={inst.dif}
            meta={convite.meta}
            pintura={pintura}
            podePausar={inst.fase !== 'fim' && !inst.pausaDoMestre && !inst.encerrado}
            aoPausar={() => motor.alternarPausa()}
            aoRecarregar={() => motor.pedirRecarga()}
          />
        )}
        {tela === 'resultado' && inst.resultado !== null && (
          <Resultado key={inst.resultado.rodada} r={inst.resultado} convite={convite} bloqueio={bloqueio} esperando={esperando} restam={restam} aoDeNovo={comecar} aoVoltar={() => motor.voltarAoConvite()} />
        )}
      </aside>
      {mostraPausa && <Pausa doMestre={inst.pausaDoMestre} aoContinuar={() => motor.retomar()} aoDesistir={desistir} />}
    </div>
  )
}

interface PalcoProps {
  motor: MotorDoTiro
  inst: InstantaneoDoTiro
  barraca: string
  mesa: readonly { id: string; nome: string; estado: string }[]
}

/** O ponto do palco em pixels de arte, ou `null` fora do desenho. */
function paraMundo(cv: HTMLCanvasElement | null, e: { clientX: number; clientY: number }): { x: number; y: number } | null {
  if (cv === null) return null
  const r = cv.getBoundingClientRect()
  if (!r.width || !r.height) return null
  const x = ((e.clientX - r.left) / r.width) * W
  const y = ((e.clientY - r.top) / r.height) * H
  return x < 0 || y < 0 || x > W || y > H ? null : { x, y }
}

function Palco({ motor, inst, barraca, mesa }: PalcoProps) {
  const palcoRef = useRef<HTMLElement>(null)
  const telaRef = useRef<HTMLCanvasElement>(null)
  usarEncaixe(palcoRef, telaRef, W, H)
  const emJogo = telaDe(inst) === 'jogo'
  useEffect(() => {
    const g = telaRef.current?.getContext('2d') ?? null
    if (g !== null) g.imageSmoothingEnabled = false
    motor.palco = g
    return () => {
      motor.palco = null
    }
  }, [motor])
  usarFocoNaRodada(palcoRef, emJogo && !inst.pausado && !inst.pausaDoMestre)
  const mirar = (e: PointerDoReact<HTMLElement>): void => {
    if (!motor.emJogo || e.pointerType === 'touch') return
    const m = paraMundo(telaRef.current, e)
    if (m !== null) motor.mirarEm(m.x, m.y)
  }
  const apertar = (e: PointerDoReact<HTMLElement>): void => {
    if (!motor.emJogo) return
    e.preventDefault()
    if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true })
    if (e.button === 2) {
      motor.pedirRecarga()
      return
    }
    if (e.button > 0) return
    const m = paraMundo(telaRef.current, e)
    if (m === null) return
    motor.mirarEm(m.x, m.y)
    motor.pedirTiro()
  }
  return (
    <section
      ref={palcoRef}
      className="tz-palco"
      data-mira={emJogo ? '1' : '0'}
      tabIndex={0}
      role="application"
      aria-roledescription="galeria de tiro"
      aria-label="Galeria de tiro. Mire com o mouse, as setas ou o analógico. Clique, Espaço, A ou RT atiram. R, botão direito ou X recarregam. Esc pausa."
      onPointerMove={mirar}
      onPointerDown={apertar}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={telaRef} width={W} height={H} aria-hidden="true" />
      <div className="tz-mesa" role="group" aria-label="O que cada um está fazendo">
        {mesa.map((m) => (
          <Fragment key={m.id}>
            <span>{m.nome}</span>
            <b>{m.estado}</b>
          </Fragment>
        ))}
      </div>
      <span className="tz-selo">{barraca}</span>
      {inst.hud.contagem !== null && (
        <p className="tz-contagem" data-ja={inst.fase === 'contagem' ? '0' : '1'} aria-hidden="true">
          {inst.hud.contagem}
        </p>
      )}
    </section>
  )
}

/** Na rodada (e ao sair da pausa), o foco vai para o palco: setas e Espaço miram e atiram dali. */
function usarFocoNaRodada(palco: RefObject<HTMLElement | null>, ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return
    const id = requestAnimationFrame(() => palco.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [palco, ativo])
}
