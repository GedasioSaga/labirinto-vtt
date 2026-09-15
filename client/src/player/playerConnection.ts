import type { MapData, RegionPoint } from '../types/map'
import { decodeExploration, type Exploration } from '../lib/exploration'
import { NAME_MAX_LENGTH, type DoorToggleRejection, type JoinMessage, type PlayerMessage } from '../net/protocol'
import { MAX_ACTIVE_SIGNALS, SIGNAL_COLOR_PATTERN, SIGNAL_TTL_MS, type SignalMark } from '../lib/signals'
import { LASER_SEND_INTERVAL_MS, LASER_TRAIL_MS, appendLaserPoints, pruneLaserTrail, type LaserTrail } from '../lib/laser'
import { parseLaserMessage } from '../net/protocol'

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
  /** Recusa do mestre ao pedido de porta (trancada, longe, não visível); some sozinho. `id` novo repete o aviso. */
  doorNotice?: { id: number; reason: DoorToggleRejection }
  rev: number
  playerId?: string
  /** Motivo quando `status === 'error'`: razão do mestre ou 'connection_lost'. */
  error?: string
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
  /** Abre um socket novo (reconectar), reaproveitando o resumeToken guardado. */
  reconnect(): void
  close(): void
}

export const RESUME_STORAGE_KEY = 'labirinto.resume'
export const PING_INTERVAL_MS = 15_000
/** Quanto tempo o aviso da porta ("Trancada") fica na tela. */
export const DOOR_NOTICE_TTL_MS = 2500
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
        clearDoorNotice()
        setState({ status: 'waiting', map: undefined, vision: undefined, explored: undefined, ownTokens: undefined, concealed: undefined, signals: undefined, laser: undefined, doorNotice: undefined })
        return
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
        handleRejected(data.reqId)
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
        setState({ status: 'closed', doorNotice: undefined })
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
    clearDoorNotice()
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
    reconnect() {
      detach()
      setState({ status: 'connecting', error: undefined, rev: -1, map: undefined, vision: undefined, explored: undefined, ownTokens: undefined, concealed: undefined, signals: undefined, laser: undefined, doorNotice: undefined })
      open()
    },
    close: detach,
  }
}
