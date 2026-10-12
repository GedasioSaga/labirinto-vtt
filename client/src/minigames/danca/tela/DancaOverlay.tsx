import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { DancaEvento, DancaPlacarAoVivo, DancaPlacarFinal, DancaStatus } from '../../../net/protocoloDaDanca'
import type { DancaDoJogador } from '../../../player/estadoDaDanca'
import { estaCalado, PREFERENCIA_DE_SOM_PADRAO, percentualDoVolume, useSomStore } from '../../../stores/somStore'
import { laneDaTecla } from '../entrada'
import type { DificuldadeDanca } from '../tipos'
import { criarAudioDoNavegador, ganhoDaMesa, type AudioDaDanca, type CriarAudioDaDanca } from './audioDaDanca'
import { Calibracao, type ToqueDaCalibracao } from './Calibracao'
import { Convite } from './Convite'
import { MotorDaDanca, type AmbienteDoMotor } from './motor'
import { baixarMusica, ErroDaMusica, FONTES_DO_NAVEGADOR, type EstadoDaMusica, type FontesDaMusica } from './musicaImportada'
import { Palco } from './Palco'
import { configDaPartida, dificuldadeDaPartida } from './partidaDoConvite'
import { armazemDoNavegador, gravarPreferencias, lerPreferencias, type ArmazemDaDanca, type PreferenciasDaDanca } from './preferencias'
import { Pista } from './Pista'
import { Resultado } from './Resultado'
import { fmtPct, textoDoEncerramento, tituloDoResultado } from './textos'
import './danca.css'

/** O que a tela pede à conexão do jogador (`PlayerConnection`). */
export interface AcoesDaDanca {
  dancaPronto(dificuldade: DificuldadeDanca): boolean
  dancaToques(lote: { eventos: DancaEvento[]; placar: DancaPlacarAoVivo }): boolean
  dancaFim(placar: DancaPlacarFinal): boolean
  fecharDanca(): void
}

export interface DancaOverlayProps {
  danca: DancaDoJogador
  playerId: string | undefined
  acoes: AcoesDaDanca
  /** Trocas para o teste e a vitrine; o app usa os do navegador. */
  criarAudio?: CriarAudioDaDanca
  fontesDaMusica?: FontesDaMusica
  armazem?: ArmazemDaDanca | null
  ambiente?: AmbienteDoMotor
}

/** A tela some com um fade curto antes de o estado da dança sair. */
const SAIDA_MS = 180

/**
 * MINIGAME DE DANÇA na tela do jogador: camada de tela cheia por cima do mapa
 * (portal, como a transição especial), do convite ao resultado. Liga
 * `state.danca` (o que o mestre mandou) ao motor da pista e devolve à conexão
 * o Pronto, os lotes de toques e o fim. Uma montagem por sessão de dança.
 */
export function DancaOverlay(props: DancaOverlayProps) {
  return createPortal(<TelaDaDanca key={props.danca.sessao} {...props} />, document.body)
}

function usarMovimentoReduzido(): () => boolean {
  const consulta = useMemo(() => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null), [])
  return useCallback(() => consulta?.matches === true, [consulta])
}

/** A música importada: baixa assim que o convite chega; "Tentar de novo" recomeça. */
function usarMusicaImportada(danca: DancaDoJogador, fontes: FontesDaMusica): { estado: EstadoDaMusica | null; buffer: AudioBuffer | null; deNovo: () => void } {
  const musica = danca.convite.musica
  const midia = musica.tipo === 'arquivo' ? musica.midia : null
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoDaMusica | null>(midia === null ? null : { fase: 'baixando', fracao: 0 })
  useEffect(() => {
    if (midia === null) return
    const controle = new AbortController()
    baixarMusica(midia, (e) => !controle.signal.aborted && setEstado(e), controle.signal, fontes).then(
      (buffer) => !controle.signal.aborted && setEstado({ fase: 'pronta', buffer }),
      (erro: unknown) => {
        if (controle.signal.aborted) return
        setEstado({ fase: 'erro', mensagem: erro instanceof ErroDaMusica ? erro.message : 'Não deu para preparar a música. Tente de novo.' })
      },
    )
    return () => controle.abort()
  }, [midia, fontes, tentativa])
  return { estado, buffer: estado?.fase === 'pronta' ? estado.buffer : null, deNovo: () => setTentativa((n) => n + 1) }
}

type Tela = 'convite' | 'calibra' | 'pista' | 'resultado' | 'encerrada'

function TelaDaDanca({ danca, playerId, acoes, criarAudio = criarAudioDoNavegador, fontesDaMusica = FONTES_DO_NAVEGADOR, armazem, ambiente }: DancaOverlayProps) {
  const acoesRef = useRef(acoes)
  acoesRef.current = acoes
  const reduzido = usarMovimentoReduzido()
  const [motor] = useState(
    () =>
      new MotorDaDanca(
        {
          enviarToques: (lote) => void acoesRef.current.dancaToques(lote),
          enviarFim: (placar) => void acoesRef.current.dancaFim(placar),
        },
        reduzido,
        ambiente,
      ),
  )
  const inst = useSyncExternalStore(motor.assinar, motor.lerInstantaneo)
  const audioRef = useRef<AudioDaDanca | null>(null)
  const calibracao = useRef<ToqueDaCalibracao | null>(null)
  const armazemDaTela = useMemo(() => (armazem === undefined ? armazemDoNavegador() : armazem), [armazem])
  const [prefs, setPrefs] = useState<PreferenciasDaDanca>(() => lerPreferencias(armazemDaTela))
  const { convite } = danca
  const [dif, setDif] = useState<DificuldadeDanca>(() => (convite.permitida !== 'escolha' ? convite.permitida : (danca.pronto ?? 'diversao')))
  const [calibrando, setCalibrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [controle, setControle] = useState<string | null>(null)
  const [saindo, setSaindo] = useState(false)
  const musica = usarMusicaImportada(danca, fontesDaMusica)
  const volume = useSomStore((s) => s.volume)
  const mudo = useSomStore((s) => s.mudo)
  const somCalado = estaCalado({ volume, mudo })
  const ganho = ganhoDaMesa({ volume, mudo })
  const ganhoRef = useRef(ganho)
  ganhoRef.current = ganho

  const tela: Tela =
    danca.encerrada !== undefined ? 'encerrada' : inst.fase === 'fim' || danca.desfecho !== undefined ? 'resultado' : danca.comecar !== undefined ? 'pista' : calibrando ? 'calibra' : 'convite'
  const telaRef = useRef(tela)
  telaRef.current = tela
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  // ---------------------------------------------------------------- motor e áudio

  useEffect(() => {
    motor.iniciar()
    return () => {
      motor.destruir()
      audioRef.current?.fechar()
      audioRef.current = null
    }
  }, [motor])

  useEffect(() => {
    motor.prefs = prefs
    gravarPreferencias(armazemDaTela, prefs)
  }, [motor, prefs, armazemDaTela])

  useEffect(() => {
    motor.modo = tela === 'pista' ? 'pista' : tela === 'calibra' ? 'calibra' : 'outro'
    motor.aoToqueDaCalibracao = (perf) => calibracao.current?.toque(perf)
  }, [motor, tela])

  useEffect(() => {
    audioRef.current?.definirGanho(ganho)
  }, [ganho])

  /** Cria (ou retoma) o áudio da dança. Só funciona de verdade dentro de um gesto. */
  const garantirAudio = useCallback((): AudioDaDanca | null => {
    const atual = audioRef.current
    if (atual !== null) {
      void atual.retomar()
      return atual
    }
    const novo = criarAudio(ganhoRef.current)
    audioRef.current = novo
    motor.definirAudio(novo)
    return novo
  }, [criarAudio, motor])

  // ---------------------------------------------------------------- estado da rede -> motor

  const participantes = danca.comecar?.participantes ?? convite.participantes
  const chaveDosParticipantes = participantes.map((p) => p.playerId).join('|')
  useEffect(() => {
    motor.definirColegas(participantes, playerId)
    // `participantes` muda de identidade a cada mensagem; a chave diz quando mudou de verdade.
  }, [motor, chaveDosParticipantes, playerId])

  useEffect(() => {
    motor.definirNotaMin(convite.notaMin)
  }, [motor, convite.notaMin])

  useEffect(() => {
    motor.receberColegas(danca.colegas, danca.placares)
  }, [motor, danca.colegas, danca.placares])

  const difDaPartida = dificuldadeDaPartida(danca, playerId, dif)
  useEffect(() => {
    if (danca.comecar === undefined || danca.encerrada !== undefined || inst.fase !== 'parada') return
    const config = configDaPartida(danca, difDaPartida, musica.buffer)
    if (config === null) return
    setCalibrando(false)
    motor.comecar(config)
  }, [motor, danca, difDaPartida, musica.buffer, inst.fase])

  useEffect(() => {
    if (danca.comecar === undefined) return
    if (danca.pausada) motor.pausar('mestre')
    else motor.retomar('mestre', danca.pausaMudouEm)
  }, [motor, danca.pausada, danca.pausaMudouEm, danca.comecar])

  useEffect(() => {
    if (danca.encerrada !== undefined) motor.encerrar()
  }, [motor, danca.encerrada])

  useEffect(() => {
    if (danca.desfecho?.portaAberta) motor.abrirPorta()
  }, [motor, danca.desfecho])

  // ---------------------------------------------------------------- teclado, foco da janela, controle

  useEffect(() => {
    const desceu = (e: KeyboardEvent): void => {
      // Tela modal: o mapa atrás não ouve as teclas (setas e WASD mexeriam a ficha).
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const atual = telaRef.current
      const lane = laneDaTecla(e.code, prefsRef.current.teclas)
      if (atual === 'pista') {
        if (e.code === 'Escape') {
          e.preventDefault()
          if (!e.repeat) motor.alternarPausa()
          return
        }
        if (lane === -1) return
        e.preventDefault()
        if (!e.repeat) motor.apertar(lane, `k${e.code}`, e.timeStamp)
        return
      }
      const medindo = calibracao.current
      if (atual === 'calibra' && medindo?.ativa && (e.code === 'Space' || lane !== -1)) {
        e.preventDefault()
        if (!e.repeat) medindo.toque(e.timeStamp)
      }
    }
    const subiu = (e: KeyboardEvent): void => {
      e.stopPropagation()
      const lane = laneDaTecla(e.code, prefsRef.current.teclas)
      if (lane !== -1) motor.soltar(lane, `k${e.code}`, e.timeStamp)
    }
    const perdeuFoco = (): void => motor.soltarTudo(performance.now())
    const visibilidade = (): void => {
      if (document.hidden) motor.pausar('jogador')
    }
    const conectou = (e: GamepadEvent): void => setControle(e.gamepad.id.replace(/\s*\(.*$/, '').slice(0, 40) || 'controle')
    const desconectou = (): void => setControle(null)
    window.addEventListener('keydown', desceu, true)
    window.addEventListener('keyup', subiu, true)
    window.addEventListener('blur', perdeuFoco)
    document.addEventListener('visibilitychange', visibilidade)
    window.addEventListener('gamepadconnected', conectou)
    window.addEventListener('gamepaddisconnected', desconectou)
    return () => {
      window.removeEventListener('keydown', desceu, true)
      window.removeEventListener('keyup', subiu, true)
      window.removeEventListener('blur', perdeuFoco)
      document.removeEventListener('visibilitychange', visibilidade)
      window.removeEventListener('gamepadconnected', conectou)
      window.removeEventListener('gamepaddisconnected', desconectou)
    }
  }, [motor])

  // ---------------------------------------------------------------- ações da tela

  const ficarPronto = (): void => {
    setErro(null)
    const audio = garantirAudio()
    if (audio === null) {
      setErro('Este navegador não toca o áudio da dança. Tente outro navegador neste aparelho.')
      return
    }
    if (!acoesRef.current.dancaPronto(dif)) setErro('Não deu para avisar o mestre. Confira a conexão com a sala e tente de novo.')
  }

  const mudarDif = (nova: DificuldadeDanca): void => {
    setDif(nova)
    // Já pronto: a troca vale como um Pronto novo (o mestre recebe a dificuldade nova).
    if (danca.pronto !== undefined && danca.pronto !== nova) acoesRef.current.dancaPronto(nova)
  }

  const ligarSom = (): void => {
    const loja = useSomStore.getState()
    if (loja.mudo) loja.alternarMudo()
    if (!(percentualDoVolume(loja.volume) > 0)) loja.setVolume(PREFERENCIA_DE_SOM_PADRAO.volume)
  }

  const tocarMusica = (): void => {
    garantirAudio()
    motor.entrarNaMusica()
  }

  const fechar = (): void => {
    if (saindo) return
    setSaindo(true)
    window.setTimeout(() => acoesRef.current.fecharDanca(), SAIDA_MS)
  }

  // ---------------------------------------------------------------- anúncio para leitor de tela

  const status: Record<string, DancaStatus> = {}
  for (const p of danca.estado?.participantes ?? []) status[p.playerId] = p.status
  const colegas = participantes.filter((p) => p.playerId !== playerId)
  const anuncio = (() => {
    if (tela === 'encerrada' && danca.encerrada !== undefined) return textoDoEncerramento(danca.encerrada).titulo
    if (tela === 'resultado' && inst.resultado !== null) return `${tituloDoResultado(inst.resultado.motivo, danca.desfecho)}. Precisão ${fmtPct(inst.resultado.precisao)}.`
    if (inst.fase === 'pausada') return inst.pausadaPeloMestre ? 'O mestre pausou a dança.' : 'Pausado.'
    if (tela === 'pista') return 'A música começa já.'
    return ''
  })()

  return (
    <div className="lb-danca" data-saindo={saindo} role="dialog" aria-modal="true" aria-label={`Desafio de dança: ${convite.npc || 'Desafiante'}`}>
      <Palco motor={motor} colegas={colegas} placares={danca.placares} />
      <section className="dz-coluna" data-tela={tela}>
        {tela === 'convite' && (
          <Convite
            danca={danca}
            euId={playerId}
            dif={dif}
            aoMudarDif={mudarDif}
            prefs={prefs}
            aoMudarPrefs={setPrefs}
            musica={musica.estado}
            aoBaixarDeNovo={musica.deNovo}
            somCalado={somCalado}
            aoLigarSom={ligarSom}
            erro={erro}
            controle={controle}
            aoPronto={ficarPronto}
            aoAjustarAtraso={() => setCalibrando(true)}
          />
        )}
        {tela === 'calibra' && (
          <Calibracao
            ajusteMs={prefs.ajusteMs}
            aoMudarAjuste={(ajusteMs) => setPrefs((p) => ({ ...p, ajusteMs }))}
            aoVoltar={() => setCalibrando(false)}
            garantirAudio={garantirAudio}
            ligacao={calibracao}
          />
        )}
        {tela === 'pista' && <Pista motor={motor} inst={inst} dif={difDaPartida} teclas={prefs.teclas} aoTocarMusica={tocarMusica} aoSair={() => motor.desistir()} />}
        {tela === 'resultado' && (
          <Resultado
            resultado={inst.resultado}
            dif={difDaPartida}
            notaMin={convite.notaMin}
            desfecho={danca.desfecho}
            euId={playerId}
            participantes={participantes}
            status={status}
            placares={danca.placares}
            aoFechar={fechar}
          />
        )}
        {tela === 'encerrada' && danca.encerrada !== undefined && <Encerrada motivo={danca.encerrada} aoFechar={fechar} />}
      </section>
      <p className="dz-sr" aria-live="polite">
        {anuncio}
      </p>
    </div>
  )
}

function Encerrada({ motivo, aoFechar }: { motivo: NonNullable<DancaDoJogador['encerrada']>; aoFechar: () => void }) {
  const { titulo, texto } = textoDoEncerramento(motivo)
  const botao = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    botao.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="dz-tela">
      <h2 className="dz-titulo">{titulo}</h2>
      <p className="dz-texto">{texto}</p>
      <button ref={botao} type="button" className="dz-btn dz-btn--primario dz-btn--bloco" onClick={aoFechar}>
        Voltar ao mapa
      </button>
    </div>
  )
}
