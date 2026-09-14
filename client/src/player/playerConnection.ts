import type { MapData, RegionPoint } from '../types/map'
import { decodeExploration, type Exploration } from '../lib/exploration'
import type { JoinMessage, PlayerMessage } from '../net/protocol'

/**
 * Cliente WebSocket do jogador, sem React e sem DOM: o socket e o storage são
 * injetáveis para teste. O estado é imutável — cada mudança gera um objeto novo
 * e avisa os ouvintes (encaixa em `useSyncExternalStore`).
 */

export type PlayerStatus = 'connecting' | 'waiting' | 'playing' | 'kicked' | 'error'

export interface PlayerState {
  status: PlayerStatus
  map?: MapData
  vision?: RegionPoint[][]
  /** O que o jogador já viu neste mapa (autoridade do mestre). */
  explored?: Exploration
  /** Ids dos tokens do próprio jogador presentes no mapa recebido. */
  ownTokens?: string[]
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
  /** Abre um socket novo (reconectar), reaproveitando o resumeToken guardado. */
  reconnect(): void
  close(): void
}

export const RESUME_STORAGE_KEY = 'labirinto.resume'
export const PING_INTERVAL_MS = 15_000
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

  function applySnapshot(rev: number, map: MapData, vision: RegionPoint[][], explored: Exploration | undefined, ownTokens: string[]): void {
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
    setState({ status: 'playing', rev, map: next, vision, explored, ownTokens, error: undefined })
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
        setState({ status: 'waiting', map: undefined, vision: undefined, explored: undefined, ownTokens: undefined })
        return
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
        applySnapshot(data.rev, data.map, data.vision, explored, data.ownTokens ?? [])
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
      if (state.status === 'kicked' || state.status === 'error') return
      setState({ status: 'error', error: CONNECTION_LOST })
    }
  }

  function detach(): void {
    stopPing()
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
    reconnect() {
      detach()
      setState({ status: 'connecting', error: undefined, rev: -1, map: undefined, vision: undefined, explored: undefined, ownTokens: undefined })
      open()
    },
    close: detach,
  }
}
