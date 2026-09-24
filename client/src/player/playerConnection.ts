import type { HazardKind, MapData, RegionPoint, Token } from '../types/map'
import { HAZARD_NOTICE_TTL_MS, isHazardKind, parsePlayerHazards, type PlayerHazard } from '../lib/hazards'
import { parsePlayerAreaTriggers, type PlayerAreaTrigger } from '../lib/areaTriggers'
import { decodeExploration, type Exploration } from '../lib/exploration'
import {
  DOOR_REQUEST_REJECTIONS,
  ITEM_GIVE_REJECTIONS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PIN_LEVER_REJECTIONS,
  PIN_TAKE_REJECTIONS,
  REQ_ID_MAX_LENGTH,
  isDoorRequestHow,
  type DoorRequestAnswer,
  type DoorRequestHow,
  type DoorRequestRejection,
  type DoorToggleRejection,
  type ItemGiveRejection,
  type JoinMessage,
  type PinLeverRejection,
  type PinTakeRejection,
  type PinTravelRejection,
  type PinTravelRequestMessage,
  type PlayerMessage,
} from '../net/protocol'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import { passageOf } from '../lib/pins'
import { carriedItemsOf, cleanItemName, itemOfPin } from '../lib/items'
import { MAX_ACTIVE_SIGNALS, SIGNAL_COLOR_PATTERN, SIGNAL_TTL_MS, type SignalMark } from '../lib/signals'
import { LASER_SEND_INTERVAL_MS, LASER_TRAIL_MS, appendLaserPoints, pruneLaserTrail, type LaserTrail } from '../lib/laser'
import { parseLaserMessage, parseSceneAlarm, parseSceneAlarmEnd, parseSceneNote } from '../net/protocol'

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
  /** Ids dos tokens de COLEGAS (outros jogadores) no mapa recebido: o "Dar a…" só oferece estes. */
  partyTokens?: string[]
  /** Polígonos das zonas ocultas ativas: o jogador pinta preto por cima. */
  concealed?: RegionPoint[][]
  /** ZONA DE PERIGO: tipo e polígono de cada sala tomada que o jogador enxerga agora. */
  hazards?: PlayerHazard[]
  /** ZONA DE PERIGO: a ficha dele acabou de entrar num perigo. Some sozinho; `id` novo repete o aviso. */
  hazardNotice?: { id: number; kind: HazardKind }
  /** GATILHO DE ÁREA: tipo e polígono de cada armadilha/alarme que o mestre revelou. */
  gatilhos?: PlayerAreaTrigger[]
  /**
   * INICIATIVA: id da ficha da vez, sempre uma ficha de `map.tokens`. Ausente
   * = ninguém que este jogador enxerga está na vez (o mestre só manda o que
   * está no recorte dele).
   */
  turn?: string
  /** Sinais recebidos ainda vivos (somem sozinhos depois de `SIGNAL_TTL_MS`). */
  signals?: SignalMark[]
  /** Rastro do laser do mestre; some sozinho `LASER_TRAIL_MS` depois da última mensagem com o laser desligado. */
  laser?: LaserTrail
  /**
   * Recusa de movimento que o jogador precisa LER (a ficha já voltou sozinha):
   * hoje só 'occupied' ("Lugar ocupado"). Some sozinho; `id` novo repete o aviso.
   */
  moveNotice?: { id: number; reason: 'occupied' }
  /**
   * INICIATIVA: o mestre recusou o arrasto porque não é a vez desta ficha
   * ("Espere sua vez"); some sozinho. `id` novo repete o aviso. Não diz de quem
   * é a vez: isso só vem em `turn`, e só quando o jogador vê a ficha.
   */
  turnNotice?: { id: number }
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
  /** ITEM PEGÁVEL: "Pegar" ou "Dar a…" — enviado, a resposta do mestre ou a recusa do host. Some sozinho. */
  item?: ItemNotice
  /** ALAVANCA: a resposta ao "Puxar a alavanca". Some sozinha; `id` novo repete o aviso. */
  lever?: { id: number; phase: LeverPhase }
  /**
   * Recado do mestre para a cena do jogador. Fica até ele fechar
   * (`dismissNote`); um recado novo toma o lugar do aberto. É texto puro: a
   * tela o mostra como texto, nunca como HTML.
   */
  note?: { id: string; text: string }
  /**
   * ALARME do mestre para a cena do jogador (e outras junto). Diferente do
   * recado, o jogador NÃO fecha: some só com `scene.alarm.end` do mesmo id,
   * com a volta à espera ou ao reconectar (o host manda de novo se ainda valer).
   * Texto puro, como o recado.
   */
  alarm?: { id: string; text: string }
  rev: number
  playerId?: string
  /** Motivo quando `status === 'error'`: razão do mestre ou 'connection_lost'. */
  error?: string
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
 * Onde está o "Pegar" (ou o "Dar a…"). `sent` espera o mestre (`direct`: o
 * pino é livre, ninguém decide); `taken` leva o nome do que agora está com o
 * jogador. `id` novo repete o aviso.
 */
export type ItemNotice =
  | { id: number; phase: 'sent'; direct: boolean }
  | { id: number; phase: 'taken'; nome: string }
  | { id: number; phase: 'denied' }
  | { id: number; phase: 'rejected'; reason: PinTakeRejection }
  | { id: number; phase: 'give_rejected'; reason: ItemGiveRejection }

/** A resposta do host ao "Puxar a alavanca": puxou, ou por que nada se moveu. */
export type LeverPhase = 'pulled' | PinLeverRejection

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
   * `table` = TELA DA MESA (TV, projetor): entra com `role: 'table'`, sem
   * resume, e só olha — o cliente nunca manda nada além do `join` e do `ping`.
   * Ausente = jogador, como sempre.
   */
  role?: 'table'
  /** TELA DA MESA: a chave do link da TV (`?chave=`), que vai no `join` junto com o código. */
  tableKey?: string
}

/** O `join` da tela da mesa: sem chave, a mensagem vai sem o campo e a sala responde `bad_table_key`. */
function tableJoin(code: string, name: string, tableKey: string | undefined): JoinMessage {
  return tableKey === undefined || tableKey.length === 0 ? { type: 'join', code, name, role: 'table' } : { type: 'join', code, name, role: 'table', tableKey }
}

/** Nome que a tela da mesa manda no `join`: o servidor do app exige um nome, e o mestre nunca o lista. */
export const TABLE_SCREEN_NAME = 'Tela da mesa'

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
  /**
   * "Pegar" o item do pino `pinId`. `false` se não está jogando, o pino não
   * está no mapa dele ou não é pegável, ou o socket não está aberto.
   */
  takePin(pinId: string): boolean
  /**
   * "Dar a…": o item `itemId` da mochila de uma ficha dele vai à ficha
   * `toTokenId`. `false` se o item não está com ele ou o socket não está aberto.
   */
  giveItem(itemId: string, toTokenId: string): boolean
  /**
   * ALAVANCA: puxa a alavanca `pinId`. `false` se não está jogando, o pino não
   * está no mapa dele ou não é alavanca, ou o socket não está aberto.
   */
  pullLever(pinId: string): boolean
  /** Fecha o recado aberto (botão "Fechar" ou Escape do cartão). */
  dismissNote(): void
  /** Abre um socket novo (reconectar), reaproveitando o resumeToken guardado. */
  reconnect(): void
  close(): void
}

export const RESUME_STORAGE_KEY = 'labirinto.resume'
export const PING_INTERVAL_MS = 15_000
/** Quanto tempo o aviso da porta ("Chegue mais perto") fica na tela. O "Trancada" fica até o jogador escolher. */
export const DOOR_NOTICE_TTL_MS = 2500
/** Quanto tempo "Lugar ocupado" fica na tela: é a mesma escala de recado curto da porta. */
export const MOVE_NOTICE_TTL_MS = DOOR_NOTICE_TTL_MS
/** Quanto tempo o aviso do pedido da porta ("Pedido enviado", "O mestre abriu") fica na tela. */
export const DOOR_REQUEST_NOTICE_TTL_MS = 4000
/** Quanto tempo o aviso do item ("está com você", "O mestre disse não") fica na tela. */
export const ITEM_NOTICE_TTL_MS = 4000
/** Quanto tempo o aviso da alavanca ("Você puxou a alavanca") fica na tela: recado curto, como o da porta. */
export const LEVER_NOTICE_TTL_MS = DOOR_NOTICE_TTL_MS
/** Quanto tempo a recusa do mestre ("não deixou passar agora") fica na tela. Mais que a porta. */
export const TRAVEL_NOTICE_TTL_MS = 4000
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
const SOCKET_OPEN = 1
const CONNECTION_LOST = 'connection_lost'

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

/** Id de ficha como o protocolo aceita (mesmo teto de `tokenId` em `net/protocol.ts`). */
function isBoundedId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= REQ_ID_MAX_LENGTH
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
  const { url, code, name, createSocket } = options
  const isTable = options.role === 'table'
  // A tela da mesa não tem sessão de jogador para retomar: sem storage, ela
  // nunca lê o resume de quem jogava nesta aba nem grava um por cima dele.
  const storage = isTable ? null : options.storage
  const listeners = new Set<() => void>()
  const pending = new Map<string, PendingMove>()
  let state: PlayerState = { status: 'connecting', rev: -1 }
  let socket: SocketLike | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
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

  let moveNoticeTimer: ReturnType<typeof setTimeout> | null = null

  function clearMoveNotice(): void {
    if (moveNoticeTimer !== null) clearTimeout(moveNoticeTimer)
    moveNoticeTimer = null
  }

  function showMoveNotice(reason: 'occupied'): void {
    clearMoveNotice()
    setState({ moveNotice: { id: nextNoticeId++, reason } })
    moveNoticeTimer = setTimeout(() => {
      moveNoticeTimer = null
      setState({ moveNotice: undefined })
    }, MOVE_NOTICE_TTL_MS)
  }

  let hazardNoticeTimer: ReturnType<typeof setTimeout> | null = null

  function clearHazardNotice(): void {
    if (hazardNoticeTimer !== null) clearTimeout(hazardNoticeTimer)
    hazardNoticeTimer = null
  }

  /** ZONA DE PERIGO: "Você entrou no fogo!" — some sozinho; outro perigo toma o lugar. */
  function showHazardNotice(kind: HazardKind): void {
    clearHazardNotice()
    setState({ hazardNotice: { id: nextNoticeId++, kind } })
    hazardNoticeTimer = setTimeout(() => {
      hazardNoticeTimer = null
      setState({ hazardNotice: undefined })
    }, HAZARD_NOTICE_TTL_MS)
  }

  let turnNoticeTimer: ReturnType<typeof setTimeout> | null = null

  function clearTurnNotice(): void {
    if (turnNoticeTimer !== null) clearTimeout(turnNoticeTimer)
    turnNoticeTimer = null
  }

  /** "Espere sua vez": mesmo tempo de tela do aviso da porta. */
  function showTurnNotice(): void {
    clearTurnNotice()
    setState({ turnNotice: { id: nextNoticeId++ } })
    turnNoticeTimer = setTimeout(() => {
      turnNoticeTimer = null
      setState({ turnNotice: undefined })
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

  let itemTimer: ReturnType<typeof setTimeout> | null = null

  function clearItemTimer(): void {
    if (itemTimer !== null) clearTimeout(itemTimer)
    itemTimer = null
  }

  /** Aviso do item. "Enviado" espera a resposta; o resto some sozinho. */
  function showItemNotice(notice: ItemNotice): void {
    clearItemTimer()
    setState({ item: notice })
    if (notice.phase === 'sent') return
    itemTimer = setTimeout(() => {
      itemTimer = null
      setState({ item: undefined })
    }, ITEM_NOTICE_TTL_MS)
  }

  let leverTimer: ReturnType<typeof setTimeout> | null = null

  function clearLeverTimer(): void {
    if (leverTimer !== null) clearTimeout(leverTimer)
    leverTimer = null
  }

  /** Aviso da alavanca: aparece e some sozinho. */
  function showLeverNotice(phase: LeverPhase): void {
    clearLeverTimer()
    setState({ lever: { id: nextNoticeId++, phase } })
    leverTimer = setTimeout(() => {
      leverTimer = null
      setState({ lever: undefined })
    }, LEVER_NOTICE_TTL_MS)
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

  function send(message: PlayerMessage): boolean {
    // Tela da mesa só olha: nenhum pedido sai dela, nem se o mestre errar e der uma ficha a ela.
    if (isTable && message.type !== 'join' && message.type !== 'ping') return false
    if (!socket || socket.readyState !== SOCKET_OPEN) return false
    socket.send(JSON.stringify(message))
    return true
  }

  function stopPing(): void {
    if (pingTimer !== null) clearInterval(pingTimer)
    pingTimer = null
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
    turn: string | undefined,
    partyTokens: string[],
    hazards: PlayerHazard[],
    gatilhos: PlayerAreaTrigger[],
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
    // Vez de ficha que não veio no mapa não tem o que destacar: vale como ninguém.
    const turnOnMap = turn !== undefined && next.tokens.some((t) => t.id === turn) ? turn : undefined
    setState({ status: 'playing', rev, map: next, vision, explored, ownTokens, partyTokens, concealed, hazards, gatilhos, turn: turnOnMap, error: undefined })
  }

  /** Desfaz o movimento recusado. `false` = pedido desconhecido (já resolvido, ou de antes de trocar de cena). */
  function handleRejected(reqId: string): boolean {
    const move = pending.get(reqId)
    if (!move) return false
    const newer = hasNewerPending(reqId, move.tokenId)
    pending.delete(reqId)
    if (newer) {
      // Um movimento mais novo do mesmo token parte desta posição: herda o "anterior".
      newer.prevX = move.prevX
      newer.prevY = move.prevY
      return true
    }
    if (state.map) setState({ map: withTokenAt(state.map, move.tokenId, move.prevX, move.prevY) })
    return true
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
        // Só mestre antigo (que não conhece a tela da mesa) manda `welcome` a
        // ela: a tela não vira jogador por isso, e a espera vem logo atrás.
        if (isTable) return
        if (typeof data.playerId !== 'string' || typeof data.resumeToken !== 'string') return
        writeResume(storage, { code, token: data.resumeToken })
        setState({ playerId: data.playerId, status: state.status === 'playing' ? 'playing' : 'waiting' })
        return
      case 'lobby.waiting':
        clearSignalTimers()
        clearLaserTimer()
        clearDoorNotice()
        clearMoveNotice()
        clearTurnNotice()
        clearTravelTimer()
        clearItemTimer()
        clearLeverTimer()
        clearHazardNotice()
        setState({
          item: undefined,
          lever: undefined,
          // Sem cena, nenhum alarme de cena vale; o host manda de novo se ele voltar a uma.
          alarm: undefined,
          status: 'waiting',
          map: undefined,
          vision: undefined,
          explored: undefined,
          ownTokens: undefined,
          partyTokens: undefined,
          concealed: undefined,
          hazards: undefined,
          hazardNotice: undefined,
          gatilhos: undefined,
          turn: undefined,
          signals: undefined,
          laser: undefined,
          doorNotice: undefined,
          doorRequest: undefined,
          moveNotice: undefined,
          turnNotice: undefined,
          travel: undefined,
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
        clearMoveNotice()
        clearTurnNotice()
        clearHazardNotice()
        // A porta tocada ficou na cena de antes: o "Trancada" e os botões dele perdem o sentido.
        setState({ signals: undefined, laser: undefined, doorNotice: undefined, doorRequest: undefined, moveNotice: undefined, turnNotice: undefined, hazardNotice: undefined })
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
        setState({ note: { id: note.id, text: note.text } })
        return
      }
      case 'scene.alarm': {
        // Mesma regra do recado: fora do jogo não há tela onde o alarme fique.
        if (state.status !== 'playing') return
        const alarm = parseSceneAlarm(data)
        if (alarm === null) return
        setState({ alarm: { id: alarm.id, text: alarm.text } })
        return
      }
      case 'scene.alarm.end': {
        const end = parseSceneAlarmEnd(data)
        // Fim de OUTRO alarme (atrasado, já substituído): o aberto fica.
        if (end === null || state.alarm?.id !== end.id) return
        setState({ alarm: undefined })
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
      case 'pin.take.answer': {
        if (state.status !== 'playing') return
        if (data.answer === 'denied') {
          showItemNotice({ id: nextNoticeId++, phase: 'denied' })
          return
        }
        // O nome vai para a tela: só texto, aparado e no teto.
        if (data.answer !== 'taken' || typeof data.nome !== 'string') return
        const nome = cleanItemName(data.nome)
        if (nome === '') return
        showItemNotice({ id: nextNoticeId++, phase: 'taken', nome })
        return
      }
      case 'pin.take.rejected': {
        if (state.status !== 'playing') return
        const reason = PIN_TAKE_REJECTIONS.find((r) => r === data.reason)
        if (reason === undefined) return
        showItemNotice({ id: nextNoticeId++, phase: 'rejected', reason })
        return
      }
      case 'item.give.rejected': {
        if (state.status !== 'playing') return
        const reason = ITEM_GIVE_REJECTIONS.find((r) => r === data.reason)
        if (reason === undefined) return
        showItemNotice({ id: nextNoticeId++, phase: 'give_rejected', reason })
        return
      }
      case 'pin.lever.answer': {
        if (state.status !== 'playing' || data.answer !== 'pulled') return
        showLeverNotice('pulled')
        return
      }
      case 'pin.lever.rejected': {
        if (state.status !== 'playing') return
        const reason = PIN_LEVER_REJECTIONS.find((r) => r === data.reason)
        if (reason === undefined) return
        showLeverNotice(reason)
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
        if (data.turn !== undefined && !isBoundedId(data.turn)) return
        if (data.partyTokens !== undefined && !isStringList(data.partyTokens)) return
        // ZONA DE PERIGO: ausente = nenhum perigo à vista; malformado derruba a mensagem.
        const hazards = data.hazards === undefined ? [] : parsePlayerHazards(data.hazards)
        if (hazards === null) return
        // GATILHO DE ÁREA: ausente = nada revelado; malformado derruba a mensagem.
        const gatilhos = data.gatilhos === undefined ? [] : parsePlayerAreaTriggers(data.gatilhos)
        if (gatilhos === null) return
        applySnapshot(data.rev, data.map, data.vision, explored, data.ownTokens ?? [], data.concealed ?? [], data.turn, data.partyTokens ?? [], hazards, gatilhos)
        return
      }
      case 'hazard.entered': {
        // Aviso sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        if (!isHazardKind(data.kind)) return
        showHazardNotice(data.kind)
        return
      }
      case 'token.move.accepted':
        if (typeof data.reqId !== 'string' || !isFiniteNumber(data.x) || !isFiniteNumber(data.y)) return
        handleAccepted(data.reqId, data.x, data.y)
        return
      case 'token.move.rejected':
        if (typeof data.reqId !== 'string') return
        // A ficha já voltou; 'occupied' e 'not_your_turn' são as recusas que o
        // jogador precisa LER (não são parede visível na tela). Motivo
        // desconhecido ou ausente ainda desfaz o movimento; só não vira aviso.
        const undone = handleRejected(data.reqId)
        if (data.reason === 'occupied' && state.status === 'playing') showMoveNotice('occupied')
        if (undone && data.reason === 'not_your_turn') showTurnNotice()
        return
      case 'kicked':
        writeResume(storage, null)
        setState({ status: 'kicked' })
        return
      case 'room.closed':
        // Sala encerrada: o resume não serve para mais nada, e sinal/laser não têm onde aparecer.
        writeResume(storage, null)
        clearSignalTimers()
        clearLaserTimer()
        clearDoorNotice()
        clearMoveNotice()
        clearTurnNotice()
        clearTravelTimer()
        clearItemTimer()
        clearLeverTimer()
        clearHazardNotice()
        setState({ status: 'closed', doorNotice: undefined, doorRequest: undefined, moveNotice: undefined, turnNotice: undefined, travel: undefined, item: undefined, lever: undefined, hazardNotice: undefined })
        return
      case 'error': {
        const reason = typeof data.reason === 'string' ? data.reason : 'unknown'
        // O transporte pode avisar a expulsão como erro: mesmo efeito de `kicked`.
        if (reason === 'kicked') {
          writeResume(storage, null)
          setState({ status: 'kicked' })
          return
        }
        // Mensagem inválida durante o jogo não derruba a sessão.
        if (reason === 'invalid_message' && state.status === 'playing') return
        if (reason === 'bad_code') writeResume(storage, null)
        setState({ status: 'error', error: reason })
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
      const join: JoinMessage = isTable ? tableJoin(code, name, options.tableKey) : resume ? { type: 'join', code, name, resume } : { type: 'join', code, name }
      send(join)
      stopPing()
      pingTimer = setInterval(() => send({ type: 'ping' }), PING_INTERVAL_MS)
    }
    current.onmessage = (event) => {
      if (socket === current) handleMessage(event.data)
    }
    current.onerror = () => {
      // O browser sempre dispara `close` depois; o tratamento fica lá.
    }
    current.onclose = () => {
      if (socket !== current) return
      socket = null
      stopPing()
      // Depois de kicked/closed a queda é esperada: o mestre derrubou de propósito.
      if (state.status === 'kicked' || state.status === 'closed' || state.status === 'error') return
      setState({ status: 'error', error: CONNECTION_LOST })
    }
  }

  function detach(): void {
    stopPing()
    clearSignalTimers()
    clearLaserTimer()
    clearDoorNotice()
    clearMoveNotice()
    clearTurnNotice()
    clearTravelTimer()
    clearItemTimer()
    clearLeverTimer()
    clearHazardNotice()
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
      // O pino livre agenda o envio (e o aviso "Passando…") antes de chamar `send`: a tela da mesa sai aqui.
      if (isTable || state.status !== 'playing' || pinId.length === 0 || state.travel?.phase === 'waiting') return false
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

    takePin(pinId) {
      if (state.status !== 'playing' || pinId.length === 0) return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      const item = pin === undefined ? null : itemOfPin(pin)
      if (item === null) return false
      if (!send({ type: 'pin.take', pinId })) return false
      showItemNotice({ id: nextNoticeId++, phase: 'sent', direct: item.livre === true })
      return true
    },

    giveItem(itemId, toTokenId) {
      if (state.status !== 'playing' || toTokenId.length === 0) return false
      const own = state.ownTokens ?? []
      const carrying = (state.map?.tokens ?? []).some((t) => own.includes(t.id) && carriedItemsOf(t).some((item) => item.id === itemId))
      if (!carrying) return false
      return send({ type: 'item.give', itemId, toTokenId })
    },

    pullLever(pinId) {
      if (state.status !== 'playing' || pinId.length === 0) return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      if (pin?.kind !== 'alavanca') return false
      return send({ type: 'pin.lever', pinId })
    },

    dismissNote() {
      if (state.note !== undefined) setState({ note: undefined })
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
      setState({ status: 'connecting', error: undefined, rev: -1, map: undefined, vision: undefined, explored: undefined, ownTokens: undefined, partyTokens: undefined, concealed: undefined, hazards: undefined, hazardNotice: undefined, gatilhos: undefined, turn: undefined, signals: undefined, laser: undefined, doorNotice: undefined, doorRequest: undefined, moveNotice: undefined, turnNotice: undefined, travel: undefined, note: undefined, alarm: undefined, item: undefined, lever: undefined })
      open()
    },
    close: detach,
  }
}
