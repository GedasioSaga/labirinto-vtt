import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BolhaDoJogador } from '../../../player/estadoDaBolha'
import type { BolhaPlacar, BolhaStatus } from '../../../net/protocoloDaBolha'
import { DIFICULDADES_BOLHA, NOME_DA_DIFICULDADE_BOLHA, NOME_DO_CENARIO_BOLHA, type DificuldadeBolha } from '../tipos'
import { criarVigiaDaCarga, type MotivoDaCargaParada, type ProgressoDaCarga, type VigiaDaCarga } from '../../fogo/tela/vigiaDaCarga'
import { criarPonteDaBolha, type EstadoDaPonteDaBolha, type PonteDaBolha } from './ponteDaBolha'
import {
  AVISO_MOUSE_BOLHA,
  CONTROLES_DA_BOLHA,
  ERRO_DA_CARGA_DEMORADA,
  ERRO_DA_CARGA_PARADA,
  ERRO_DO_JOGO_AUSENTE,
  ERRO_DO_JOGO_QUE_NAO_LIGOU,
  MOTIVO_DO_ENCERRAMENTO_BOLHA,
  NOME_DO_JOGO_BOLHA,
  NOME_DO_RESULTADO_BOLHA,
  desenhoDasEstrelas,
  fraseDoMotivoBolha,
  oQueFazerSemOJogo,
  rotuloDasEstrelas,
  textoDaCarga,
  textoDosFocos,
  textoDosPontos,
} from './textos'
import './bolha.css'

/**
 * A TELA DA BOLHA D'ÁGUA no jogador, por cima do mapa: o convite (no
 * "sozinho" com escolha, a dificuldade), o jogo num iframe (carregado já no
 * convite, escondido, para o `pronto` chegar antes do "Começar") e o
 * resultado. Mesmo caminho de carga do Fogo na Floresta (`FogoOverlay`): a
 * vigia de tempo e a conferência da rota.
 *
 * Sem lockstep: este aparelho joga a própria cópia e só o placar do fim volta
 * ao mestre (`ponteDaBolha.ts` fala com o jogo).
 */

/** Onde o mestre serve o jogo (a mesma origem da página do jogador). */
export const ROTA_DA_BOLHA = '/minigames/bolha/'
export const URL_DO_JOGO_BOLHA = `${ROTA_DA_BOLHA}index.html`

/**
 * De onde ESTA página carrega o jogo: a do jogador servida pela sala (e o Vite
 * em dev) acha na própria origem; uma janela do app instalado (a Visão de
 * jogador) busca no protocolo `minigame` do app, como o fogo (`urlDoJogoFogoPara`).
 */
export function urlDoJogoBolhaPara(local: Pick<Location, 'protocol' | 'hostname'>): string {
  if (local.protocol === 'tauri:') return 'minigame://localhost/bolha/index.html'
  if (local.hostname === 'tauri.localhost') return `${local.protocol}//minigame.localhost/bolha/index.html`
  return URL_DO_JOGO_BOLHA
}

let marcasDaFila = 0

/**
 * Roda `fazer` depois das mensagens que já esperavam na fila desta janela (o
 * `pronto` que o jogo mandou antes é lido primeiro). É a `depoisDaFila` da
 * vigia da carga, como no fogo.
 */
function depoisDasMensagensNaFila(fazer: () => void): void {
  const marca = `lb-bolha-fila-${(marcasDaFila += 1)}`
  const ouvir = (ev: MessageEvent) => {
    if (ev.source !== window || ev.data !== marca) return
    window.removeEventListener('message', ouvir)
    fazer()
  }
  window.addEventListener('message', ouvir)
  window.postMessage(marca, window.location.origin)
}

/** A frase de cada espera estourada da carga (`vigiaDaCarga.ts`). O pacote de hoje não avisa bytes: só `sem_sinal` acontece. */
const ERRO_DA_ESPERA: Record<MotivoDaCargaParada, string> = {
  sem_sinal: ERRO_DA_CARGA_DEMORADA,
  parado: ERRO_DA_CARGA_PARADA,
  motor: ERRO_DO_JOGO_QUE_NAO_LIGOU,
}

export interface AcoesDaBolha {
  /** No convite `sozinho` (o "Apagar com bolhas" do pino), leva a dificuldade e já começa. */
  prontoBolha(dificuldade?: DificuldadeBolha): boolean
  fimBolha(placar: BolhaPlacar): boolean
  fecharBolha(): void
  falhouBolha(): boolean
}

export interface BolhaOverlayProps {
  bolha: BolhaDoJogador
  playerId: string | undefined
  acoes: AcoesDaBolha
  /** Troca para uma mesa de prova; o app usa a rota do mestre. */
  urlDoJogo?: string
}

export function BolhaOverlay(props: BolhaOverlayProps) {
  return createPortal(<TelaDaBolha key={props.bolha.sessao} {...props} />, document.body)
}

function TelaDaBolha({ bolha, playerId, acoes, urlDoJogo = urlDoJogoBolhaPara(window.location) }: BolhaOverlayProps) {
  const quadroRef = useRef<HTMLIFrameElement>(null)
  const ponteRef = useRef<PonteDaBolha | null>(null)
  const acoesRef = useRef(acoes)
  acoesRef.current = acoes
  const vigiaRef = useRef<VigiaDaCarga | null>(null)
  const [estadoDoJogo, setEstadoDoJogo] = useState<EstadoDaPonteDaBolha>('carregando')
  const [erroDoJogo, setErroDoJogo] = useState<string | null>(null)
  /** Os bytes do jogo que já chegaram; `null` = o jogo não avisou (o pacote de hoje nunca avisa). */
  const [carga, setCarga] = useState<ProgressoDaCarga | null>(null)
  /** Cada "Tentar de novo" soma um: o iframe remonta (a `key`) e a vigia da carga recomeça. */
  const [tentativa, setTentativa] = useState(0)

  // A ponte vive enquanto a tela vive: uma por sessão (a `key` é a sessão).
  useEffect(() => {
    const origem = new URL(urlDoJogo, window.location.href).origin
    const ponte = criarPonteDaBolha({
      janela: () => quadroRef.current?.contentWindow ?? null,
      enviar: (texto) => quadroRef.current?.contentWindow?.postMessage(texto, origem),
      aoTerminar: (placar) => acoesRef.current.fimBolha(placar),
      aoMudar: (estado, erro) => {
        setEstadoDoJogo(estado)
        if (erro !== undefined) setErroDoJogo(erro)
        // Carregou ou falhou: a espera da carga acabou.
        if (estado !== 'carregando') vigiaRef.current?.encerrar()
        // Jogo quebrado aqui: o mestre fica sabendo, e ninguém espera o placar deste aparelho.
        if (estado === 'erro') acoesRef.current.falhouBolha()
      },
      aoCarregar: (progresso) => {
        setCarga(progresso)
        vigiaRef.current?.progresso(progresso)
      },
    })
    ponteRef.current = ponte
    const aoReceber = (ev: MessageEvent) => ponte.receber({ source: ev.source, data: ev.data })
    window.addEventListener('message', aoReceber)
    return () => {
      window.removeEventListener('message', aoReceber)
      ponteRef.current = null
    }
  }, [urlDoJogo])

  // A cada carga do iframe (a primeira e cada "Tentar de novo"): o jogo que não chega vira
  // erro, em vez de "Carregando" para sempre; a conferência pega na hora a rota que o mestre não serve.
  useEffect(() => {
    setCarga(null)
    const vigia = criarVigiaDaCarga({
      agendar: (fazer, ms) => {
        const id = window.setTimeout(fazer, ms)
        return () => window.clearTimeout(id)
      },
      depoisDaFila: depoisDasMensagensNaFila,
      aoParar: (motivo) => ponteRef.current?.falhouCarga(ERRO_DA_ESPERA[motivo]),
    })
    vigiaRef.current = vigia
    let viva = true
    const conferencia = new AbortController()
    fetch(urlDoJogo, { method: 'HEAD', cache: 'no-store', signal: conferencia.signal })
      .then((resposta) => {
        if (viva && !resposta.ok) ponteRef.current?.falhouCarga(ERRO_DO_JOGO_AUSENTE)
      })
      // Sem resposta (rede caída, ou a tela fechou e abortou): quem decide é a vigia.
      .catch(() => undefined)
    return () => {
      viva = false
      conferencia.abort()
      vigia.encerrar()
      vigiaRef.current = null
    }
  }, [urlDoJogo, tentativa])

  const tentarDeNovo = () => {
    if (ponteRef.current?.recarregar() !== true) return
    setErroDoJogo(null)
    setTentativa((n) => n + 1)
  }

  const comecar = bolha.comecar
  useEffect(() => {
    if (comecar === undefined || playerId === undefined) return
    ponteRef.current?.iniciar({ ...comecar, eu: playerId })
    // O teclado vai para o jogo (Esc pausa lá dentro).
    quadroRef.current?.focus()
  }, [comecar, playerId])

  useEffect(() => {
    ponteRef.current?.pausar(bolha.pausada)
  }, [bolha.pausada])

  const encerrada = bolha.encerrada
  useEffect(() => {
    if (encerrada !== undefined) ponteRef.current?.encerrar()
  }, [encerrada])

  const emJogo = comecar !== undefined && encerrada === undefined && bolha.desfecho === undefined
  // `parou`: a partida começou, mas o jogo quebrou neste aparelho (o mestre já foi avisado).
  const tela =
    bolha.desfecho !== undefined ? 'resultado' : encerrada !== undefined ? 'encerrada' : emJogo ? (estadoDoJogo === 'erro' ? 'parou' : 'jogo') : 'convite'

  return (
    <div className={`lb-bolha lb-bolha--${tela}`} role="dialog" aria-modal="true" aria-label={NOME_DO_JOGO_BOLHA}>
      {/* A `key` é a tentativa: "Tentar de novo" troca o iframe por outro, que carrega do zero. */}
      <iframe
        key={tentativa}
        ref={quadroRef}
        className="lb-bolha__jogo"
        src={urlDoJogo}
        title={`${NOME_DO_JOGO_BOLHA}: o jogo`}
        allow="autoplay; fullscreen"
        aria-hidden={tela !== 'jogo'}
        tabIndex={tela === 'jogo' ? 0 : -1}
      />
      {tela === 'convite' && (
        <Convite bolha={bolha} playerId={playerId} estadoDoJogo={estadoDoJogo} erroDoJogo={erroDoJogo} carga={carga} aoTentarDeNovo={tentarDeNovo} acoes={acoes} />
      )}
      {tela === 'jogo' && comecar !== undefined && (
        <div className="lb-bolha__barra" aria-live="polite">
          <span>
            {NOME_DO_JOGO_BOLHA} · {NOME_DO_CENARIO_BOLHA[comecar.cenario]} · {NOME_DA_DIFICULDADE_BOLHA[comecar.dificuldade]} · {comecar.modo === 'equipe' ? 'Equipe' : 'Solo'}
          </span>
          {estadoDoJogo === 'carregando' && <span>Carregando o jogo…</span>}
          {bolha.pausada && <span className="lb-bolha__selo">Pausado pelo mestre</span>}
          {bolha.fimEnviado && <span className="lb-bolha__selo">Placar enviado: esperando o resultado da mesa…</span>}
        </div>
      )}
      {tela === 'parou' && (
        <div className="lb-bolha__cartao" role="alert">
          <h2 className="lb-bolha__titulo">{NOME_DO_JOGO_BOLHA}</h2>
          <p>O jogo parou neste aparelho{erroDoJogo === null ? '' : ` (${erroDoJogo})`}. Você saiu da partida e o mestre já sabe.</p>
          <button type="button" className="lb-btn lb-btn--primary" onClick={acoes.fecharBolha}>
            Voltar ao mapa
          </button>
        </div>
      )}
      {tela === 'resultado' && <Resultado bolha={bolha} playerId={playerId} onFechar={acoes.fecharBolha} />}
      {tela === 'encerrada' && encerrada !== undefined && (
        <div className="lb-bolha__cartao" role="alert">
          <h2 className="lb-bolha__titulo">{NOME_DO_JOGO_BOLHA}</h2>
          <p>{MOTIVO_DO_ENCERRAMENTO_BOLHA[encerrada]}</p>
          <button type="button" className="lb-btn lb-btn--primary" onClick={acoes.fecharBolha}>
            Voltar ao mapa
          </button>
        </div>
      )}
    </div>
  )
}

interface ConviteProps {
  bolha: BolhaDoJogador
  playerId: string | undefined
  estadoDoJogo: EstadoDaPonteDaBolha
  erroDoJogo: string | null
  carga: ProgressoDaCarga | null
  aoTentarDeNovo(): void
  acoes: AcoesDaBolha
}

/** Como cada chamado aparece na lista do convite. */
function statusNoConvite(status: BolhaStatus | undefined): string {
  if (status === 'pronto') return 'Pronto'
  if (status === 'fora') return 'Ficou de fora'
  return 'Esperando'
}

function Convite({ bolha, playerId, estadoDoJogo, erroDoJogo, carga, aoTentarDeNovo, acoes }: ConviteProps) {
  const c = bolha.convite
  const solo = c.modo === 'solo'
  // SOZINHO NO PINO: ninguém espera o mestre. A dificuldade é a que ele deixou;
  // na "escolha", o jogador escolhe aqui, e o "Começar" já abre a partida.
  const sozinho = c.sozinho
  const [dificuldade, setDificuldade] = useState<DificuldadeBolha>(() => (sozinho === undefined || sozinho.permitida === 'escolha' ? 'normal' : sozinho.permitida))
  // Só com o jogo carregado: Pronto sem jogo deixaria a mesa esperando um placar que nunca sai.
  const jogoCarregado = estadoDoJogo === 'esperando'
  // O motivo e o "Tentar de novo" ficam no fim do cartão: em janela baixa o cartão rola
  // por dentro, e o erro tem de aparecer sem a pessoa procurar.
  const erroRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (estadoDoJogo === 'erro') erroRef.current?.scrollIntoView({ block: 'nearest' })
  }, [estadoDoJogo])
  const statusDe = (id: string) => bolha.estado?.participantes.find((p) => p.playerId === id)?.status
  return (
    <div className="lb-bolha__cartao">
      <p className="lb-bolha__eyebrow">
        {NOME_DO_JOGO_BOLHA} · {NOME_DO_CENARIO_BOLHA[c.cenario]} · {sozinho !== undefined ? 'sozinho' : solo ? 'cada um no seu fogo' : 'em equipe'}
      </p>
      <h2 className="lb-bolha__titulo">{c.npc === '' ? 'Pedido de ajuda' : c.npc}</h2>
      {c.fala !== '' && <p className="lb-bolha__fala">“{c.fala}”</p>}
      {c.premio.texto !== '' && <p className="lb-bolha__premio">Se apagarem o fogo: {c.premio.texto}</p>}
      {c.consequencia.texto !== '' && <p className="lb-bolha__consequencia">Se o fogo vencer: {c.consequencia.texto}</p>}
      <p className="lb-bolha__aviso" role="note">
        {AVISO_MOUSE_BOLHA}
      </p>
      {sozinho === undefined && (
        <p className="lb-bolha__dica">
          {solo
            ? 'Cada um apaga o próprio fogo, na própria tela.'
            : 'Em equipe todos começam o mesmo fogo, cada um na sua tela; no fim a mesa compara os pontos.'}
        </p>
      )}
      {sozinho !== undefined &&
        (sozinho.permitida === 'escolha' ? (
          <fieldset className="lb-bolha__escolha">
            <legend>Dificuldade</legend>
            {DIFICULDADES_BOLHA.map((d) => (
              <label key={d} className="lb-bolha__opcao">
                <input type="radio" name={`bolha-dificuldade-${bolha.sessao}`} value={d} checked={dificuldade === d} disabled={bolha.pronto} onChange={() => setDificuldade(d)} />
                <span className="lb-bolha__opcao-nome">{NOME_DA_DIFICULDADE_BOLHA[d]}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="lb-bolha__dica">Dificuldade: {NOME_DA_DIFICULDADE_BOLHA[sozinho.permitida]} (o mestre escolheu).</p>
        ))}
      <p className="lb-bolha__dica">{CONTROLES_DA_BOLHA}</p>
      {sozinho === undefined && (
        <ul className="lb-bolha__mesa" aria-label="Quem foi chamado">
          {c.participantes.map((p) => (
            <li key={p.playerId}>
              <span className="lb-bolha__nome">{p.playerId === playerId ? `${p.nome} (você)` : p.nome}</span>
              <span>{statusNoConvite(statusDe(p.playerId))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="lb-bolha__acoes">
        {sozinho !== undefined ? (
          <button type="button" className="lb-btn lb-btn--primary" disabled={!jogoCarregado || bolha.pronto} onClick={() => acoes.prontoBolha(dificuldade)}>
            {bolha.pronto ? 'Começando…' : 'Começar'}
          </button>
        ) : (
          <button type="button" className="lb-btn lb-btn--primary" disabled={!jogoCarregado || bolha.pronto} onClick={() => acoes.prontoBolha()}>
            {bolha.pronto ? 'Pronto: esperando o mestre começar' : 'Pronto'}
          </button>
        )}
        <button type="button" className="lb-btn lb-btn--ghost" onClick={acoes.fecharBolha}>
          Agora não
        </button>
      </div>
      {estadoDoJogo === 'carregando' ? (
        <div className="lb-bolha__carga">
          {/* Sem `value` a barra fica indeterminada: o jogo não diz quanto falta. */}
          <progress className="lb-bolha__carga-barra" max={carga?.total} value={carga?.atual} aria-label="Carga do jogo" />
          <p className="lb-bolha__dica">{textoDaCarga(carga, sozinho === undefined ? 'Pronto' : 'Começar')}</p>
        </div>
      ) : estadoDoJogo === 'erro' ? (
        <div className="lb-bolha__carga" role="alert" ref={erroRef}>
          <p className="lb-bolha__carga-erro">
            O jogo não carregou{erroDoJogo === null ? '' : ` (${erroDoJogo})`}. {oQueFazerSemOJogo(erroDoJogo)}
          </p>
          <button type="button" className="lb-btn" onClick={aoTentarDeNovo}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <p className="lb-bolha__dica" aria-live="polite">
          Jogo carregado.
        </p>
      )}
    </div>
  )
}

/** "1:01": os segundos da partida como o jogo mostra no fim. */
function tempoDaPartida(segundos: number): string {
  const total = Math.floor(segundos)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Estrelas({ estrelas }: { estrelas: number }) {
  return (
    <span className="lb-bolha__estrelas" role="img" aria-label={rotuloDasEstrelas(estrelas)}>
      {desenhoDasEstrelas(estrelas)}
    </span>
  )
}

/** O placar DESTE jogador: como acabou e os números. */
function SeuPlacar({ placar: p }: { placar: BolhaPlacar }) {
  const motivo = fraseDoMotivoBolha(p.motivo)
  return (
    <>
      {motivo !== null && <p className="lb-bolha__motivo">{motivo}</p>}
      <p className="lb-bolha__numeros">
        {textoDosPontos(p.pontos)} · <Estrelas estrelas={p.estrelas} />
      </p>
      <p className="lb-bolha__dica lb-bolha__numeros">
        {textoDosFocos(p.focosApagados)} · {p.acertos} de {p.bolhas} bolhas acertaram ({p.precisao}%) · {tempoDaPartida(p.tempoS)}
      </p>
    </>
  )
}

function Resultado({ bolha, playerId, onFechar }: { bolha: BolhaDoJogador; playerId: string | undefined; onFechar(): void }) {
  const d = bolha.desfecho
  if (d === undefined) return null
  return (
    <div className="lb-bolha__cartao" role="alert">
      <p className="lb-bolha__eyebrow">
        {NOME_DO_JOGO_BOLHA} · {NOME_DO_CENARIO_BOLHA[bolha.convite.cenario]}
      </p>
      <h2 className="lb-bolha__titulo">{d.seu.passou ? 'Fogo apagado!' : 'O fogo venceu desta vez'}</h2>
      {d.placar !== undefined ? <SeuPlacar placar={d.placar} /> : <p className="lb-bolha__dica">Você não terminou esta partida.</p>}
      {d.seu.premio !== undefined && d.seu.premio.texto !== '' && <p className="lb-bolha__premio">{d.seu.premio.texto}</p>}
      {d.seu.consequencia !== undefined && d.seu.consequencia.texto !== '' && <p className="lb-bolha__consequencia">{d.seu.consequencia.texto}</p>}
      {d.mesa.length > 0 && (
        <ul className="lb-bolha__mesa" aria-label="Como foi cada um">
          {d.mesa.map((linha) => (
            <li key={linha.playerId}>
              <span className="lb-bolha__nome">{linha.playerId === playerId ? `${linha.nome} (você)` : linha.nome}</span>
              <span>{NOME_DO_RESULTADO_BOLHA[linha.resultado]}</span>
              <span className="lb-bolha__numeros">
                {textoDosPontos(linha.pontos)} · <Estrelas estrelas={linha.estrelas} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="lb-btn lb-btn--primary" onClick={onFechar}>
        Voltar ao mapa
      </button>
    </div>
  )
}
