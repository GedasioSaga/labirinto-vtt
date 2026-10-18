import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as PointerDoReact } from 'react'
import { createPortal } from 'react-dom'
import type { PescaDesfechoDoLance, PescaVivo } from '../../../net/protocoloDaPesca'
import type { PescaDoJogador } from '../../../player/estadoDaPesca'
import { estaCalado, PREFERENCIA_DE_SOM_PADRAO, percentualDoVolume, useSomStore } from '../../../stores/somStore'
import { ganhoDaMesa } from '../../danca/tela/audioDaDanca'
import { H, W } from '../arte'
import { GANHO, SONS } from '../som'
import type { DificuldadePesca } from '../tipos'
import { AMBIENTE_DO_NAVEGADOR, FASES_NA_AGUA, MotorDaPesca, type AmbienteDaPesca, type InstantaneoDaPesca, type ResultadoDoLance } from './motor'
import { armazemDoNavegador, gravarPreferencias, lerPreferencias, type ArmazemDaPesca, type PreferenciasDaPesca } from './preferencias'
import { Cesto, Convite, Encerrada, Jogo, Pausa, ResultadoDoLanceTela, usarEncaixe, type SegurarProps } from './Telas'
import { estadoEmPalavras, textoDoEncerramento, TITULO_DO_LANCE } from './textos'
import './pesca.css'

/** O que a tela pede à conexão do jogador (`PlayerConnection`). */
export interface AcoesDaPesca {
  prontoPesca(dificuldade: DificuldadePesca): boolean
  vivoPesca(vivo: Omit<PescaVivo, 'de'>): boolean
  lancePesca(lance: { lance: number } & PescaDesfechoDoLance): boolean
  fimPesca(): boolean
  fecharPesca(): void
}

/** O som da pesca: o contexto e a saída dos efeitos (`fx`, com o `GANHO` do protótipo) sob o volume. */
export interface AudioDaPesca {
  ctx: BaseAudioContext
  fx: AudioNode
  definirGanho(ganho: number): void
  retomar(): void
  fechar(): void
}

export type CriarAudioDaPesca = (ganho: number) => AudioDaPesca | null

/** Troca de volume sem estalo: chega lá em ~60 ms. */
const SUAVIZAR_GANHO_S = 0.02

export const criarAudioDoNavegador: CriarAudioDaPesca = (ganho) => {
  const Contexto = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (Contexto === undefined) return null
  try {
    const ctx = new Contexto()
    const volume = ctx.createGain()
    volume.gain.value = ganho
    volume.connect(ctx.destination)
    const fx = ctx.createGain()
    fx.gain.value = GANHO
    fx.connect(volume)
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

export interface PescaOverlayProps {
  pesca: PescaDoJogador
  playerId: string | undefined
  acoes: AcoesDaPesca
  /** Trocas para o teste e a vitrine; o app usa as do navegador. */
  criarAudio?: CriarAudioDaPesca
  armazem?: ArmazemDaPesca | null
  ambiente?: AmbienteDaPesca
  motor?: MotorDaPesca
  /** Onde a tela entra (o portal). Ausente = o `body`. A Visão de jogador (fase 5) passa a caixa da tela do jogador. */
  raiz?: Element
}

/** O que a página que monta a tela do jogador troca na pesca (a Visão de jogador); o resto vem da conexão. */
export type AjustesDaTelaDaPesca = Pick<PescaOverlayProps, 'raiz'>

/** A tela some com um fade curto antes de o estado da pesca sair. */
const SAIDA_MS = 180
const TECLAS_DE_SEGURAR: ReadonlySet<string> = new Set(['Space', 'ArrowUp', 'KeyW'])

/**
 * MINIGAME DE PESCA na tela do jogador: camada de tela cheia por cima do mapa
 * (portal, como a dança), do convite ao cesto. Lago à esquerda e coluna à
 * direita, como o protótipo aprovado (docs/design/minigame-pesca/prototipo);
 * no celular, empilhados. Liga `state.pesca` ao `MotorDaPesca` e devolve à
 * conexão o Pronto, o vivo de cada quadro (a conexão limita a 4/s), cada lance
 * e o fim. Uma montagem por sessão de pesca.
 */
export function PescaOverlay(props: PescaOverlayProps) {
  return createPortal(<TelaDaPesca key={props.pesca.sessao} {...props} />, props.raiz ?? document.body)
}

type Tela = 'convite' | 'jogo' | 'resultado' | 'cesto' | 'encerrada'

/** O lance do motor como a rede o leva (o peixe do pegou vira `PeixeNoCesto`). */
export function desfechoDe(r: ResultadoDoLance): PescaDesfechoDoLance {
  if (r.tipo !== 'pegou') return { resultado: r.tipo }
  return { resultado: 'pegou', peixe: { peixe: r.peixe.id, cm: r.cm, estrelas: r.estrelas, perfeito: r.perfeito, bau: r.bau === 'pego' } }
}

function movimentoReduzido(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
}

/** O que este jogador está fazendo, para a mesa no canto do lago. */
function meuEstado(tela: Tela, inst: InstantaneoDaPesca): string {
  if (tela === 'convite') return 'no convite'
  if (tela === 'encerrada') return 'encerrado'
  if (tela === 'cesto') return 'terminou'
  const ultimo = inst.resultados.at(-1)
  return estadoEmPalavras(inst.fase, ultimo === undefined ? null : { tipo: ultimo.tipo, peixe: ultimo.peixe.nome })
}

const PALAVRA_DO_STATUS = { convidado: 'no convite', pescando: 'pescando', terminou: 'terminou', saiu: 'saiu' } as const

function TelaDaPesca({ pesca, playerId, acoes, criarAudio = criarAudioDoNavegador, armazem, ambiente = AMBIENTE_DO_NAVEGADOR, motor: motorDeFora, raiz }: PescaOverlayProps) {
  const acoesRef = useRef(acoes)
  acoesRef.current = acoes
  const pescaRef = useRef(pesca)
  pescaRef.current = pesca
  const [motor] = useState(() => motorDeFora ?? new MotorDaPesca(ambiente, movimentoReduzido()?.matches === true))
  const inst = useSyncExternalStore(motor.assinar, motor.lerInstantaneo)
  const armazemDaTela = useMemo(() => (armazem === undefined ? armazemDoNavegador() : armazem), [armazem])
  const [prefs, setPrefs] = useState<PreferenciasDaPesca>(() => lerPreferencias(armazemDaTela))
  const { convite } = pesca
  const [dif, setDif] = useState<DificuldadePesca>(() => (convite.permitida !== 'escolha' ? convite.permitida : (pesca.pronto ?? prefs.dif)))
  const [erro, setErro] = useState<string | null>(null)
  const [verCesto, setVerCesto] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const audioRef = useRef<AudioDaPesca | null>(null)
  const volume = useSomStore((s) => s.volume)
  const mudo = useSomStore((s) => s.mudo)
  const somAtivo = prefs.som && !estaCalado({ volume, mudo })
  const ganho = somAtivo ? ganhoDaMesa({ volume, mudo }) : 0
  const ganhoRef = useRef(ganho)
  ganhoRef.current = ganho
  const base = `${convite.pinId}|${pesca.sessao}|${playerId ?? 'eu'}`

  const tela: Tela =
    pesca.encerrada !== undefined ? 'encerrada' : pesca.pronto === undefined ? 'convite' : verCesto ? 'cesto' : inst.fase === 'resultado' ? 'resultado' : 'jogo'
  const telaRef = useRef(tela)
  telaRef.current = tela

  // ---------------------------------------------------------------- áudio

  /** Cria (ou retoma) o áudio. Só funciona de verdade dentro de um gesto (toque, tecla, clique). */
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
  const confirmarRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    motor.ganchos = {
      som: (nome, v) => {
        const a = audioRef.current
        if (a === null || ganhoRef.current <= 0) return
        SONS[nome](a.ctx, a.fx, a.ctx.currentTime + 0.005, v)
      },
      fimDoLance: (r) => {
        const conexao = acoesRef.current
        conexao.lancePesca({ lance: r.lance, ...desfechoDe(r) })
        // Acabaram os lances: o cesto vai ao mestre já, sem esperar o jogador fechar.
        if (r.lance >= pescaRef.current.convite.lances) conexao.fimPesca()
      },
      quadro: () => {
        const p = pescaRef.current
        if (p.pronto === undefined || p.fimEnviado || p.encerrada !== undefined) return
        const fase = motor.J.fase
        if (fase === 'convite') return
        const puxada = motor.J.puxada
        const medidor = fase === 'puxada' && puxada !== null ? Math.min(1, Math.max(0, puxada.m)) : 0
        const lance = motor.lanceAtual
        const chave = `${fase}|${lance}|${medidor.toFixed(2)}`
        // Só o que mudou; o que a conexão segurou pelo limite de 4/s sai no próximo quadro.
        if (chave === vivoEnviado.current) return
        if (acoesRef.current.vivoPesca({ fase, lance, medidor })) vivoEnviado.current = chave
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

  // O Pronto saiu (por este aparelho ou já estava ao montar): o primeiro lance começa.
  useEffect(() => {
    if (pesca.pronto !== undefined && pesca.encerrada === undefined && inst.fase === 'convite') motor.comecar(pesca.pronto, convite.lances, base)
  }, [motor, pesca.pronto, pesca.encerrada, inst.fase, convite.lances, base])

  useEffect(() => {
    motor.definirPausaDoMestre(pesca.pausada)
  }, [motor, pesca.pausada])

  useEffect(() => {
    if (pesca.encerrada !== undefined) motor.encerrar()
  }, [motor, pesca.encerrada])

  // ---------------------------------------------------------------- teclado e foco da janela

  useEffect(() => {
    const naAgua = (): boolean => telaRef.current === 'jogo' && FASES_NA_AGUA.has(motor.J.fase)
    const desceu = (e: KeyboardEvent): void => {
      // Tela modal: o mapa atrás não ouve as teclas (setas e WASD mexeriam a ficha).
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey || e.altKey) return
      garantirAudio()
      if (e.code === 'Escape') {
        if (!naAgua()) return
        e.preventDefault()
        if (!e.repeat) motor.alternarPausa()
        return
      }
      if (!TECLAS_DE_SEGURAR.has(e.code) || !naAgua()) return
      const agora = motor.lerInstantaneo()
      // Pausado: o Espaço aperta o "Continuar" focado, não a linha.
      if (agora.pausado || agora.pausaDoMestre) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select') !== null) return
      e.preventDefault()
      if (!e.repeat) motor.apertar(`k${e.code}`)
    }
    const subiu = (e: KeyboardEvent): void => {
      e.stopPropagation()
      if (TECLAS_DE_SEGURAR.has(e.code)) motor.soltar(`k${e.code}`)
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

  /** Segurar com o mouse ou o dedo, no lago ou no campo da coluna. */
  const segurar = useMemo<SegurarProps>(() => {
    const fim = (e: PointerDoReact<HTMLElement>): void => motor.soltar(`p${e.pointerId}`)
    return {
      onPointerDown: (e) => {
        if (e.button > 0 || telaRef.current !== 'jogo' || !FASES_NA_AGUA.has(motor.J.fase)) return
        e.preventDefault()
        garantirAudio()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // Sem captura (ponteiro já solto): o soltar chega pelo pointerup.
        }
        motor.apertar(`p${e.pointerId}`)
      },
      onPointerUp: fim,
      onPointerCancel: fim,
      onLostPointerCapture: fim,
      onContextMenu: (e) => e.preventDefault(),
    }
  }, [motor, garantirAudio])

  // ---------------------------------------------------------------- ações da tela

  const mudarDif = (nova: DificuldadePesca): void => {
    setDif(nova)
    setPrefs((p) => ({ ...p, dif: nova }))
  }

  const ficarPronto = (): void => {
    if (pescaRef.current.pausada || pescaRef.current.pronto !== undefined) return
    setErro(null)
    garantirAudio()
    if (!acoesRef.current.prontoPesca(dif)) {
      setErro('Não deu para avisar o mestre. Confira a conexão com a sala e tente de novo.')
      return
    }
    motor.comecar(dif, convite.lances, base)
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

  const seguir = (): void => {
    if (motor.proximoLance()) return
    if (inst.resultados.length >= inst.lances) setVerCesto(true)
  }

  const fechar = (): void => {
    if (saindo) return
    setSaindo(true)
    window.setTimeout(() => acoesRef.current.fecharPesca(), SAIDA_MS)
  }

  confirmarRef.current = () => {
    if (tela === 'convite' && !pesca.pausada) ficarPronto()
    else if (tela === 'resultado') seguir()
    else if (tela === 'cesto' || tela === 'encerrada') fechar()
  }

  // ---------------------------------------------------------------- leitor de tela

  const ultimo = inst.resultados.at(-1) ?? null
  const mostraPausa = tela === 'jogo' && (inst.pausado || pesca.pausada)
  const anuncio = (() => {
    if (tela === 'encerrada' && pesca.encerrada !== undefined) return textoDoEncerramento(pesca.encerrada).titulo
    if (tela === 'cesto') return 'Fim da pesca.'
    if (tela === 'resultado' && ultimo !== null) return `${TITULO_DO_LANCE[ultimo.tipo]} Lance ${ultimo.lance} de ${inst.lances}.`
    if (mostraPausa) return pesca.pausada ? 'O mestre pausou a pesca.' : 'Pausado.'
    if (tela !== 'jogo') return ''
    if (inst.fase === 'lance') return `Lance ${inst.lance} de ${inst.lances}.`
    if (inst.fase === 'puxada') return 'Puxando. Segure para subir a barra.'
    return inst.hud.titulo
  })()

  // ---------------------------------------------------------------- mesa no canto do lago

  const status = pesca.estado?.participantes ?? convite.participantes.map((p) => ({ ...p, status: 'convidado' as const }))
  const mesa = [{ id: 'eu', nome: 'Você', estado: meuEstado(tela, inst) }, ...status.filter((p) => p.playerId !== playerId).map((p) => ({ id: p.playerId, nome: p.nome, estado: PALAVRA_DO_STATUS[p.status] }))]

  return (
    <div
      className="lb-pesca"
      data-saindo={saindo}
      data-na-caixa={raiz === undefined ? undefined : ''}
      role="dialog"
      aria-modal="true"
      aria-label={`Desafio de pesca: ${convite.npc || 'Desafiante'}`}
      onPointerDownCapture={garantirAudio}
    >
      <Palco motor={motor} lago={convite.lago || 'Lago sem nome'} mesa={mesa} segurar={segurar} />
      <aside className="pz-coluna" data-tela={tela}>
        {tela === 'convite' && (
          <Convite convite={convite} dif={dif} aoMudarDif={mudarDif} pausadaPeloMestre={pesca.pausada} erro={erro} somAtivo={somAtivo} aoAlternarSom={alternarSom} aoPescar={ficarPronto} />
        )}
        {tela === 'jogo' && <Jogo motor={motor} inst={inst} segurar={segurar} aoPausar={() => motor.alternarPausa()} />}
        {tela === 'resultado' && ultimo !== null && <ResultadoDoLanceTela r={ultimo} lances={inst.lances} pausadaPeloMestre={pesca.pausada} aoSeguir={seguir} />}
        {tela === 'cesto' && <Cesto convite={convite} resultados={inst.resultados} aoFechar={fechar} />}
        {tela === 'encerrada' && pesca.encerrada !== undefined && <Encerrada motivo={pesca.encerrada} resultados={inst.resultados} aoFechar={fechar} />}
      </aside>
      {mostraPausa && <Pausa doMestre={pesca.pausada} aoContinuar={() => motor.retomar()} aoSair={fechar} />}
      <p className="pz-sr" aria-live="polite">
        {anuncio}
      </p>
    </div>
  )
}

interface PalcoProps {
  motor: MotorDaPesca
  lago: string
  mesa: readonly { id: string; nome: string; estado: string }[]
  segurar: SegurarProps
}

function Palco({ motor, lago, mesa, segurar }: PalcoProps) {
  const palcoRef = useRef<HTMLElement>(null)
  const lagoRef = useRef<HTMLCanvasElement>(null)
  usarEncaixe(palcoRef, lagoRef, W, H)
  useEffect(() => {
    const g = lagoRef.current?.getContext('2d') ?? null
    if (g !== null) g.imageSmoothingEnabled = false
    motor.telas.lago = g
    return () => {
      motor.telas.lago = null
    }
  }, [motor])
  return (
    <section ref={palcoRef} className="pz-palco" aria-label="Lago da caverna: você na pedra da margem, a linha e a boia na água" {...segurar}>
      <canvas ref={lagoRef} width={W} height={H} aria-hidden="true" />
      <div className="pz-mesa" role="group" aria-label="O que cada um está fazendo">
        {mesa.map((m) => (
          <Fragment key={m.id}>
            <span>{m.nome}</span>
            <b>{m.estado}</b>
          </Fragment>
        ))}
      </div>
      <span className="pz-palco__lago">{lago}</span>
    </section>
  )
}
