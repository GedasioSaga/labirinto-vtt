import type { MapData, RegionPoint, Token } from '../types/map'
import { moveTokenCarryingLights } from '../lib/lightAttachment'
import { decodeExploration, type Exploration } from '../lib/exploration'
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, PLAYER_MESSAGE_MAX_BYTES, type DoorToggleRejection, type JoinMessage, type PinTravelRejection, type PinTravelRequestMessage, type PlayerMessage } from '../net/protocol'
import { fitsTokenPhotoSend } from '../lib/tokenPhoto'
import { isPlayerSafePinImage, passageOf } from '../lib/pins'
import { MAX_ACTIVE_SIGNALS, SIGNAL_COLOR_PATTERN, SIGNAL_TTL_MS, type SignalMark } from '../lib/signals'
import {
  LASER_MAX_POINTS_PER_MESSAGE,
  LASER_SEND_INTERVAL_MS,
  LASER_TRAIL_MS,
  appendLaserPoints,
  applyRemoteLaser,
  pruneLaserTrail,
  pruneRemoteLasers,
  type LaserTrail,
  type RemoteLaser,
  type RemoteLaserUpdate,
} from '../lib/laser'
import { NOTEBOOK_MAX_NOTES, parseClueMessage, parseLaserMessage, parseMapShareMessage, parseNotebook, parseRoomText, parseSceneNote, type ClueEntry, type NoteEntry } from '../net/protocol'
import { CLUEBOOK_MAX_CLUES } from '../lib/clues'
import type { TokenMoveRejection } from '../lib/moveValidation'
import { hasEnterText } from '../lib/roomText'

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
  /** Lasers dos OUTROS jogadores da mesma cena, um por jogador, na cor da ficha dele. */
  playerLasers?: RemoteLaser[]
  /** Recusa do mestre ao pedido de porta (trancada, longe, não visível); some sozinho. `id` novo repete o aviso. */
  doorNotice?: { id: number; reason: DoorToggleRejection }
  /** Recusa do mestre ao movimento (parede, fora do chão, ficha alheia); some sozinha. Mesmo contador de `id` da porta. */
  moveNotice?: { id: number; reason: TokenMoveRejection }
  /** Pedido de passagem: esperando o mestre, ou a resposta dele. */
  travel?: TravelNotice
  /**
   * Recado do mestre para a cena do jogador. Fica até ele fechar
   * (`dismissNote`); um recado novo toma o lugar do aberto. É texto puro: a
   * tela o mostra como texto, nunca como HTML.
   */
  note?: { id: string; text: string }
  /**
   * TEXTO DA SALA aberto: chega na primeira entrada (`room.text`) ou quando o
   * jogador toca o rótulo (`openRoomText`). `id` é o da Sala; `title`, o nome
   * que ele pode ver ('' quando oculto). Texto puro, como o recado.
   */
  roomText?: { id: string; title: string; text: string }
  /**
   * CADERNO: todo recado que chegou, do mais antigo ao mais novo (até
   * `NOTEBOOK_MAX_NOTES`). Fechar o cartão não tira daqui; o `notes.book` do
   * host, na entrada ou na volta, substitui a lista inteira.
   */
  notebook?: NoteEntry[]
  /** Ids de recados que chegaram e o jogador ainda não viu (nem no cartão fechado, nem no Caderno). */
  unreadNotes?: string[]
  /**
   * MINHAS PISTAS: os cartões lidos e os que colegas mostraram, da mais antiga
   * à mais nova (até `CLUEBOOK_MAX_CLUES`). Só entra o que o HOST confirmou
   * (`clue.added`, `clue.shown`); o `clues.book` da entrada substitui tudo.
   */
  clues?: ClueEntry[]
  /** Pista que um colega acabou de mostrar: o cartão "Gabi mostrou: Bilhete". `id` novo reabre. */
  shownClue?: { id: number; from: string; clue: ClueEntry }
  /** "Mostrar para…": esperando a lista, ou os colegas da mesma cena. */
  cluePeers?: CluePeers
  /** "Mostrar para…": o último envio e a resposta do host. */
  clueShow?: ClueShow
  /** "Mostrar meu mapa a…": esperando a lista, ou os colegas da mesma cena. */
  mapPeers?: CluePeers
  /** "Mostrar meu mapa a…": o último envio e a resposta do host. */
  mapShare?: MapShare
  /** Um colega (ou o mestre por ele) acabou de passar o mapa. `id` novo repete o aviso. */
  mapShared?: { id: number; from: string }
  rev: number
  playerId?: string
  /** Motivo quando `status === 'error'`: razão do mestre ou 'connection_lost'. */
  error?: string
}

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

export type CluePeers = { phase: 'loading' } | { phase: 'ready'; names: string[] }

export interface ClueShow {
  to: string
  /** `too_soon`: o mestre pediu um instante entre duas pistas mostradas; o colega segue na cena. */
  phase: 'sending' | 'ok' | 'failed' | 'too_soon'
}

/** "Mostrar meu mapa a…": as mesmas fases do "Mostrar para…" da pista. */
export type MapShare = ClueShow

/** Quanto tempo o aviso "Ana mostrou o próprio mapa a você" fica na tela. */
export const MAP_SHARED_NOTICE_TTL_MS = 5000

/** Põe a pista no fim do caderno; a mesma (mesmo id) sai de onde estava. Passou do teto, sai a mais antiga. */
function withClue(book: readonly ClueEntry[], clue: ClueEntry): ClueEntry[] {
  return [...book.filter((entry) => entry.id !== clue.id), clue].slice(-CLUEBOOK_MAX_CLUES)
}

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
   * Nome novo do PRÓPRIO token: aplica na hora e envia. `false` quando o token
   * não é dele, não está no mapa, o nome não cabe ou o socket não está aberto.
   */
  setOwnTokenName(tokenId: string, name: string): boolean
  /**
   * Foto nova do PRÓPRIO token (referência auto-contida). Mesmas recusas de
   * `setOwnTokenName`, mais a forma da foto e o tamanho acima do teto de envio
   * (`TOKEN_PHOTO_SEND_MAX_CHARS`) — foto que derrubaria o jogador nem sai.
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
   * Ponteiro do LASER do jogador em px de mundo. Sai em lotes: o primeiro
   * ponto na hora, os seguintes juntos a cada `LASER_SEND_INTERVAL_MS`.
   * `false` se não está jogando ou o socket não está aberto.
   */
  laserMove(x: number, y: number): boolean
  /** Soltou o laser: manda o que faltava e o `off`, só se algo saiu desde o último. */
  laserOff(): void
  /** Fecha o recado aberto (botão "Fechar" ou Escape do cartão). Quem fechou leu: aquele recado deixa de ser novo. */
  dismissNote(): void
  /** O jogador abriu o Caderno: nenhum recado é novo mais. */
  markNotebookRead(): void
  /**
   * Reabre o texto da Sala `regionId` (toque no rótulo). Só abre texto que já
   * chegou no mapa do jogador; `false` quando a Sala não tem texto para ele.
   */
  openRoomText(regionId: string): boolean
  /** Fecha o texto da Sala aberto. */
  dismissRoomText(): void
  /**
   * MINHAS PISTAS: o jogador abriu o cartão do pino `pinId` — pede ao host
   * para guardar. `false` (e nada sai) quando não joga, o pino não está no
   * mapa dele ou o cartão não tem texto nem foto.
   */
  readClue(pinId: string): boolean
  /** "Mostrar para…": pede ao host quem está na mesma cena. */
  askCluePeers(): boolean
  /** Mostra a pista `clueId` (do caderno dele) ao colega `to`. `false` se a pista não é dele ou o socket caiu. */
  showClue(clueId: string, to: string): boolean
  /** O cartão da pista fechou: a lista de colegas e o resultado do envio perdem o sentido. */
  resetClueShare(): void
  /** "Mostrar meu mapa a…": pede ao host quem está na mesma cena (a mesma pergunta das pistas). */
  askMapPeers(): boolean
  /** Mostra o que o jogador explorou nesta cena ao colega `to`. `false` se não joga ou o socket caiu. */
  shareMap(to: string): boolean
  /** Fechou o "Mostrar meu mapa a…": a lista e o resultado perdem o sentido. */
  resetMapShare(): void
  /** Fecha o cartão da pista que um colega mostrou (a pista continua no caderno). */
  dismissShownClue(): void
  /** Abre um socket novo (reconectar), reaproveitando o resumeToken guardado. */
  reconnect(): void
  close(): void
}

export const RESUME_STORAGE_KEY = 'labirinto.resume'
export const PING_INTERVAL_MS = 15_000
/** Quanto tempo o aviso da porta ("Trancada") fica na tela. */
export const DOOR_NOTICE_TTL_MS = 2500
/** Quanto tempo a recusa do movimento ("Parede no caminho") fica na tela: 2-3 s, como a da porta. */
export const MOVE_NOTICE_TTL_MS = 2500
const MOVE_REJECTIONS: readonly TokenMoveRejection[] = ['unknown_token', 'not_owner', 'locked', 'outside_map', 'wall', 'outside_floor']

function isMoveRejection(value: unknown): value is TokenMoveRejection {
  return MOVE_REJECTIONS.some((reason) => reason === value)
}
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
/** Mede o tamanho em bytes do que vai pelo socket (o servidor conta bytes, não caracteres). */
const utf8 = new TextEncoder()
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

/**
 * Há recado que o jogador não viu? O que está no cartão aberto não conta: ele
 * está lendo. É o que acende o ponto no Painel e na aba Caderno.
 */
export function hasUnreadNotes(state: PlayerState): boolean {
  return (state.unreadNotes ?? []).some((id) => id !== state.note?.id)
}

/** Mesma regra do mestre: a tocha presa na ficha anda junto (`lib/lightAttachment.ts`). */
function withTokenAt(map: MapData, tokenId: string, x: number, y: number): MapData {
  return moveTokenCarryingLights(map, tokenId, x, y)
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
  let mapSharedTimer: ReturnType<typeof setTimeout> | null = null

  function clearMapSharedTimer(): void {
    if (mapSharedTimer !== null) clearTimeout(mapSharedTimer)
    mapSharedTimer = null
  }

  /** "Ana mostrou o próprio mapa a você": fica alguns segundos e sai sozinho. */
  function showMapShared(from: string): void {
    clearMapSharedTimer()
    setState({ mapShared: { id: nextNoticeId++, from } })
    mapSharedTimer = setTimeout(() => {
      mapSharedTimer = null
      setState({ mapShared: undefined })
    }, MAP_SHARED_NOTICE_TTL_MS)
  }

  /** PASSAR O MAPA: o aviso de quem recebe e a resposta do host a quem mostrou. */
  function handleMapShareMessage(data: unknown): void {
    const msg = parseMapShareMessage(data)
    // Sem mapa na tela, não há onde ler o aviso nem a resposta.
    if (msg === null || state.status !== 'playing') return
    if (msg.type === 'map.shared') {
      showMapShared(msg.from)
      return
    }
    if (state.mapShare?.phase !== 'sending' || state.mapShare.to !== msg.to) return
    setState({ mapShare: { to: msg.to, phase: msg.ok ? 'ok' : msg.reason === 'too_soon' ? 'too_soon' : 'failed' } })
  }

  function clearDoorNotice(): void {
    if (doorNoticeTimer !== null) clearTimeout(doorNoticeTimer)
    doorNoticeTimer = null
  }

  function showDoorNotice(reason: DoorToggleRejection): void {
    clearDoorNotice()
    setState({ doorNotice: { id: nextNoticeId++, reason } })
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

  function showMoveNotice(reason: TokenMoveRejection): void {
    clearMoveNotice()
    setState({ moveNotice: { id: nextNoticeId++, reason } })
    moveNoticeTimer = setTimeout(() => {
      moveNoticeTimer = null
      setState({ moveNotice: undefined })
    }, MOVE_NOTICE_TTL_MS)
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

  let playerLasersTimer: ReturnType<typeof setTimeout> | null = null

  function clearPlayerLasers(): void {
    if (playerLasersTimer !== null) clearTimeout(playerLasersTimer)
    playerLasersTimer = null
  }

  /**
   * Lasers dos outros jogadores: guarda e agenda a faxina. A cada
   * `LASER_TRAIL_MS` tira quem já sumiu (soltou, ou calou por
   * `REMOTE_LASER_IDLE_MS`), até não sobrar ninguém.
   */
  function updatePlayerLasers(next: RemoteLaser[]): void {
    setState({ playerLasers: next.length === 0 ? undefined : next })
    if (playerLasersTimer !== null || next.length === 0) return
    const sweep = () => {
      playerLasersTimer = null
      const current = state.playerLasers
      if (current === undefined) return
      const kept = pruneRemoteLasers(current, Date.now())
      if (kept.length !== current.length) setState({ playerLasers: kept.length === 0 ? undefined : kept })
      if (kept.length > 0) playerLasersTimer = setTimeout(sweep, LASER_TRAIL_MS)
    }
    playerLasersTimer = setTimeout(sweep, LASER_TRAIL_MS)
  }

  /** Pontos do PRÓPRIO laser à espera da janela de envio (mesmo throttle do laser do mestre, `hostBridge`). */
  let ownLaserBuffer: RegionPoint[] = []
  let ownLaserTimer: ReturnType<typeof setTimeout> | null = null
  /** Saiu algum ponto desde o último `off`: sem isso cada toque solto viraria um `off` à toa. */
  let ownLaserSent = false

  function armOwnLaserTimer(): void {
    ownLaserTimer = setTimeout(() => {
      ownLaserTimer = null
      if (ownLaserBuffer.length === 0) return
      const points = ownLaserBuffer
      ownLaserBuffer = []
      send({ type: 'laser', points })
      armOwnLaserTimer()
    }, LASER_SEND_INTERVAL_MS)
  }

  function resetOwnLaser(): void {
    if (ownLaserTimer !== null) clearTimeout(ownLaserTimer)
    ownLaserTimer = null
    ownLaserBuffer = []
    ownLaserSent = false
  }

  function setState(patch: Partial<PlayerState>): void {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  function send(message: PlayerMessage): boolean {
    if (!socket || socket.readyState !== SOCKET_OPEN) return false
    const texto = JSON.stringify(message)
    // O servidor fecha o socket de quem manda acima do teto: melhor a mensagem
    // não sair (quem chamou recebe `false`) do que o jogador cair da mesa.
    // `length * 3` é teto de bytes em UTF-8; só as grandes pagam o encode.
    if (texto.length * 3 > PLAYER_MESSAGE_MAX_BYTES && utf8.encode(texto).length > PLAYER_MESSAGE_MAX_BYTES) return false
    socket.send(texto)
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

  function handleRejected(reqId: string, reason: unknown): void {
    const move = pending.get(reqId)
    if (!move) return
    const newer = hasNewerPending(reqId, move.tokenId)
    pending.delete(reqId)
    // Motivo que esta versão não conhece: desfaz igual, só não inventa frase.
    if (isMoveRejection(reason)) showMoveNotice(reason)
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

  /**
   * MINHAS PISTAS. O caderno vale também aguardando (é do jogador, não da
   * cena); cartão de colega, lista e resultado só com o mapa na tela.
   */
  function handleClueMessage(data: unknown): void {
    const msg = parseClueMessage(data)
    if (msg === null) return
    switch (msg.type) {
      case 'clues.book':
        setState({ clues: msg.clues })
        return
      case 'clue.added':
        setState({ clues: withClue(state.clues ?? [], msg.clue) })
        return
      case 'clue.shown': {
        // A pista fica no caderno de qualquer jeito; o cartão só abre com o mapa na tela.
        const clues = withClue(state.clues ?? [], msg.clue)
        setState(state.status === 'playing' ? { clues, shownClue: { id: nextNoticeId++, from: msg.from, clue: msg.clue } } : { clues })
        return
      }
      case 'clue.peers': {
        // Só quem pediu espera a lista: resposta atrasada de um cartão já fechado não reabre nada.
        // A mesma pergunta serve ao cartão da pista e ao "Mostrar meu mapa a…": cada um só se estava esperando.
        const ready: CluePeers = { phase: 'ready', names: msg.names }
        const patch: Partial<PlayerState> = {}
        if (state.cluePeers?.phase === 'loading') patch.cluePeers = ready
        if (state.mapPeers?.phase === 'loading') patch.mapPeers = ready
        if (patch.cluePeers !== undefined || patch.mapPeers !== undefined) setState(patch)
        return
      }
      case 'clue.show.result':
        if (state.clueShow?.phase !== 'sending' || state.clueShow.to !== msg.to) return
        setState({ clueShow: { to: msg.to, phase: msg.ok ? 'ok' : msg.reason === 'too_soon' ? 'too_soon' : 'failed' } })
        return
    }
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
        setState({ playerId: data.playerId, status: state.status === 'playing' ? 'playing' : 'waiting' })
        return
      case 'lobby.waiting':
        clearSignalTimers()
        clearLaserTimer()
        clearPlayerLasers()
        resetOwnLaser()
        clearDoorNotice()
        clearMoveNotice()
        clearTravelTimer()
        clearMapSharedTimer()
        setState({ status: 'waiting', map: undefined, vision: undefined, explored: undefined, ownTokens: undefined, concealed: undefined, signals: undefined, laser: undefined, playerLasers: undefined, doorNotice: undefined, moveNotice: undefined, travel: undefined, shownClue: undefined, cluePeers: undefined, clueShow: undefined, mapPeers: undefined, mapShare: undefined, mapShared: undefined })
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
        clearPlayerLasers()
        resetOwnLaser()
        clearDoorNotice()
        clearMoveNotice()
        // As listas de "Mostrar para…" e "Mostrar meu mapa a…" eram de quem estava na cena de antes.
        setState({ signals: undefined, laser: undefined, playerLasers: undefined, doorNotice: undefined, moveNotice: undefined, cluePeers: undefined, clueShow: undefined, mapPeers: undefined, mapShare: undefined })
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
        const book = state.notebook ?? []
        // Já guardado (o host reenvia o último recado da cena na volta): reabre o cartão, sem repetir nem virar "novo".
        if (book.some((entry) => entry.id === note.id)) {
          setState({ note: { id: note.id, text: note.text } })
          return
        }
        // Mestre antigo não manda a hora: vale a da chegada.
        const entry: NoteEntry = { id: note.id, text: note.text, at: note.at ?? Date.now() }
        setState({
          note: { id: note.id, text: note.text },
          notebook: [...book, entry].slice(-NOTEBOOK_MAX_NOTES),
          unreadNotes: [...(state.unreadNotes ?? []), note.id].slice(-NOTEBOOK_MAX_NOTES),
        })
        return
      }
      case 'notes.book': {
        // Vale também aguardando: o caderno é do jogador, não da cena.
        const book = parseNotebook(data)
        if (book === null) return
        // Recado que o host já tinha é história, não novidade: só o que ainda estava por ler e continua na lista segue novo.
        const kept = new Set(book.notes.map((entry) => entry.id))
        setState({ notebook: book.notes, unreadNotes: (state.unreadNotes ?? []).filter((id) => kept.has(id)) })
        return
      }
      case 'clue.added':
      case 'clues.book':
      case 'clue.shown':
      case 'clue.peers':
      case 'clue.show.result':
        handleClueMessage(data)
        return
      case 'map.shared':
      case 'map.share.result':
        handleMapShareMessage(data)
        return
      case 'room.text': {
        // Mesma regra do recado: só quem joga tem tela de cartão.
        if (state.status !== 'playing') return
        const roomText = parseRoomText(data)
        if (roomText === null) return
        setState({ roomText: { id: roomText.id, title: roomText.title, text: roomText.text } })
        return
      }
      case 'laser': {
        // Laser sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        const laser = parseLaserMessage(data)
        if (laser === null) return
        const now = Date.now()
        if ('from' in laser) {
          // Laser de OUTRO jogador: rastro próprio, na cor da ficha dele — nunca se mistura ao do mestre.
          const origin = { key: laser.from, label: laser.from, color: laser.color }
          const update: RemoteLaserUpdate = 'off' in laser ? { off: true } : { points: laser.points }
          updatePlayerLasers(applyRemoteLaser(pruneRemoteLasers(state.playerLasers ?? [], now), origin, update, now))
          return
        }
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
        showDoorNotice(reason)
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
        handleRejected(data.reqId, data.reason)
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
        clearPlayerLasers()
        resetOwnLaser()
        clearDoorNotice()
        clearMoveNotice()
        clearTravelTimer()
        clearMapSharedTimer()
        setState({ status: 'closed', playerLasers: undefined, doorNotice: undefined, moveNotice: undefined, travel: undefined, mapShared: undefined })
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
      const join: JoinMessage = resume ? { type: 'join', code, name, resume } : { type: 'join', code, name }
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
    clearPlayerLasers()
    resetOwnLaser()
    clearDoorNotice()
    clearMoveNotice()
    clearTravelTimer()
    clearMapSharedTimer()
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

    laserMove(x, y) {
      if (state.status !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return false
      if (socket === null || socket.readyState !== SOCKET_OPEN) return false
      // Inteiro basta para o rastro e encurta o payload que sai 20 vezes por segundo.
      const point = { x: Math.round(x), y: Math.round(y) }
      if (ownLaserTimer === null) {
        ownLaserSent = send({ type: 'laser', points: [point] }) || ownLaserSent
        armOwnLaserTimer()
        return true
      }
      // Acima do teto sai o ponto mais antigo: o host descartaria o lote inteiro.
      if (ownLaserBuffer.length >= LASER_MAX_POINTS_PER_MESSAGE) ownLaserBuffer.shift()
      ownLaserBuffer.push(point)
      ownLaserSent = true
      return true
    },

    laserOff() {
      if (!ownLaserSent) return
      // O que ainda esperava a janela sai antes do `off`: é a ponta onde o dedo parou.
      const rest = ownLaserBuffer
      resetOwnLaser()
      if (rest.length > 0) send({ type: 'laser', points: rest })
      send({ type: 'laser', off: true })
    },

    dismissNote() {
      const open = state.note
      if (open === undefined) return
      setState({ note: undefined, unreadNotes: (state.unreadNotes ?? []).filter((id) => id !== open.id) })
    },

    markNotebookRead() {
      if ((state.unreadNotes ?? []).length > 0) setState({ unreadNotes: undefined })
    },

    openRoomText(regionId) {
      // Só o que JÁ chegou no mapa: o host manda o texto a quem entrou na Sala.
      const room = state.map?.regions.find((r) => r.id === regionId)?.room
      const text = room?.textoAoEntrar
      if (room === undefined || text === undefined || !hasEnterText(room)) return false
      setState({ roomText: { id: regionId, title: room.name, text } })
      return true
    },

    dismissRoomText() {
      if (state.roomText !== undefined) setState({ roomText: undefined })
    },

    readClue(pinId) {
      if (state.status !== 'playing') return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      // Cartão vazio ("O mestre ainda não escreveu nada") não é pista: nem pede.
      if (pin === undefined || (pin.description.trim() === '' && !isPlayerSafePinImage(pin.image))) return false
      return send({ type: 'clue.read', pinId })
    },

    askCluePeers() {
      if (state.status !== 'playing' || !send({ type: 'clue.peers' })) return false
      setState({ cluePeers: { phase: 'loading' }, clueShow: undefined })
      return true
    },

    showClue(clueId, to) {
      if (state.status !== 'playing' || !(state.clues ?? []).some((entry) => entry.id === clueId)) return false
      if (!send({ type: 'clue.show', clueId, to })) return false
      setState({ clueShow: { to, phase: 'sending' } })
      return true
    },

    resetClueShare() {
      if (state.cluePeers !== undefined || state.clueShow !== undefined) setState({ cluePeers: undefined, clueShow: undefined })
    },

    askMapPeers() {
      if (state.status !== 'playing' || !send({ type: 'clue.peers' })) return false
      setState({ mapPeers: { phase: 'loading' }, mapShare: undefined })
      return true
    },

    shareMap(to) {
      if (state.status !== 'playing' || !send({ type: 'map.share', to })) return false
      setState({ mapShare: { to, phase: 'sending' } })
      return true
    },

    resetMapShare() {
      if (state.mapPeers !== undefined || state.mapShare !== undefined) setState({ mapPeers: undefined, mapShare: undefined })
    },

    dismissShownClue() {
      if (state.shownClue !== undefined) setState({ shownClue: undefined })
    },

    setOwnTokenName(tokenId, name) {
      const limpo = name.trim()
      if (limpo.length < NAME_MIN_LENGTH || limpo.length > NAME_MAX_LENGTH) return false
      return editOwnToken(tokenId, { type: 'token.edit', tokenId, name: limpo }, { name: limpo })
    },

    setOwnTokenPhoto(tokenId, image) {
      // Forma certa E tamanho que o servidor aceita: acima do teto de envio a
      // foto nem sai — o jogador fica na mesa com a foto de antes.
      if (!fitsTokenPhotoSend(image)) return false
      // `image: null` junto: o caminho do disco do mestre (quando havia um)
      // deixa de valer para este token — a foto agora é a que o jogador
      // escolheu, e é a embutida que viaja. Mesma forma que o host vai gravar.
      return editOwnToken(tokenId, { type: 'token.edit', tokenId, image }, { image: null, imageData: image })
    },
    reconnect() {
      detach()
      setState({ status: 'connecting', error: undefined, rev: -1, map: undefined, vision: undefined, explored: undefined, ownTokens: undefined, concealed: undefined, signals: undefined, laser: undefined, playerLasers: undefined, doorNotice: undefined, moveNotice: undefined, travel: undefined, note: undefined, roomText: undefined, notebook: undefined, unreadNotes: undefined, clues: undefined, shownClue: undefined, cluePeers: undefined, clueShow: undefined, mapPeers: undefined, mapShare: undefined, mapShared: undefined })
      open()
    },
    close: detach,
  }
}
