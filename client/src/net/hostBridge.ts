import type { InvokeArgs } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type PlayerInfo } from './hostSession'

/**
 * Costura entre a sessão pura (`hostSession`) e o transporte Rust (comandos
 * `net_*` e eventos `net:*`). `invoke`/`listen` entram por injeção para os
 * testes rodarem sem Tauri.
 *
 * Contrato com o Rust: `clientId` é string em `net:message` {clientId, msg},
 * `net:peer` {clientId, event, name?}, `net_send({clientId, msg})` e
 * `net_kick({clientId})`.
 */

export interface RoomInfo {
  code: string
  urls: string[]
  qrSvg: string
}

/** Formas mínimas que `invoke`/`listen` reais de `@tauri-apps/api` satisfazem. */
export type InvokeFn = (cmd: string, args?: InvokeArgs) => Promise<unknown>
export type ListenFn = (event: string, handler: (event: { payload: unknown }) => void) => Promise<UnlistenFn>

export interface HostBridgeDeps {
  invoke: InvokeFn
  listen: ListenFn
  getMap: () => MapData
  applyMove: (tokenId: string, x: number, y: number) => void
  visionRadius?: number
  onPlayersChange?: (players: PlayerInfo[]) => void
  now?: () => number
}

export interface HostBridge {
  start(): Promise<RoomInfo>
  stop(): Promise<void>
  notifyMapChanged(): void
  assignToken(playerId: string, tokenId: string): void
  unassignToken(playerId: string, tokenId: string): void
  kick(clientId: string): Promise<void>
  players(): PlayerInfo[]
  room(): RoomInfo | null
}

export const BROADCAST_THROTTLE_MS = 50
const DEFAULT_VISION_RADIUS = 700
/** Id de conexão do Rust (hoje um contador decimal); o padrão aceita folga sem abrir para lixo. */
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseClientId(value: unknown): string | null {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value) ? value : null
}

function parseRoomInfo(value: unknown): RoomInfo | null {
  if (!isRecord(value)) return null
  const { code, urls, qrSvg } = value
  if (typeof code !== 'string' || typeof qrSvg !== 'string') return null
  if (!Array.isArray(urls) || !urls.every((u): u is string => typeof u === 'string')) return null
  return { code, urls, qrSvg }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function reportError(context: string, error: unknown): void {
  useToastStore.getState().push('error', `${context}: ${errorText(error)}`)
}

export function createHostBridge(deps: HostBridgeDeps): HostBridge {
  let session: HostSession | null = null
  let currentRoom: RoomInfo | null = null
  let unlisteners: UnlistenFn[] = []
  let pendingBroadcast: ReturnType<typeof setTimeout> | null = null
  let pendingStart: Promise<RoomInfo> | null = null
  let lastPlayersKey = '[]'

  const notifyPlayersIfChanged = () => {
    const list = session?.listPlayers() ?? []
    const key = JSON.stringify(list)
    if (key === lastPlayersKey) return
    lastPlayersKey = key
    deps.onPlayersChange?.(list)
  }

  /** Envia tudo; a promise nunca rejeita — falha vira toast, nunca silêncio. */
  const dispatch = (result: HostResult): Promise<void> =>
    Promise.all(
      result.outbound.map(({ clientId, msg }) =>
        deps.invoke('net_send', { clientId, msg }).catch((error: unknown) => reportError('Falha ao enviar para jogador', error)),
      ),
    ).then(() => undefined)

  /** Espera o envio (ex.: `kicked`, `error`) sair antes de derrubar a conexão. */
  const sendThenKick = async (result: HostResult, clientId: string): Promise<void> => {
    await dispatch(result)
    try {
      await deps.invoke('net_kick', { clientId })
    } catch (error) {
      reportError('Não foi possível expulsar o jogador', error)
    }
  }

  const broadcastNow = () => {
    if (session === null) return
    void dispatch(session.broadcast(deps.getMap()))
  }

  const cancelPendingBroadcast = () => {
    if (pendingBroadcast === null) return
    clearTimeout(pendingBroadcast)
    pendingBroadcast = null
  }

  const onMessage = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null) return
    const wasJoined = session.listPlayers().some((p) => p.clientId === clientId)
    const result = session.handleMessage(clientId, event.payload.msg, deps.getMap())
    const rejectedJoin = !wasJoined && result.outbound.some((o) => o.msg.type === 'error' && o.msg.reason === 'invalid_message')
    if (rejectedJoin) {
      // Conexão que nem entrou manda lixo: responde e libera a vaga no Rust.
      void sendThenKick(result, clientId)
      return
    }
    void dispatch(result)
    if (result.applyMove !== undefined) {
      const { tokenId, x, y } = result.applyMove
      deps.applyMove(tokenId, x, y)
      broadcastNow()
    }
    notifyPlayersIfChanged()
  }

  const onPeer = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null || event.payload.event !== 'disconnected') return
    session.disconnect(clientId)
    notifyPlayersIfChanged()
  }

  const removeListeners = () => {
    for (const unlisten of unlisteners) unlisten()
    unlisteners = []
  }

  const openRoom = async (): Promise<RoomInfo> => {
    try {
      const room = parseRoomInfo(await deps.invoke('net_start_room'))
      if (room === null) throw new Error('resposta inválida de net_start_room')
      session = createHostSession({ code: room.code, visionRadius: deps.visionRadius ?? DEFAULT_VISION_RADIUS, now: deps.now })
      unlisteners = [await deps.listen('net:message', onMessage), await deps.listen('net:peer', onPeer)]
      currentRoom = room
      notifyPlayersIfChanged()
      return room
    } catch (error) {
      removeListeners()
      session = null
      reportError('Não foi possível abrir a sala', error)
      throw error
    }
  }

  return {
    start() {
      if (currentRoom !== null) return Promise.resolve(currentRoom)
      // Duplo clique: o segundo start recebe a mesma promise, sem segunda sala.
      if (pendingStart !== null) return pendingStart
      const started = openRoom()
      pendingStart = started
      const clear = () => {
        if (pendingStart === started) pendingStart = null
      }
      started.then(clear, clear)
      return started
    },

    async stop() {
      if (pendingStart !== null) {
        try {
          await pendingStart
        } catch {
          // A falha do start já virou toast lá; aqui só importa que ele terminou.
        }
      }
      cancelPendingBroadcast()
      removeListeners()
      session = null
      currentRoom = null
      notifyPlayersIfChanged()
      try {
        await deps.invoke('net_stop_room')
      } catch (error) {
        reportError('Não foi possível fechar a sala', error)
      }
    },

    notifyMapChanged() {
      if (session === null || pendingBroadcast !== null) return
      pendingBroadcast = setTimeout(() => {
        pendingBroadcast = null
        broadcastNow()
      }, BROADCAST_THROTTLE_MS)
    },

    assignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.assignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
    },

    unassignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.unassignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
    },

    async kick(clientId) {
      if (session === null) return
      const result = session.kick(clientId)
      notifyPlayersIfChanged()
      await sendThenKick(result, clientId)
    },

    players() {
      return session?.listPlayers() ?? []
    },

    room() {
      return currentRoom
    },
  }
}
