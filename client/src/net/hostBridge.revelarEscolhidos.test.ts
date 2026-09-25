import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * REVELAR PARA OS ESCOLHIDOS do lado do integrador: marcar quem descobriu a
 * ficha secreta manda o snapshot NA HORA e avisa o App da lista nova, que é o
 * que o painel desenha. Fechar a sala apaga as listas.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number, extra: Partial<Token> = {}): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null, ...extra })
const MAPA: MapData = {
  ...createEmptyMap('m', 'Castelo', 40, 10, 50),
  tokens: [ficha('ficha-ana', 200), ficha('ficha-duda', 250), ficha('sentinela', 350, { secret: true })],
}

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onSecretRevealsChange = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => MAPA,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    onSecretRevealsChange,
    now: () => 0,
  })
  await bridge.start()
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const entra = (clientId: string, name: string, tokenId: string): string => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    return player.playerId
  }
  const ana = entra('c-ana', 'Ana', 'ficha-ana')
  entra('c-duda', 'Duda', 'ficha-duda')
  /** Fichas do último snapshot enviado a `clientId`. */
  const fichasDe = (clientId: string): string[] => {
    const envios = invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
    for (let i = envios.length - 1; i >= 0; i -= 1) {
      const envio = envios[i]
      if (typeof envio !== 'object' || envio === null || !('clientId' in envio) || !('msg' in envio)) continue
      if (envio.clientId !== clientId) continue
      const msg = envio.msg
      if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'snapshot' && 'map' in msg) {
        const map = msg.map
        if (typeof map === 'object' && map !== null && 'tokens' in map && Array.isArray(map.tokens)) {
          return map.tokens.flatMap((t: unknown) => (typeof t === 'object' && t !== null && 'id' in t && typeof t.id === 'string' ? [t.id] : []))
        }
      }
    }
    throw new Error(`nenhum snapshot para ${clientId}`)
  }
  return { bridge, ana, fichasDe, onSecretRevealsChange }
}

describe('hostBridge: revelar ficha e zona só para quem descobriu', () => {
  it('revelar a sentinela para Ana manda na hora só para ela; desmarcar tira na hora', async () => {
    const { bridge, ana, fichasDe, onSecretRevealsChange } = await mesa()
    expect(fichasDe('c-ana')).toEqual(['ficha-ana', 'ficha-duda'])
    bridge.setSecretReveal('sentinela', [ana])
    expect(fichasDe('c-ana')).toEqual(['ficha-ana', 'ficha-duda', 'sentinela'])
    expect(fichasDe('c-duda')).toEqual(['ficha-ana', 'ficha-duda'])
    expect(onSecretRevealsChange).toHaveBeenLastCalledWith({ sentinela: [ana] })
    bridge.setSecretReveal('sentinela', null)
    expect(fichasDe('c-ana')).toEqual(['ficha-ana', 'ficha-duda'])
    expect(onSecretRevealsChange).toHaveBeenLastCalledWith({})
  })

  it('fechar a sala apaga as listas no painel', async () => {
    const { bridge, ana, onSecretRevealsChange } = await mesa()
    bridge.setSecretReveal('sentinela', [ana])
    await bridge.stop()
    expect(onSecretRevealsChange).toHaveBeenLastCalledWith({})
  })
})
