/**
 * RECADO PARA ESCOLHIDOS pela ponte: a lista de quem recebe que o painel manda
 * chega à sessão, e o `net_send` só sai para os marcados.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null }
}

const VILA: HostWorld = {
  open: { sceneId: 's-vila', name: 'Vila', map: { ...createEmptyMap('m-vila', 'Vila', 30, 10, 50), tokens: [ficha('t-ana', 100), ficha('t-bruno', 700)] } },
  background: [],
}

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return () => {}
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => VILA.open.map,
    getWorld: () => VILA,
    applyMove: () => {},
    applyDoor: () => {},
    now: () => 0,
  })
  await bridge.start()
  const emit = (clientId: string, name: string) => handlers.get('net:message')?.({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name } } })
  emit('c-ana', 'Ana')
  emit('c-bruno', 'Bruno')
  const ids = Object.fromEntries(bridge.players().map((p) => [p.name, p.playerId]))
  bridge.assignToken(ids.Ana, 't-ana')
  bridge.assignToken(ids.Bruno, 't-bruno')
  const notas = () =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send' && JSON.stringify(call[1]).includes('scene.note'))
      .map((call) => call[1])
  return { bridge, ids, notas }
}

describe('hostBridge.sceneNote com escolhidos', () => {
  it('só o Bruno marcado recebe; a Ana, na mesma cena, não', async () => {
    const { bridge, ids, notas } = await mesa()
    expect(bridge.sceneNote('s-vila', 'Uma carta.', [ids.Bruno])).toBe(1)
    expect(notas()).toEqual([{ clientId: 'c-bruno', msg: { type: 'scene.note', id: expect.any(String), text: 'Uma carta.' } }])
  })

  it('sem lista, a cena inteira recebe (o recado de antes)', async () => {
    const { bridge, notas } = await mesa()
    expect(bridge.sceneNote('s-vila', 'Todos.')).toBe(2)
    expect(notas()).toHaveLength(2)
  })
})
