import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token, Wall } from '../types/map'
import { createHostBridge } from './hostBridge'
import { PEEK_DURATION_MS } from './hostSession'

/**
 * ESPIAR, lado do integrador: o mestre lê "Ana espiou", a Ana recebe o cone NA
 * HORA, e quando o prazo acaba sai o snapshot que o fecha — sem o mestre mexer
 * em nada.
 */
const ROOM = { code: 'ESPI02', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const parede = (id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({
  id,
  x1,
  y1,
  x2,
  y2,
  blocksLight: true,
  blocksMove: true,
  door: null,
  ...extra,
})
const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 300, size: 1, image: null })

const MAPA: MapData = {
  ...createEmptyMap('m', 'Porto', 20, 12, 50),
  walls: [
    parede('n', 500, 0, 500, 250),
    parede('porta', 500, 250, 500, 350, { door: { open: false, locked: false, kind: 'normal' } }),
    parede('s', 500, 350, 500, 600),
  ],
  tokens: [ficha('ficha-ana', 460), ficha('escrivao', 700)],
}

describe('hostBridge: espiar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('aviso ao mestre, cone na hora para a Ana e cone fechado no fim do prazo', async () => {
    const relogio = { agora: 1_000 }
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    /** Fichas de cada snapshot que saiu para a Ana, na ordem. */
    const snapshotsDaAna: string[][] = []
    const invoke = vi.fn(async (cmd: string, args?: unknown) => {
      if (cmd === 'net_start_room') return ROOM
      if (cmd !== 'net_send' || typeof args !== 'object' || args === null || !('clientId' in args) || !('msg' in args)) return undefined
      const { clientId, msg } = args
      if (clientId !== 'c-ana' || typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'snapshot' || !('map' in msg)) return undefined
      const map = msg.map
      if (typeof map === 'object' && map !== null && 'tokens' in map && Array.isArray(map.tokens)) {
        snapshotsDaAna.push(map.tokens.map((t: unknown) => (typeof t === 'object' && t !== null && 'id' in t ? String(t.id) : '')).sort())
      }
      return undefined
    })
    const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return vi.fn()
    })
    const bridge = createHostBridge({ invoke, listen, getMap: () => MAPA, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => relogio.agora })
    await bridge.start()
    const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
    emit({ clientId: 'c-ana', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const ana = bridge.players().find((p) => p.name === 'Ana')
    if (ana === undefined) throw new Error('Ana deveria ter entrado')
    bridge.assignToken(ana.playerId, 'ficha-ana')

    const fichasNoUltimo = (): string[] => snapshotsDaAna.at(-1) ?? []
    await vi.runOnlyPendingTimersAsync()
    expect(fichasNoUltimo()).toEqual(['ficha-ana'])

    emit({ clientId: 'c-ana', msg: { type: 'door.peek', wallId: 'porta' } })
    await Promise.resolve()
    expect(useToastStore.getState().toasts.map((t) => t.text)).toContain('Ana espiou')
    expect(fichasNoUltimo()).toEqual(['escrivao', 'ficha-ana'])

    relogio.agora += PEEK_DURATION_MS + 100
    await vi.advanceTimersByTimeAsync(PEEK_DURATION_MS + 100)
    expect(fichasNoUltimo()).toEqual(['ficha-ana'])
    await bridge.stop()
  })
})
