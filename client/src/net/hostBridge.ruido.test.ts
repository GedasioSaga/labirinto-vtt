import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * RUÍDO NO MAPA, lado do integrador: `noise` manda pelo fio só o que a sessão
 * decidiu (direção, para quem está perto) e devolve quantos ouviram, para o
 * mestre ler o resultado. Sala fechada: `null`, nada sai.
 */

const ROOM = { code: 'RU1D05', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null })
const MAPA: MapData = { ...createEmptyMap('m', 'Porao', 60, 10, 50), tokens: [ficha('ficha-gabi', 300), ficha('ficha-ana', 2900)] }

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({ invoke, listen, getMap: () => MAPA, applyMove: vi.fn(), applyDoor: vi.fn(), onPlayersChange: vi.fn(), now: () => 0 })
  await bridge.start()
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const entra = (clientId: string, name: string, tokenId: string): void => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c-gabi', 'Gabi', 'ficha-gabi')
  entra('c-ana', 'Ana', 'ficha-ana')
  return { bridge, invoke }
}

function ruidosEnviados(invoke: ReturnType<typeof vi.fn>): unknown[] {
  return invoke.mock.calls.filter(([cmd, args]) => cmd === 'net_send' && JSON.stringify(args).includes('"noise"')).map(([, args]) => args)
}

describe('hostBridge: ruído no mapa', () => {
  it('sai só para quem está perto, só com a direção, e devolve quantos ouviram', async () => {
    const { bridge, invoke } = await mesa()
    expect(bridge.noise(700, 200, 12)).toBe(1)
    expect(ruidosEnviados(invoke)).toEqual([{ clientId: 'c-gabi', msg: { type: 'noise', id: expect.any(String), dir: 'e' } }])
  })

  it('ninguém perto: 0, e nada sai', async () => {
    const { bridge, invoke } = await mesa()
    expect(bridge.noise(1600, 200, 6)).toBe(0)
    expect(ruidosEnviados(invoke)).toEqual([])
  })

  it('sala fechada: null', async () => {
    const { bridge, invoke } = await mesa()
    await bridge.stop()
    expect(bridge.noise(700, 200, 12)).toBeNull()
    expect(ruidosEnviados(invoke)).toEqual([])
  })
})
