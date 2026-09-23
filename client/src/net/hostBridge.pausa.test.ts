import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * PAUSA POR CENA pela ponte do mestre: sem sala não há pausa; com sala, o
 * aviso sai pelo `net_send` só para quem está na cena pausada.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number, y: number): Token => ({ id, characterId: null, name: id, x, y, size: 1, image: null })

const world = (): HostWorld => ({
  open: { sceneId: 'cena-a', name: 'Salão', map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: [ficha('ficha-ana', 200, 200)] } },
  background: [{ sceneId: 'cena-b', name: 'Cripta', map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), tokens: [ficha('ficha-bruno', 200, 200)] } }],
})

function ponte() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, emit, sent }
}

describe('hostBridge: pausa por cena', () => {
  it('sem sala aberta, pausar não vale', () => {
    const { bridge } = ponte()
    expect(bridge.setScenePaused('cena-a', true)).toBe(false)
  })

  it('com a sala aberta, o aviso vai só a quem está na cena pausada', async () => {
    const { bridge, emit, sent } = ponte()
    await bridge.start()
    const entra = (clientId: string, name: string, tokenId: string) => {
      emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
      const player = bridge.players().find((p) => p.name === name)
      if (player === undefined) throw new Error(`${name} deveria ter entrado`)
      bridge.assignToken(player.playerId, tokenId)
    }
    entra('c1', 'Ana', 'ficha-ana')
    entra('c2', 'Bruno', 'ficha-bruno')

    const antes = sent().length
    expect(bridge.setScenePaused('cena-a', true)).toBe(true)
    await Promise.resolve()
    const depois = sent().slice(antes)
    expect(depois).toEqual([{ clientId: 'c1', msg: { type: 'scene.paused', paused: true } }])

    // Ana tenta andar: recusa `paused`, e o mapa do mestre não muda.
    emit({ clientId: 'c1', msg: { type: 'token.move', reqId: 'r1', tokenId: 'ficha-ana', x: 350, y: 200 } })
    await Promise.resolve()
    expect(sent()).toContainEqual({ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'paused' } })
  })
})
