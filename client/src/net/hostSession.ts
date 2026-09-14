import type { DoorState, MapData } from '../types/map'
import { createExploration, encodeExploration, markRings, type Exploration } from '../lib/exploration'
import { filterMapForPlayer } from '../lib/fogFilter'
import { validateTokenMove } from '../lib/moveValidation'
import { parsePlayerMessage, type HostMessage, type JoinMessage, type TokenMoveMessage } from './protocol'

/**
 * Sessão do mestre, lógica pura: não envia nada. Cada método devolve as
 * mensagens a enviar e o integrador (transporte + mapStore) as despacha.
 * Identidade: `clientId` é a conexão (troca a cada reconexão); `playerId` é o
 * jogador (estável, recuperável pelo `resumeToken`).
 */

export type PlayerStatus = 'waiting' | 'playing'

export interface Outbound {
  clientId: string
  msg: HostMessage
}

export interface AppliedMove {
  tokenId: string
  x: number
  y: number
}

export interface HostResult {
  outbound: Outbound[]
  applyMove?: AppliedMove
}

export interface PlayerInfo {
  clientId: string | null
  playerId: string
  name: string
  status: PlayerStatus
  connected: boolean
  tokenIds: string[]
}

export interface HostSessionOptions {
  code: string
  visionRadius: number
  now?: () => number
  randomId?: () => string
}

export interface HostSession {
  handleMessage(clientId: string, raw: unknown, map: MapData): HostResult
  /** Devolve `lobby.waiting` para quem perdeu o último token (dono anterior). */
  assignToken(playerId: string, tokenId: string): HostResult
  /** Devolve `lobby.waiting` se o jogador ficou sem token. */
  unassignToken(playerId: string, tokenId: string): HostResult
  disconnect(clientId: string): void
  kick(clientId: string): HostResult
  broadcast(map: MapData): HostResult
  listPlayers(): PlayerInfo[]
  readonly rev: number
}

/** O que um jogador lembra de um mapa: células exploradas e último estado visto de cada porta. */
interface PlayerMemory {
  key: string
  exp: Exploration
  doors: Map<string, DoorState>
}

interface PlayerRecord {
  playerId: string
  name: string
  resumeToken: string
  clientId: string | null
  joinedAt: number
}

export function createHostSession(options: HostSessionOptions): HostSession {
  const now = options.now ?? Date.now
  const randomId = options.randomId ?? (() => crypto.randomUUID())
  const players = new Map<string, PlayerRecord>() // playerId -> registro
  const byClient = new Map<string, string>() // clientId conectado -> playerId
  const ownership: Record<string, string[]> = {}
  // Por playerId (não clientId): sobrevive a reconexão/resume; só o kick apaga.
  // `doors`: último estado de cada porta que o jogador VIU (por id da parede).
  const explorations = new Map<string, PlayerMemory>()
  let rev = 0

  const statusOf = (playerId: string): PlayerStatus => ((ownership[playerId]?.length ?? 0) > 0 ? 'playing' : 'waiting')

  /** Memória do jogador para este mapa; outro mapa (ou mesmo id redimensionado) começa do zero. */
  const memoryFor = (playerId: string, map: MapData): PlayerMemory => {
    const key = `${map.id}|${map.width}|${map.height}|${map.grid}`
    const current = explorations.get(playerId)
    if (current !== undefined && current.key === key) return current
    // MapData.width/height estão em células; o explorado mede px de mundo (mesma unidade da visão).
    const exp = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    const memory: PlayerMemory = { key, exp, doors: new Map() }
    explorations.set(playerId, memory)
    return memory
  }

  /**
   * Nunca manda o mapa do host: sempre o recorte de `filterMapForPlayer`. O
   * filtro usa o explorado e as portas lembradas de antes desta visão (a visão
   * atual já entra por si); a marcação vem depois e segue junto para o jogador
   * desenhar a névoa.
   */
  const snapshotFor = (playerId: string, map: MapData): HostMessage => {
    const memory = memoryFor(playerId, map)
    const exp = memory.exp
    const view = filterMapForPlayer(map, playerId, ownership, options.visionRadius, exp, memory.doors)
    markRings(exp, view.vision)
    const seenNow = new Set(view.visibleDoorIds)
    for (const w of view.map.walls) {
      if (w.door !== null && seenNow.has(w.id)) memory.doors.set(w.id, { ...w.door })
    }
    const sent = new Set(view.map.tokens.map((t) => t.id))
    const ownTokens = (ownership[playerId] ?? []).filter((id) => sent.has(id))
    return { type: 'snapshot', rev, map: view.map, vision: view.vision, explored: encodeExploration(exp), ownTokens }
  }

  const reply = (clientId: string, msg: HostMessage): HostResult => ({ outbound: [{ clientId, msg }] })

  /** Jogador que jogava e ficou sem token volta ao lobby; desconectado recebe o estado no resume. */
  const waitingIfLostLast = (playerId: string, wasPlaying: boolean): Outbound[] => {
    const clientId = players.get(playerId)?.clientId ?? null // registro ausente = jogador expulso: não há a quem avisar
    if (!wasPlaying || statusOf(playerId) === 'playing' || clientId === null) return []
    return [{ clientId, msg: { type: 'lobby.waiting' } }]
  }

  function handleJoin(clientId: string, msg: JoinMessage, map: MapData): HostResult {
    if (byClient.has(clientId)) return reply(clientId, { type: 'error', reason: 'already_joined' })
    if (msg.code !== options.code) return reply(clientId, { type: 'error', reason: 'bad_code' })

    const resumed = msg.resume === undefined ? undefined : [...players.values()].find((p) => p.resumeToken === msg.resume)
    const record: PlayerRecord = resumed ?? {
      playerId: randomId(),
      name: msg.name,
      resumeToken: randomId(),
      clientId: null,
      joinedAt: now(),
    }
    // Reassumir derruba o vínculo com a conexão antiga, se ainda existir.
    if (record.clientId !== null) byClient.delete(record.clientId)
    record.clientId = clientId
    record.name = msg.name
    players.set(record.playerId, record)
    byClient.set(clientId, record.playerId)

    const welcome: HostMessage = { type: 'welcome', playerId: record.playerId, resumeToken: record.resumeToken }
    const next: HostMessage = statusOf(record.playerId) === 'playing' ? snapshotFor(record.playerId, map) : { type: 'lobby.waiting' }
    return { outbound: [{ clientId, msg: welcome }, { clientId, msg: next }] }
  }

  function handleMove(clientId: string, msg: TokenMoveMessage, map: MapData): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const result = validateTokenMove(map, { playerId, tokenId: msg.tokenId, x: msg.x, y: msg.y }, ownership)
    if (!result.ok) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: result.reason })
    return {
      outbound: [{ clientId, msg: { type: 'token.move.accepted', reqId: msg.reqId, x: result.x, y: result.y } }],
      applyMove: { tokenId: msg.tokenId, x: result.x, y: result.y },
    }
  }

  return {
    get rev() {
      return rev
    },

    handleMessage(clientId, raw, map) {
      const msg = parsePlayerMessage(raw)
      if (msg === null) return reply(clientId, { type: 'error', reason: 'invalid_message' })
      switch (msg.type) {
        case 'join':
          return handleJoin(clientId, msg, map)
        case 'token.move':
          return handleMove(clientId, msg, map)
        case 'ping':
          return { outbound: [] }
      }
    },

    assignToken(playerId, tokenId) {
      const outbound: Outbound[] = []
      // Um token tem no máximo um dono: tira de quem tinha antes.
      for (const [owner, tokens] of Object.entries(ownership)) {
        if (owner === playerId) continue
        const wasPlaying = tokens.length > 0
        ownership[owner] = tokens.filter((t) => t !== tokenId)
        outbound.push(...waitingIfLostLast(owner, wasPlaying))
      }
      const current = ownership[playerId] ?? []
      if (!current.includes(tokenId)) ownership[playerId] = [...current, tokenId]
      return { outbound }
    },

    unassignToken(playerId, tokenId) {
      const current = ownership[playerId]
      if (current === undefined) return { outbound: [] }
      ownership[playerId] = current.filter((t) => t !== tokenId)
      return { outbound: waitingIfLostLast(playerId, current.length > 0) }
    },

    disconnect(clientId) {
      const playerId = byClient.get(clientId)
      if (playerId === undefined) return
      byClient.delete(clientId)
      const record = players.get(playerId)
      if (record !== undefined) record.clientId = null // mantém o registro para permitir resume
    },

    kick(clientId) {
      const playerId = byClient.get(clientId)
      if (playerId === undefined) return { outbound: [] }
      byClient.delete(clientId)
      players.delete(playerId) // invalida o resumeToken
      delete ownership[playerId]
      explorations.delete(playerId)
      return reply(clientId, { type: 'kicked' })
    },

    broadcast(map) {
      rev += 1
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        outbound.push({ clientId, msg: snapshotFor(playerId, map) })
      }
      return { outbound }
    },

    listPlayers() {
      return [...players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          clientId: p.clientId,
          playerId: p.playerId,
          name: p.name,
          status: statusOf(p.playerId),
          connected: p.clientId !== null,
          tokenIds: [...(ownership[p.playerId] ?? [])],
        }))
    },
  }
}
