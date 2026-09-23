import type { MapData, RegionPoint, Token } from '../types/map'
import { decodeExploration, type Exploration } from '../lib/exploration'
import {
  DOOR_REQUEST_REJECTIONS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  isDoorRequestHow,
  type DoorRequestAnswer,
  type DoorRequestHow,
  type DoorRequestRejection,
  type DoorToggleRejection,
  type JoinMessage,
  type PinTravelRejection,
  type PinTravelRequestMessage,
  type PlayerMessage,
} from '../net/protocol'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import { passageOf } from '../lib/pins'
import { MAX_ACTIVE_SIGNALS, SIGNAL_COLOR_PATTERN, SIGNAL_TTL_MS, type SignalMark } from '../lib/signals'
import { LASER_SEND_INTERVAL_MS, LASER_TRAIL_MS, appendLaserPoints, pruneLaserTrail, type LaserTrail } from '../lib/laser'
import {
  CALL_TEXT_MAX_LENGTH,
  isCallReason,
  parseCallReply,
  parseLaserMessage,
  parsePartyUpdate,
  parseSceneNote,
  type CallRaiseMessage,
  type CallReason,
  type PartyMember,
} from '../net/protocol'

/**
 * Cliente WebSocket do jogador, sem React e sem DOM: o socket e o storage são
 * injetáveis para teste. O estado é imutável — cada mudança gera um objeto novo
 * e avisa os ouvintes (encaixa em `useSyncExternalStore`).
 */

/** `closed`: o mestre avisou que encerrou a sala (`room.closed`) — fim de sessão, não falha de rede. */
export type PlayerStatus = 'connecting' | 'waiting' | 'playing' | 'kicked' | 'closed' | 'error'

export interface PlayerState {
  status: PlayerStatus
  map?: MapData
  vision?: RegionPoint[][]
  /** O que o jogador já viu neste mapa (autoridade do mestre). */
  explored?: Exploration
  /** Ids dos tokens do próprio jogador presentes no mapa recebido. */
  ownTokens?: string[]
  /** Polígonos das zonas ocultas ativas: o jogador pinta preto por cima. */
  concealed?: RegionPoint[][]
  /** Sinais recebidos ainda vivos (somem sozinhos depois de `SIGNAL_TTL_MS`). */
  signals?: SignalMark[]
  /** Rastro do laser do mestre; some sozinho `LASER_TRAIL_MS` depois da última mensagem com o laser desligado. */
  laser?: LaserTrail
  /**
   * Recusa do mestre ao pedido de porta (trancada, longe, não visível). `id`
   * novo repete o aviso. Longe e não visível somem sozinhos; "Trancada" fica
   * até o jogador escolher (Bater, Forçar, Usar chave) ou fechar, e guarda
   * `wallId` para o pedido saber de que porta é.
   */
  doorNotice?: DoorNotice
  /** O pedido da porta trancada: enviado, a resposta do mestre ou a recusa do host. Some sozinho. */
  doorRequest?: { id: number; phase: DoorRequestPhase }
  /** Pedido de passagem: esperando o mestre, ou a resposta dele. */
  travel?: TravelNotice
  /**
   * Recado do mestre para a cena do jogador. Fica até ele fechar
   * (`dismissNote`); um recado novo toma o lugar do aberto. É texto puro: a
   * tela o mostra como texto, nunca como HTML. `onlyYou`: o mestre mandou só
   * para este jogador (a tela diz "Só para você").
   */
  note?: { id: string; text: string; onlyYou?: true }
  /**
   * PAUSA POR CENA: o mestre pausou a cena deste jogador (está com outro
   * grupo). Enquanto `true`, a tela mostra o aviso fixo; quem manda é o host,
   * que recusa o movimento — o aviso só explica por que a ficha volta.
   */
  paused?: true
  /**
   * Os OUTROS jogadores da mesa e onde estão para ele (aqui, longe, fora).
   * Ausente até o primeiro `party.update`. Sobrevive à espera no lobby: o host
   * só reenvia quando muda, então apagar aqui deixaria a lista vazia na volta.
   */
  party?: PartyMember[]
  /** A mão do jogador (chamar o mestre): acesa esperando, ou a resposta curta do mestre. */
  call?: CallNotice
  rev: number
  playerId?: string
  /** Motivo quando `status === 'error'`: razão do mestre ou 'connection_lost'. */
  error?: string
  /**
   * A conexão caiu depois de entrar na sala e o cliente está tentando voltar
   * sozinho. O `status` e o mapa ficam como estavam (a tela esmaece); some
   * quando o mestre aceita a volta (`welcome`).
   */
  reconnecting?: ReconnectInfo
}

/** Como vai a volta automática depois de uma queda. */
export interface ReconnectInfo {
  /** Quando a conexão caiu (relógio do aparelho, ms). */
  since: number
  /** Tentativas feitas desde a queda. */
  attempt: number
  /** Já passou `MANUAL_RECONNECT_AFTER_MS`: a tela oferece "Reconectar". */
  manual: boolean
}

/** O aviso da recusa do toque na porta; `wallId` é a porta tocada. */
export interface DoorNotice {
  id: number
  reason: DoorToggleRejection
  wallId: string
}

/** `sent`: saiu para o mestre; `opened`/`denied`: a resposta dele; o resto: o host nem levou ao mestre. */
export type DoorRequestPhase = 'sent' | DoorRequestAnswer | DoorRequestRejection

/**
 * Onde está o pedido de passagem pelo pino de viagem. `waiting` fica até o
 * mestre responder; os outros três somem sozinhos. `id` novo repete o aviso.
 * Nenhum deles sabe para onde o pino leva: o host nunca conta.
 */
export type TravelNotice =
  /** `direct`: o pino é livre, ninguém decide — só falta a resposta do host. */
  | { id: number; phase: 'waiting'; direct: boolean }
  | { id: number; phase: 'arrived' }
  /** O mestre levou o jogador para outra cena sem ele pedir. */
  | { id: number; phase: 'moved' }
  /** O mestre reuniu o grupo num pino e trouxe o jogador de outra cena. */
  | { id: number; phase: 'gathered' }
  | { id: number; phase: 'denied' }
  | { id: number; phase: 'rejected'; reason: PinTravelRejection }

/**
 * Onde está a mão do jogador. `waiting` fica até o mestre responder (ou ele
 * baixar); `seen` ("O mestre viu") e `too_soon` ("espere um instante") somem
 * sozinhos depois de `CALL_NOTICE_TTL_MS`. A resposta escrita do mestre não
 * mora aqui: vira `note`, o mesmo cartão do recado.
 */
export type CallNotice = { id: number; phase: 'waiting'; reason: CallReason } | { id: number; phase: 'seen' } | { id: number; phase: 'too_soon' }

/** Subconjunto do WebSocket do browser que este cliente usa. */
export interface SocketLike {
  readonly readyState: number
  send(data: string): void
  close(): void
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PlayerConnectionOptions {
  url: string
  code: string
  name: string
  createSocket: (url: string) => SocketLike
  storage: StorageLike | null
  /**
   * A aba está em segundo plano agora? (No navegador, `document.visibilityState
   * === 'hidden'`.) Ausente = sempre à vista.
   */
  isHidden?: () => boolean
}

export interface PlayerConnection {
  getState(): PlayerState
  subscribe(listener: () => void): () => void
  /** Move otimista: aplica local e envia. `false` se o token não existe ou o socket não está aberto. */
  requestMove(tokenId: string, x: number, y: number): boolean
  /** Sinal no ponto (px de mundo). `false` se não está jogando ou o socket não está aberto. */
  sendSignal(x: number, y: number): boolean
  /** Pede ao mestre para abrir/fechar a porta. `false` se não está jogando ou o socket não está aberto. */
  toggleDoor(wallId: string): boolean
  /**
   * Pede ao mestre para passar pela porta trancada `wallId` — Bater, Forçar ou
   * Usar chave. Troca o "Trancada" por "Pedido enviado". `false` se não está
   * jogando, o pedido é malformado ou o socket não está aberto.
   */
  requestDoor(wallId: string, how: DoorRequestHow): boolean
  /** Fecha o aviso da porta (o × do "Trancada"). */
  dismissDoorNotice(): void
  /**
   * Nome novo do PRÓPRIO token: aplica na hora e envia. `false` quando o token
   * não é dele, não está no mapa, o nome não cabe ou o socket não está aberto.
   */
  setOwnTokenName(tokenId: string, name: string): boolean
  /**
   * Foto nova do PRÓPRIO token (referência auto-contida). Mesmas recusas de
   * `setOwnTokenName`, mais a forma da foto.
   */
  setOwnTokenPhoto(tokenId: string, image: string): boolean
  /**
   * Pede ao mestre para passar pelo pino de viagem `pinId` — ou, no pino
   * livre, passa (o pedido sai depois de `FREE_PASSAGE_BEAT_MS`). `false` se
   * não está jogando, se já há um pedido esperando ou se o socket não está aberto.
   * `exitId` é a saída escolhida numa encruzilhada (um id de `Pin.escolhas`);
   * ausente, o pedido sai sem ele e vale a saída principal, como sempre.
   */
  requestTravel(pinId: string, exitId?: string): boolean
  /** Fecha o recado aberto (botão "Fechar" ou Escape do cartão). */
  dismissNote(): void
  /**
   * Levanta a mão: chama o mestre com o motivo e, opcional, um texto curto
   * (aparado; em branco não viaja). `false` se não está jogando, se a mão já
   * está levantada, se o texto passa de `CALL_TEXT_MAX_LENGTH` ou se o socket
   * não está aberto.
   */
  raiseHand(reason: CallReason, text?: string): boolean
  /** Baixa a mão antes de o mestre ver. `false` se ela não estava levantada ou o socket não está aberto. */
  lowerHand(): boolean
  /** Abre um socket novo (reconectar), reaproveitando o resumeToken guardado. */
  reconnect(): void
  /**
   * A tela acendeu ou a rede voltou: se está reconectando e nenhuma tentativa
   * está no ar, tenta AGORA em vez de esperar a espera crescente.
   */
  wake(): void
  /** "Reconectar" da tela de queda: tenta agora, largando a tentativa no ar se houver. */
  retryNow(): void
  close(): void
}

export const RESUME_STORAGE_KEY = 'labirinto.resume'
/**
 * O `ping` sai a cada 2 s e o host responde `pong`. Era 15 s, só para manter o
 * túnel acordado; agora é também a prova de vida dos dois lados, e precisa
 * caber no aceite "Grupo mostra 'Gina caiu' em 0:10" (ver `HOST_STALE_AFTER_MS`
 * do hostBridge). Numa mesa de 7 são 3,5 mensagens minúsculas por segundo.
 */
export const PING_INTERVAL_MS = 2_000
/**
 * Sem NADA do host há isto (nem pong, nem snapshot), o socket conta como morto
 * mesmo sem `close`: o Wi-Fi que some sem FIN deixa o navegador achando que
 * está tudo aberto por minutos. Dois pings e meio de folga; e abaixo do prazo
 * do host (6 s), para o jogador já estar voltando quando o mestre souber.
 */
export const SILENCE_DEAD_AFTER_MS = 5_000
/**
 * A tela acendeu e o host está mudo há mais que `SILENCE_DEAD_AFTER_MS`: um
 * ping sai na hora e, sem resposta nisto, a volta começa sem esperar a espera
 * crescente. Não derruba direto porque o silêncio pode ser só do timer da aba
 * oculta (Chrome e Edge rodam o ping 1 vez por minuto depois de 5 min em
 * segundo plano) com a conexão viva; na LAN o pong volta em milissegundos.
 */
export const WAKE_PROBE_MS = 800
/** Quanto tempo o aviso da porta ("Chegue mais perto") fica na tela. O "Trancada" fica até o jogador escolher. */
export const DOOR_NOTICE_TTL_MS = 2500
/** Quanto tempo o aviso do pedido da porta ("Pedido enviado", "O mestre abriu") fica na tela. */
export const DOOR_REQUEST_NOTICE_TTL_MS = 4000
/** Quanto tempo a recusa do mestre ("não deixou passar agora") fica na tela. Mais que a porta. */
export const TRAVEL_NOTICE_TTL_MS = 4000
/** Quanto tempo "O mestre viu" e "Espere um instante" ficam no lugar da mão. */
export const CALL_NOTICE_TTL_MS = 4000
/**
 * "Você chegou" é mudança de lugar: sai quando o jogador mexe a própria ficha
 * (aí já viu onde está, mesma regra da reunião) ou depois deste teto. Era
 * 4 s, igual à recusa, e não bastava com a mesa cheia: no "Deixar todos" da
 * caixa de pedidos vários chegam juntos, e medido na jornada da caixa o aviso
 * de Carla sumia antes de alguém olhar a tela dela — com 8 s e com 20 s
 * também. O teto é o mesmo da reunião: quem sai é o gesto do jogador.
 */
export const ARRIVAL_NOTICE_TTL_MS = 60_000
/**
 * Pausa entre confirmar a passagem LIVRE e o pedido sair: o tempo de o cartão
 * fechar e o "Passando…" aparecer antes de a cena trocar. Curta de propósito —
 * é uma batida, não uma espera.
 */
export const FREE_PASSAGE_BEAT_MS = 450
/**
 * "O mestre levou você para outro lugar": quem foi LEVADO não esperava nada e
 * pode estar olhando a mesa quando o mapa troca. Mesmo teto e mesma saída
 * (mexer a ficha) do "Você chegou" e da reunião.
 */
export const MOVED_NOTICE_TTL_MS = 60_000
/**
 * "O mestre reuniu o grupo" espera o jogador: a reunião costuma vir depois de
 * uma pausa da mesa, com o jogador olhando para longe da tela. Some quando
 * ele mexe a própria ficha (aí já viu onde está) ou depois de um minuto.
 */
export const GATHERED_NOTICE_TTL_MS = 60_000
/**
 * Espera da reconexão automática: dobra a cada tentativa que falha, de 1 s
 * até este teto. Trinta segundos é o mais longo que um celular esperaria sem
 * a pessoa achar que o app desistiu — e a rede que volta (`online`) ou a tela
 * que acende (`visibilitychange`) cortam a espera pelo `wake`.
 */
export const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_FIRST_DELAY_MS = 1_000
/** Depois disto fora, a tela oferece "Reconectar" (as tentativas sozinhas continuam). */
export const MANUAL_RECONNECT_AFTER_MS = 30_000
/**
 * Tentativa que nem abre nem fecha (Wi-Fi trocando de rede, rota que some)
 * é abandonada depois disto: sem o prazo, ela prenderia a reconexão para sempre.
 */
export const RECONNECT_ATTEMPT_TIMEOUT_MS = 8_000
const SOCKET_OPEN = 1
const CONNECTION_LOST = 'connection_lost'

/** Espera antes da tentativa `attempt` (1 = a primeira depois da queda). */
export function reconnectDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt - 1)
  return Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_FIRST_DELAY_MS * 2 ** exponent)
}

interface PendingMove {
  tokenId: string
  x: number
  y: number
  prevX: number
  prevY: number
}

interface StoredResume {
  code: string
  token: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPointList(value: unknown): value is RegionPoint[] {
  return Array.isArray(value) && value.every((p) => isRecord(p) && isFiniteNumber(p.x) && isFiniteNumber(p.y))
}

function isVision(value: unknown): value is RegionPoint[][] {
  return Array.isArray(value) && value.every(isPointList)
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/**
 * Checagem estrutural rasa do mapa: vem do mestre (fonte confiável), então só
 * garante os campos que o render e o move otimista tocam — não revalida o
 * MapData inteiro.
 */
function isMapShape(value: unknown): value is MapData {
  if (!isRecord(value)) return false
  const { width, height, grid, tokens, floor, lines, markers, floorStyle, hiddenLayers } = value
  return (
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    isFiniteNumber(grid) &&
    Array.isArray(tokens) &&
    tokens.every((t) => isRecord(t) && typeof t.id === 'string' && isFiniteNumber(t.x) && isFiniteNumber(t.y)) &&
    Array.isArray(floor) &&
    Array.isArray(lines) &&
    Array.isArray(markers) &&
    isRecord(floorStyle) &&
    Array.isArray(hiddenLayers)
  )
}

function readResume(storage: StorageLike | null, code: string): string | undefined {
  if (!storage) return undefined
  try {
    const raw = storage.getItem(RESUME_STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (isRecord(parsed) && parsed.code === code && typeof parsed.token === 'string') return parsed.token
  } catch {
    // Storage bloqueado ou conteúdo corrompido: entra sem resume.
  }
  return undefined
}

function writeResume(storage: StorageLike | null, value: StoredResume | null): void {
  if (!storage) return
  try {
    if (value) storage.setItem(RESUME_STORAGE_KEY, JSON.stringify(value))
    else storage.removeItem(RESUME_STORAGE_KEY)
  } catch {
    // Storage indisponível: resume só não sobrevive ao reload.
  }
}

function withTokenAt(map: MapData, tokenId: string, x: number, y: number): MapData {
  return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
}

function withTokenPatch(map: MapData, tokenId: string, patch: Partial<Token>): MapData {
  return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t)) }
}

export function createPlayerConnection(options: PlayerConnectionOptions): PlayerConnection {
  const { url, code, name, createSocket, storage } = options
  const listeners = new Set<() => void>()
  const pending = new Map<string, PendingMove>()
  let state: PlayerState = { status: 'connecting', rev: -1 }
  let socket: SocketLike | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  const isHidden = options.isHidden ?? (() => false)
  /** Quando chegou a última mensagem do host no socket atual (relógio do aparelho). */
  let lastHeardAt = 0
  /**
   * Desde quando a aba está de novo à vista e o silêncio volta a contar. O que
   * se passou com a aba oculta não prova nada: o timer do ping estava preso.
   */
  let watchingSince = 0
  /** Confirmação de vida depois de a tela acender (`WAKE_PROBE_MS`). */
  let wakeProbeTimer: ReturnType<typeof setTimeout> | null = null
  let nextReqId = 1
  const signalTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let nextSignalId = 1

  function clearSignalTimers(): void {
    for (const timer of signalTimers.values()) clearTimeout(timer)
    signalTimers.clear()
  }

  function addSignal(x: number, y: number, from: string, color: string): void {
    const id = `s${nextSignalId++}`
    const current = state.signals ?? []
    // Acima do teto sai o mais antigo; o timer dele vira no-op ao não achar o id.
    const kept = current.length >= MAX_ACTIVE_SIGNALS ? current.slice(current.length - MAX_ACTIVE_SIGNALS + 1) : current
    setState({ signals: [...kept, { id, x, y, name: from, color, createdAt: Date.now() }] })
    signalTimers.set(
      id,
      setTimeout(() => {
        signalTimers.delete(id)
        setState({ signals: (state.signals ?? []).filter((s) => s.id !== id) })
      }, SIGNAL_TTL_MS),
    )
  }

  let doorNoticeTimer: ReturnType<typeof setTimeout> | null = null
  let nextNoticeId = 1

  function clearDoorNotice(): void {
    if (doorNoticeTimer !== null) clearTimeout(doorNoticeTimer)
    doorNoticeTimer = null
  }

  /** Recusa do toque. Um aviso de porta por vez (o do pedido sai): os dois ocupam o mesmo lugar da tela. */
  function showDoorNotice(reason: DoorToggleRejection, wallId: string): void {
    clearDoorNotice()
    setState({ doorNotice: { id: nextNoticeId++, reason, wallId }, doorRequest: undefined })
    // "Trancada" não some sozinho: dele saem os botões do pedido, e o jogador precisa de tempo para escolher.
    if (reason === 'locked') return
    doorNoticeTimer = setTimeout(() => {
      doorNoticeTimer = null
      setState({ doorNotice: undefined })
    }, DOOR_NOTICE_TTL_MS)
  }

  function showDoorRequest(phase: DoorRequestPhase): void {
    clearDoorNotice()
    setState({ doorRequest: { id: nextNoticeId++, phase }, doorNotice: undefined })
    doorNoticeTimer = setTimeout(() => {
      doorNoticeTimer = null
      setState({ doorRequest: undefined })
    }, DOOR_REQUEST_NOTICE_TTL_MS)
  }

  let travelTimer: ReturnType<typeof setTimeout> | null = null

  function clearTravelTimer(): void {
    if (travelTimer !== null) clearTimeout(travelTimer)
    travelTimer = null
  }

  /** Resposta do mestre (ou do host): aparece e some sozinha. */
  function showTravelAnswer(notice: TravelNotice): void {
    clearTravelTimer()
    setState({ travel: notice })
    travelTimer = setTimeout(
      () => {
        travelTimer = null
        setState({ travel: undefined })
      },
      travelNoticeTtl(notice),
    )
  }

  function travelNoticeTtl(notice: TravelNotice): number {
    if (notice.phase === 'gathered') return GATHERED_NOTICE_TTL_MS
    if (notice.phase === 'moved') return MOVED_NOTICE_TTL_MS
    return notice.phase === 'arrived' ? ARRIVAL_NOTICE_TTL_MS : TRAVEL_NOTICE_TTL_MS
  }

  let callTimer: ReturnType<typeof setTimeout> | null = null

  function clearCallTimer(): void {
    if (callTimer !== null) clearTimeout(callTimer)
    callTimer = null
  }

  /** "O mestre viu" / "Espere um instante": ficam no lugar da mão e somem sozinhos. */
  function showCallAnswer(phase: 'seen' | 'too_soon'): void {
    clearCallTimer()
    setState({ call: { id: nextNoticeId++, phase } })
    callTimer = setTimeout(() => {
      callTimer = null
      setState({ call: undefined })
    }, CALL_NOTICE_TTL_MS)
  }

  /** `call.state` do mestre. Fora do jogo não há mão na tela. */
  function handleCallState(data: Record<string, unknown>): void {
    if (state.status !== 'playing') return
    if (data.state === 'waiting' && isCallReason(data.reason)) {
      // O "waiting" só confirma a mão acesa aqui; mesmo `id`, nada reanima na tela.
      // Mão já baixada: é a confirmação atrasada de um chamado que o mestre
      // apagou no `call.lower` — reacender deixaria "Esperando o mestre" para
      // sempre, sem linha nenhuma na fila do mestre.
      if (state.call?.phase !== 'waiting') return
      clearCallTimer()
      setState({ call: { id: state.call.id, phase: 'waiting', reason: data.reason } })
      return
    }
    if (data.state === 'seen' || data.state === 'too_soon') showCallAnswer(data.state)
  }

  let laserTimer: ReturnType<typeof setTimeout> | null = null

  function clearLaserTimer(): void {
    if (laserTimer !== null) clearTimeout(laserTimer)
    laserTimer = null
  }

  /**
   * Atualiza o rastro e agenda a limpeza. Ligado, a limpeza guarda só a ponta
   * (o mestre pode estar parado apontando); desligado, some tudo.
   */
  function updateLaser(next: LaserTrail): void {
    setState({ laser: next })
    clearLaserTimer()
    laserTimer = setTimeout(() => {
      laserTimer = null
      const current = state.laser
      if (current === undefined) return
      const last = current.points.at(-1)
      setState({ laser: current.on && last !== undefined ? { points: [last], on: true } : undefined })
    }, LASER_TRAIL_MS)
  }

  function setState(patch: Partial<PlayerState>): void {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  /** Próxima tentativa agendada, virada do "Reconectar" e prazo da tentativa no ar. */
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let manualTimer: ReturnType<typeof setTimeout> | null = null
  let attemptTimer: ReturnType<typeof setTimeout> | null = null

  function clearAttemptTimer(): void {
    if (attemptTimer !== null) clearTimeout(attemptTimer)
    attemptTimer = null
  }

  function clearReconnectTimers(): void {
    if (retryTimer !== null) clearTimeout(retryTimer)
    if (manualTimer !== null) clearTimeout(manualTimer)
    retryTimer = null
    manualTimer = null
    clearAttemptTimer()
  }

  /**
   * Caiu depois de entrar: o mapa fica, a tela esmaece, e o cliente tenta
   * voltar sozinho. `rev` volta a -1 porque o host responde a volta com o
   * snapshot do rev ATUAL dele — igual ao último que chegou, se ninguém mexeu
   * em nada — e esse snapshot precisa valer.
   */
  function beginReconnect(): void {
    pending.clear()
    // O host esquece o pedido de passagem de quem cai: "Aguardando o mestre…" mentiria.
    const travelWaiting = state.travel?.phase === 'waiting'
    if (travelWaiting) clearTravelTimer()
    setState({ rev: -1, reconnecting: { since: Date.now(), attempt: 0, manual: false }, ...(travelWaiting ? { travel: undefined } : {}) })
    manualTimer = setTimeout(() => {
      manualTimer = null
      const info = state.reconnecting
      if (info !== undefined) setState({ reconnecting: { ...info, manual: true } })
    }, MANUAL_RECONNECT_AFTER_MS)
    scheduleAttempt()
  }

  function scheduleAttempt(): void {
    const info = state.reconnecting
    if (info === undefined) return
    if (retryTimer !== null) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      attemptNow()
    }, reconnectDelayMs(info.attempt + 1))
  }

  function attemptNow(): void {
    const info = state.reconnecting
    if (info === undefined) return
    if (retryTimer !== null) clearTimeout(retryTimer)
    retryTimer = null
    setState({ reconnecting: { ...info, attempt: info.attempt + 1 } })
    open()
    const current = socket
    clearAttemptTimer()
    // O prazo vale até o `welcome`: socket que abre e ninguém responde também prende.
    attemptTimer = setTimeout(() => {
      attemptTimer = null
      if (socket !== current) return
      abandonAttempt()
      scheduleAttempt()
    }, RECONNECT_ATTEMPT_TIMEOUT_MS)
  }

  /** Larga a tentativa no ar sem que o `close` dela conte como queda nova. */
  function abandonAttempt(): void {
    clearAttemptTimer()
    stopPing()
    const current = socket
    socket = null
    current?.close()
  }

  function send(message: PlayerMessage): boolean {
    if (!socket || socket.readyState !== SOCKET_OPEN) return false
    socket.send(JSON.stringify(message))
    return true
  }

  function clearWakeProbe(): void {
    if (wakeProbeTimer !== null) clearTimeout(wakeProbeTimer)
    wakeProbeTimer = null
  }

  function stopPing(): void {
    if (pingTimer !== null) clearInterval(pingTimer)
    pingTimer = null
    clearWakeProbe()
  }

  /** O ping diz ao host se a aba está em segundo plano, para ele esperar mais. */
  function sendPing(): void {
    send(isHidden() ? { type: 'ping', away: true } : { type: 'ping' })
  }

  /**
   * O host sumiu sem fechar? Só conta depois de entrar na sala: antes do
   * `welcome` quem decide quanto esperar é a tela (o prazo do aperto de mão).
   */
  function hostSilent(): boolean {
    const since = Math.max(lastHeardAt, watchingSince)
    return socket !== null && state.playerId !== undefined && Date.now() - since >= SILENCE_DEAD_AFTER_MS
  }

  function pingOrGiveUp(): void {
    // Aba oculta: o timer pode estar rodando de minuto em minuto, e o silêncio
    // medido assim é do timer, não do host. Quem decide é o `wake`, à vista.
    if (!isHidden() && hostSilent()) {
      dropSocket()
      return
    }
    sendPing()
  }

  /** A tela acendeu com o host mudo: ping agora e, sem resposta em `WAKE_PROBE_MS`, volta já. */
  function probeAfterWake(): void {
    watchingSince = Date.now()
    sendPing()
    clearWakeProbe()
    const probed = socket
    wakeProbeTimer = setTimeout(() => {
      wakeProbeTimer = null
      if (socket !== probed || lastHeardAt >= watchingSince) return
      dropSocket()
      attemptNow()
    }, WAKE_PROBE_MS)
  }

  /** Depois de kicked/closed/error a queda é esperada: o mestre derrubou de propósito. */
  function sessionOver(): boolean {
    return state.status === 'kicked' || state.status === 'closed' || state.status === 'error'
  }

  /** O socket atual morreu (com ou sem `close`): volta sozinho, ou explica na tela. */
  function handleSocketLost(): void {
    if (sessionOver()) return
    if (state.reconnecting !== undefined) {
      // A tentativa falhou (a rede ainda não voltou): a próxima espera mais.
      clearAttemptTimer()
      scheduleAttempt()
      return
    }
    // Já estava na sala: Wi-Fi que pisca ou tela bloqueada. Volta sozinho.
    if (state.playerId !== undefined) {
      beginReconnect()
      return
    }
    // Nunca entrou (endereço errado, sala que não existe): a tela explica.
    setState({ status: 'error', error: CONNECTION_LOST })
  }

  /**
   * Larga o socket que o navegador ainda acha aberto (Wi-Fi que sumiu sem FIN,
   * host que já nos deu como caídos) e segue como se o `close` tivesse chegado.
   * O `close` real, se vier, acha outro socket no lugar e é ignorado.
   */
  function dropSocket(): void {
    const current = socket
    socket = null
    stopPing()
    current?.close()
    handleSocketLost()
  }

  function hasNewerPending(reqId: string, tokenId: string): PendingMove | null {
    let seen = false
    for (const [id, move] of pending) {
      if (id === reqId) seen = true
      else if (seen && move.tokenId === tokenId) return move
    }
    return null
  }

  function applySnapshot(
    rev: number,
    map: MapData,
    vision: RegionPoint[][],
    explored: Exploration | undefined,
    ownTokens: string[],
    concealed: RegionPoint[][],
  ): void {
    if (rev <= state.rev) return
    let next = map
    // Reaplica, em ordem, só os movimentos ainda não confirmados pelo mestre.
    for (const [reqId, move] of pending) {
      const token = next.tokens.find((t) => t.id === move.tokenId)
      if (!token) {
        pending.delete(reqId)
        continue
      }
      move.prevX = token.x
      move.prevY = token.y
      next = withTokenAt(next, move.tokenId, move.x, move.y)
    }
    setState({ status: 'playing', rev, map: next, vision, explored, ownTokens, concealed, error: undefined })
  }

  function handleRejected(reqId: string): void {
    const move = pending.get(reqId)
    if (!move) return
    const newer = hasNewerPending(reqId, move.tokenId)
    pending.delete(reqId)
    if (newer) {
      // Um movimento mais novo do mesmo token parte desta posição: herda o "anterior".
      newer.prevX = move.prevX
      newer.prevY = move.prevY
      return
    }
    if (state.map) setState({ map: withTokenAt(state.map, move.tokenId, move.prevX, move.prevY) })
  }

  function handleAccepted(reqId: string, x: number, y: number): void {
    const move = pending.get(reqId)
    if (!move) return
    const newer = hasNewerPending(reqId, move.tokenId)
    pending.delete(reqId)
    if (newer) {
      newer.prevX = x
      newer.prevY = y
      return
    }
    if (state.map) setState({ map: withTokenAt(state.map, move.tokenId, x, y) })
  }

  /**
   * Edita o próprio token: valida a posse aqui, envia e aplica LOCAL na hora.
   *
   * Otimista igual ao movimento (`requestMove`), e pelo mesmo motivo: a tela
   * precisa responder ao gesto sem esperar a volta do mestre. O snapshot
   * seguinte é a autoridade e sobrescreve — se o mestre recusar, a tela volta
   * sozinha no próximo `rev`.
   */
  function editOwnToken(tokenId: string, message: PlayerMessage, patch: Partial<Token>): boolean {
    const map = state.map
    if (state.status !== 'playing' || !map) return false
    if (!(state.ownTokens ?? []).includes(tokenId)) return false
    if (!map.tokens.some((t) => t.id === tokenId)) return false
    if (!send(message)) return false
    setState({ map: withTokenPatch(map, tokenId, patch) })
    return true
  }

  function handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }
    if (!isRecord(data)) return
    switch (data.type) {
      case 'welcome':
        if (typeof data.playerId !== 'string' || typeof data.resumeToken !== 'string') return
        writeResume(storage, { code, token: data.resumeToken })
        // O mestre aceitou (de novo): fim da volta automática, se havia uma.
        clearReconnectTimers()
        setState({ playerId: data.playerId, status: state.status === 'playing' ? 'playing' : 'waiting', reconnecting: undefined })
        return
      case 'lobby.waiting':
        clearSignalTimers()
        clearLaserTimer()
        clearDoorNotice()
        clearTravelTimer()
        clearCallTimer()
        setState({
          status: 'waiting',
          map: undefined,
          vision: undefined,
          explored: undefined,
          ownTokens: undefined,
          concealed: undefined,
          signals: undefined,
          laser: undefined,
          doorNotice: undefined,
          doorRequest: undefined,
          travel: undefined,
          call: undefined,
        })
        return
      case 'scene.changed':
        // O mestre deixou passar. Tudo o que era da cena de antes perde o
        // sentido: movimento ainda sem resposta (o `x`/`y` dele é do outro
        // mapa e seria reaplicado em cima do novo), sinais e laser. O mapa
        // novo vem no snapshot logo atrás.
        if (state.status !== 'playing') return
        pending.clear()
        clearSignalTimers()
        clearLaserTimer()
        clearDoorNotice()
        // A porta tocada ficou na cena de antes: o "Trancada" e os botões dele perdem o sentido.
        setState({ signals: undefined, laser: undefined, doorNotice: undefined, doorRequest: undefined })
        // Levado pelo mestre, "Você chegou" mentiria: ele não pediu para ir.
        // Reunido pelo mestre: outro aviso, porque ele não foi levado sozinho.
        showTravelAnswer({ id: nextNoticeId++, phase: data.by === 'gather' ? 'gathered' : data.by === 'master' ? 'moved' : 'arrived' })
        return
      case 'pin.travel.denied':
        if (state.status !== 'playing') return
        showTravelAnswer({ id: nextNoticeId++, phase: 'denied' })
        return
      case 'pin.travel.rejected': {
        if (state.status !== 'playing') return
        const { reason } = data
        if (reason !== 'unavailable' && reason !== 'pending' && reason !== 'too_soon') return
        showTravelAnswer({ id: nextNoticeId++, phase: 'rejected', reason })
        return
      }
      case 'scene.note': {
        // O host só manda a quem joga; fora do jogo não há tela de cartão.
        if (state.status !== 'playing') return
        const note = parseSceneNote(data)
        if (note === null) return
        setState({ note: note.onlyYou === true ? { id: note.id, text: note.text, onlyYou: true } : { id: note.id, text: note.text } })
        return
      }
      case 'scene.paused':
        // Aceito em qualquer estado, e o `lobby.waiting` não apaga: o host só
        // manda quando MUDA, então guardar o último é o que mantém os dois
        // lados de acordo (voltar à cena pausada não reenvia `true`).
        if (typeof data.paused !== 'boolean') return
        setState({ paused: data.paused ? true : undefined })
        return
      case 'party.update': {
        // Vale também na espera: é a lista que ele vê assim que ganhar ficha.
        const party = parsePartyUpdate(data)
        if (party === null) return
        setState({ party: party.members })
        return
      }
      case 'call.state':
        handleCallState(data)
        return
      case 'call.reply': {
        // A resposta do mestre ao chamado: o mesmo cartão do recado, e a mão apaga.
        if (state.status !== 'playing') return
        const reply = parseCallReply(data)
        if (reply === null) return
        clearCallTimer()
        setState({ note: { id: reply.id, text: reply.text }, call: undefined })
        return
      }
      case 'laser': {
        // Laser sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        const laser = parseLaserMessage(data)
        if (laser === null) return
        const now = Date.now()
        const points = state.laser?.points ?? []
        if ('off' in laser) {
          // Não apaga na hora: o rastro que já estava na tela termina de sumir.
          if (state.laser !== undefined) updateLaser({ points: pruneLaserTrail(points, now), on: false })
          return
        }
        updateLaser({ points: appendLaserPoints(points, laser.points, now, LASER_SEND_INTERVAL_MS), on: true })
        return
      }
      case 'signal': {
        // Sinal sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        const { x, y, from, color } = data
        if (!isFiniteNumber(x) || !isFiniteNumber(y)) return
        if (typeof from !== 'string' || from.length > NAME_MAX_LENGTH) return
        if (typeof color !== 'string' || !SIGNAL_COLOR_PATTERN.test(color)) return
        addSignal(x, y, from, color)
        return
      }
      case 'door.toggle.rejected': {
        // Aviso sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        const { reason } = data
        if (reason !== 'locked' && reason !== 'far' && reason !== 'not_visible') return
        if (typeof data.wallId !== 'string' || data.wallId.length === 0) return
        showDoorNotice(reason, data.wallId)
        return
      }
      case 'door.request.rejected': {
        if (state.status !== 'playing') return
        const { reason } = data
        const known = DOOR_REQUEST_REJECTIONS.find((r) => r === reason)
        if (known === undefined) return
        showDoorRequest(known)
        return
      }
      case 'door.request.answer': {
        if (state.status !== 'playing') return
        const { answer } = data
        if (answer !== 'opened' && answer !== 'denied') return
        showDoorRequest(answer)
        return
      }
      case 'snapshot':
      case 'delta': {
        if (!isFiniteNumber(data.rev) || !isMapShape(data.map) || !isVision(data.vision)) return
        // Campos aditivos: ausentes são tolerados (sem memória, sem "meus
        // personagens"); presentes e malformados descartam a mensagem inteira.
        let explored: Exploration | undefined
        if (data.explored !== undefined) {
          const decoded = decodeExploration(data.explored)
          if (decoded === null) return
          explored = decoded
        }
        if (data.ownTokens !== undefined && !isStringList(data.ownTokens)) return
        if (data.concealed !== undefined && !isVision(data.concealed)) return
        applySnapshot(data.rev, data.map, data.vision, explored, data.ownTokens ?? [], data.concealed ?? [])
        return
      }
      case 'token.move.accepted':
        if (typeof data.reqId !== 'string' || !isFiniteNumber(data.x) || !isFiniteNumber(data.y)) return
        handleAccepted(data.reqId, data.x, data.y)
        return
      case 'token.move.rejected':
        if (typeof data.reqId !== 'string') return
        handleRejected(data.reqId)
        return
      case 'kicked':
        writeResume(storage, null)
        clearReconnectTimers()
        setState({ status: 'kicked', reconnecting: undefined })
        return
      case 'room.closed':
        // Sala encerrada: o resume não serve para mais nada, e sinal/laser não têm onde aparecer.
        writeResume(storage, null)
        clearSignalTimers()
        clearLaserTimer()
        clearDoorNotice()
        clearTravelTimer()
        clearCallTimer()
        clearReconnectTimers()
        setState({ status: 'closed', doorNotice: undefined, doorRequest: undefined, travel: undefined, call: undefined, reconnecting: undefined })
        return
      case 'error': {
        const reason = typeof data.reason === 'string' ? data.reason : 'unknown'
        // O transporte pode avisar a expulsão como erro: mesmo efeito de `kicked`.
        if (reason === 'kicked') {
          writeResume(storage, null)
          clearReconnectTimers()
          setState({ status: 'kicked', reconnecting: undefined })
          return
        }
        // Mensagem inválida durante o jogo não derruba a sessão.
        if (reason === 'invalid_message' && state.status === 'playing') return
        // Já estava na sala e o host não a conhece mais: ele a deu como caída
        // (a varredura de conexão muda) e este socket é um zumbi. Volta pelo
        // resume, como numa queda — não é caso de tela de erro.
        if (reason === 'not_joined' && state.playerId !== undefined) {
          dropSocket()
          return
        }
        if (reason === 'bad_code') writeResume(storage, null)
        // Erro do mestre na volta (a sala acabou): não há para onde tentar de novo.
        clearReconnectTimers()
        setState({ status: 'error', error: reason, reconnecting: undefined })
        return
      }
      default:
        return
    }
  }

  function open(): void {
    pending.clear()
    const current = createSocket(url)
    socket = current
    current.onopen = () => {
      if (socket !== current) return
      const resume = readResume(storage, code)
      const join: JoinMessage = resume ? { type: 'join', code, name, resume } : { type: 'join', code, name }
      // O prazo do silêncio conta a partir de agora, não da conexão anterior.
      lastHeardAt = Date.now()
      send(join)
      stopPing()
      pingTimer = setInterval(pingOrGiveUp, PING_INTERVAL_MS)
    }
    current.onmessage = (event) => {
      if (socket !== current) return
      // Qualquer mensagem do host é prova de vida, não só o pong.
      lastHeardAt = Date.now()
      clearWakeProbe()
      handleMessage(event.data)
    }
    current.onerror = () => {
      // O browser sempre dispara `close` depois; o tratamento fica lá.
    }
    current.onclose = () => {
      if (socket !== current) return
      socket = null
      stopPing()
      handleSocketLost()
    }
  }

  function detach(): void {
    clearReconnectTimers()
    stopPing()
    clearSignalTimers()
    clearLaserTimer()
    clearDoorNotice()
    clearTravelTimer()
    clearCallTimer()
    const current = socket
    socket = null
    current?.close()
  }

  open()

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    requestMove(tokenId, x, y) {
      const map = state.map
      const token = map?.tokens.find((t) => t.id === tokenId)
      if (!map || !token) return false
      const reqId = `m${nextReqId++}`
      if (!send({ type: 'token.move', reqId, tokenId, x, y })) return false
      pending.set(reqId, { tokenId, x, y, prevX: token.x, prevY: token.y })
      // Mexeu a ficha depois de mudar de lugar (chegou, foi levado ou
      // reunido): já viu onde está, o aviso sai.
      const phase = state.travel?.phase
      if (phase === 'gathered' || phase === 'arrived' || phase === 'moved') {
        clearTravelTimer()
        setState({ map: withTokenAt(map, tokenId, x, y), travel: undefined })
        return true
      }
      setState({ map: withTokenAt(map, tokenId, x, y) })
      return true
    },
    sendSignal(x, y) {
      if (state.status !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return false
      return send({ type: 'signal', x: Math.round(x), y: Math.round(y) })
    },
    toggleDoor(wallId) {
      if (state.status !== 'playing' || wallId.length === 0) return false
      return send({ type: 'door.toggle', wallId })
    },

    requestDoor(wallId, how) {
      if (state.status !== 'playing' || wallId.length === 0 || !isDoorRequestHow(how)) return false
      if (!send({ type: 'door.request', wallId, how })) return false
      showDoorRequest('sent')
      return true
    },

    dismissDoorNotice() {
      if (state.doorNotice === undefined) return
      clearDoorNotice()
      setState({ doorNotice: undefined })
    },

    requestTravel(pinId, exitId) {
      if (state.status !== 'playing' || pinId.length === 0 || state.travel?.phase === 'waiting') return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      const direct = pin !== undefined && passageOf(pin) === 'livre'
      // Sem saída escolhida, a mensagem sai idêntica à de antes: o mestre
      // antigo, que não conhece `exitId`, continua entendendo o pedido.
      const pedido: PinTravelRequestMessage = exitId === undefined ? { type: 'pin.travel.request', pinId } : { type: 'pin.travel.request', pinId, exitId }
      if (!direct) {
        if (!send(pedido)) return false
        clearTravelTimer()
        setState({ travel: { id: nextNoticeId++, phase: 'waiting', direct: false } })
        return true
      }
      // Pino livre não espera ninguém: o aviso diz "Passando…", não "Aguardando
      // o mestre". E o pedido sai depois de um instante, não no mesmo toque: a
      // resposta do host é quase imediata, e sem a pausa a tela trocava de cena
      // no mesmo quadro em que o cartão fechava — o jogador não via a passagem
      // acontecer, só um salto.
      if (socket === null || socket.readyState !== SOCKET_OPEN) return false
      clearTravelTimer()
      setState({ travel: { id: nextNoticeId++, phase: 'waiting', direct: true } })
      travelTimer = setTimeout(() => {
        travelTimer = null
        if (state.status !== 'playing') return
        // O socket caiu na pausa: sem pedido no ar, o aviso não pode ficar.
        if (!send(pedido)) setState({ travel: undefined })
      }, FREE_PASSAGE_BEAT_MS)
      return true
    },

    dismissNote() {
      if (state.note !== undefined) setState({ note: undefined })
    },

    raiseHand(reason, text) {
      // Mão já acesa: o toque repetido não vira outro chamado.
      if (state.status !== 'playing' || state.call?.phase === 'waiting') return false
      const limpo = text?.trim() ?? '' // sem texto = só o motivo
      if (limpo.length > CALL_TEXT_MAX_LENGTH) return false
      const message: CallRaiseMessage = limpo === '' ? { type: 'call.raise', reason } : { type: 'call.raise', reason, text: limpo }
      if (!send(message)) return false
      clearCallTimer()
      setState({ call: { id: nextNoticeId++, phase: 'waiting', reason } })
      return true
    },

    lowerHand() {
      if (state.call?.phase !== 'waiting') return false
      if (!send({ type: 'call.lower' })) return false
      setState({ call: undefined })
      return true
    },

    setOwnTokenName(tokenId, name) {
      const limpo = name.trim()
      if (limpo.length < NAME_MIN_LENGTH || limpo.length > NAME_MAX_LENGTH) return false
      return editOwnToken(tokenId, { type: 'token.edit', tokenId, name: limpo }, { name: limpo })
    },

    setOwnTokenPhoto(tokenId, image) {
      if (!isTokenPhotoData(image)) return false
      // `image: null` junto: o caminho do disco do mestre (quando havia um)
      // deixa de valer para este token — a foto agora é a que o jogador
      // escolheu, e é a embutida que viaja. Mesma forma que o host vai gravar.
      return editOwnToken(tokenId, { type: 'token.edit', tokenId, image }, { image: null, imageData: image })
    },
    reconnect() {
      detach()
      setState({ status: 'connecting', error: undefined, rev: -1, map: undefined, vision: undefined, explored: undefined, ownTokens: undefined, concealed: undefined, signals: undefined, laser: undefined, doorNotice: undefined, travel: undefined, note: undefined, paused: undefined, call: undefined, reconnecting: undefined })
      open()
    },
    wake() {
      if (state.reconnecting !== undefined) {
        // Tentativa no ar tem o prazo dela; duas de uma vez só brigariam pelo socket.
        if (socket === null) attemptNow()
        return
      }
      if (sessionOver() || socket === null) return
      // A tela ficou apagada e os timers nem rodaram (ou rodaram de minuto em
      // minuto): o socket pode estar morto sem saber, ou vivo. Mudo há mais que
      // o prazo = confirma com um ping curto, e sem resposta a volta tenta já —
      // a pessoa está olhando. Senão, um ping agora confirma mais cedo.
      if (hostSilent()) {
        probeAfterWake()
        return
      }
      sendPing()
    },
    retryNow() {
      if (state.reconnecting === undefined) return
      abandonAttempt()
      attemptNow()
    },
    close: detach,
  }
}
