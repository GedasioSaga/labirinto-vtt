import type { DoorState, MapData, RegionPoint } from '../types/map'
import { createExploration, encodeExploration, isPointExplored, markAll, markRings, type Exploration } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { filterMapForPlayer, playerBlockedRings } from '../lib/fogFilter'
import { validateTokenMove } from '../lib/moveValidation'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import { parsePlayerMessage, type HostMessage, type JoinMessage, type LaserMessage, type SignalMessage, type TokenMoveMessage } from './protocol'

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

/** Sinal aceito de um jogador, para a UI do mestre desenhar. */
export interface HostSignal {
  playerId: string
  name: string
  color: string
  x: number
  y: number
}

export interface HostResult {
  outbound: Outbound[]
  applyMove?: AppliedMove
  signal?: HostSignal
}

export interface PlayerInfo {
  clientId: string | null
  playerId: string
  name: string
  status: PlayerStatus
  connected: boolean
  tokenIds: string[]
  /** Raio efetivo: o do mestre para este jogador ou, sem ajuste, o global. */
  visionRadius: number
}

/** Faixa do "Raio de visão" por jogador, em px de mundo. */
export const VISION_RADIUS_MIN = 50
export const VISION_RADIUS_MAX = 2000
export const VISION_RADIUS_STEP = 50

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
  /** Laser do mestre para todo jogador conectado e jogando (quem aguarda não tem mapa onde desenhar). */
  laser(message: LaserMessage): HostResult
  /**
   * Raio de visão só deste jogador (limitado à faixa); `null` volta ao global.
   * Não envia: o integrador faz o broadcast. Jogador desconhecido ou raio não finito é ignorado.
   */
  setVisionRadius(playerId: string, radius: number | null): void
  /** Marca a planta inteira como explorada para o jogador, fora de zona oculta ativa. Tokens seguem exigindo visão. */
  revealPlan(playerId: string, map: MapData): void
  /** Zera exploração e portas lembradas do jogador; a visão atual volta a marcar no próximo broadcast. */
  hidePlan(playerId: string): void
  listPlayers(): PlayerInfo[]
  readonly rev: number
}

/** O que um jogador lembra de um mapa: células exploradas e último estado visto de cada porta. */
interface PlayerMemory {
  key: string
  exp: Exploration
  doors: Map<string, DoorState>
  /** Visão enviada no último snapshot: é o que o jogador está vendo agora na tela. */
  vision: RegionPoint[][]
}

/** Chave de comparação do nome: sem maiúsculas e sem espaços. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '')
}

function memoryKey(map: MapData): string {
  return `${map.id}|${map.width}|${map.height}|${map.grid}`
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
  // Por playerId: reconectar não zera o limite de 1 sinal por segundo.
  const lastSignalAt = new Map<string, number>()
  // Por playerId: ajuste do mestre sobre `options.visionRadius`; só o kick apaga.
  const visionOverrides = new Map<string, number>()
  let rev = 0

  const radiusFor = (playerId: string): number => visionOverrides.get(playerId) ?? options.visionRadius

  /** Polígonos das zonas ocultas ativas (`?? []`: mapa montado fora do deserializeMap pode vir sem o campo). */
  const statusOf = (playerId: string): PlayerStatus => ((ownership[playerId]?.length ?? 0) > 0 ? 'playing' : 'waiting')

  /** Memória do jogador para este mapa; outro mapa (ou mesmo id redimensionado) começa do zero. */
  const memoryFor = (playerId: string, map: MapData): PlayerMemory => {
    const key = memoryKey(map)
    const current = explorations.get(playerId)
    if (current !== undefined && current.key === key) return current
    // MapData.width/height estão em células; o explorado mede px de mundo (mesma unidade da visão).
    const exp = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    const memory: PlayerMemory = { key, exp, doors: new Map(), vision: [] }
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
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), exp, memory.doors)
    // Zona oculta ativa e sala secreta: célula que toca nelas não vira explorada
    // (senão o jogador guardaria a planta escondida e o formato dela).
    markRings(exp, view.vision, view.blocked)
    memory.vision = view.vision
    const seenNow = new Set(view.visibleDoorIds)
    for (const w of view.map.walls) {
      if (w.door !== null && seenNow.has(w.id)) memory.doors.set(w.id, { ...w.door })
    }
    const sent = new Set(view.map.tokens.map((t) => t.id))
    const ownTokens = (ownership[playerId] ?? []).filter((id) => sent.has(id))
    return { type: 'snapshot', rev, map: view.map, vision: view.vision, explored: encodeExploration(exp), ownTokens, concealed: view.concealed }
  }

  const reply = (clientId: string, msg: HostMessage): HostResult => ({ outbound: [{ clientId, msg }] })

  /** Jogador que jogava e ficou sem token volta ao lobby; desconectado recebe o estado no resume. */
  const waitingIfLostLast = (playerId: string, wasPlaying: boolean): Outbound[] => {
    const clientId = players.get(playerId)?.clientId ?? null // registro ausente = jogador expulso: não há a quem avisar
    if (!wasPlaying || statusOf(playerId) === 'playing' || clientId === null) return []
    return [{ clientId, msg: { type: 'lobby.waiting' } }]
  }

  /**
   * O nome vai no `from` do sinal: nome igual ao de OUTRO jogador (sem
   * maiúsculas nem espaços) ganha ' (2)', ' (3)'... O próprio jogador (resume)
   * não conflita consigo.
   */
  const uniqueName = (wanted: string, playerId: string): string => {
    const taken = new Set([...players.values()].filter((p) => p.playerId !== playerId).map((p) => normalizeName(p.name)))
    if (!taken.has(normalizeName(wanted))) return wanted
    let n = 2
    while (taken.has(normalizeName(`${wanted} (${n})`))) n += 1
    return `${wanted} (${n})`
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
    record.name = uniqueName(msg.name, record.playerId)
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

  /** O jogador já conhece o ponto: está na visão do último snapshot ou numa célula explorada deste mapa. */
  const knowsPoint = (playerId: string, map: MapData, point: RegionPoint): boolean => {
    const memory = explorations.get(playerId)
    if (memory === undefined || memory.key !== memoryKey(map)) return false
    return memory.vision.some((ring) => ring.length >= 3 && pointInRing(point, ring)) || isPointExplored(memory.exp, point)
  }

  /**
   * O mestre sempre recebe o sinal (campo `signal`) e quem sinalizou recebe o
   * eco. Outro jogador só recebe se já conhece o ponto e o ponto está fora de
   * zona oculta ativa: senão o sinal diria que existe algo naquele lugar.
   * Sinal fora do mapa, de quem não joga ou antes do intervalo mínimo é
   * descartado em silêncio (não é mensagem malformada).
   */
  function handleSignal(clientId: string, msg: SignalMessage, map: MapData): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    if (msg.x < 0 || msg.y < 0 || msg.x > map.width * map.grid || msg.y > map.height * map.grid) return { outbound: [] }
    const at = now()
    const last = lastSignalAt.get(playerId)
    if (last !== undefined && at - last < SIGNAL_MIN_INTERVAL_MS) return { outbound: [] }
    lastSignalAt.set(playerId, at)

    const point = { x: msg.x, y: msg.y }
    const color = signalColor(playerId)
    const message: HostMessage = { type: 'signal', x: msg.x, y: msg.y, from: record.name, color }
    const outbound: Outbound[] = [{ clientId, msg: message }]
    // Sala secreta vale como zona oculta: repassar o sinal diria aos outros que ali existe algo.
    const inBlockedArea = playerBlockedRings(map).some((ring) => ring.length >= 3 && pointInRing(point, ring))
    if (!inBlockedArea) {
      for (const [otherClient, otherId] of byClient) {
        if (otherId === playerId || statusOf(otherId) !== 'playing') continue
        if (knowsPoint(otherId, map, point)) outbound.push({ clientId: otherClient, msg: message })
      }
    }
    return { outbound, signal: { playerId, name: record.name, color, x: msg.x, y: msg.y } }
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
        case 'signal':
          return handleSignal(clientId, msg, map)
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
      lastSignalAt.delete(playerId)
      visionOverrides.delete(playerId)
      return reply(clientId, { type: 'kicked' })
    },

    setVisionRadius(playerId, radius) {
      if (!players.has(playerId)) return
      if (radius === null) {
        visionOverrides.delete(playerId)
        return
      }
      if (!Number.isFinite(radius)) return
      visionOverrides.set(playerId, Math.min(VISION_RADIUS_MAX, Math.max(VISION_RADIUS_MIN, radius)))
    },

    revealPlan(playerId, map) {
      if (!players.has(playerId)) return
      markAll(memoryFor(playerId, map).exp, playerBlockedRings(map))
    },

    hidePlan(playerId) {
      // Apagar a memória inteira: o próximo snapshot recria vazia (explorado, portas e visão).
      explorations.delete(playerId)
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

    laser(message) {
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) === 'playing') outbound.push({ clientId, msg: message })
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
          visionRadius: radiusFor(p.playerId),
        }))
    },
  }
}
