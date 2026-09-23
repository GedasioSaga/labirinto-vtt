import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * PINO SÓ PARA OS ESCOLHIDOS do lado do integrador: marcar quem vê manda o
 * snapshot NA HORA (o jogador marcado vê o pino sem recarregar) e avisa o App
 * da lista nova, que é o que o painel desenha. Fechar a sala apaga a lista.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null })
const FACA: Pin = { id: 'faca', x: 300, y: 200, kind: 'exclamacao', description: 'Faca', image: null }
const MAPA: MapData = { ...createEmptyMap('m', 'Quarto', 40, 10, 50), tokens: [ficha('ficha-diego', 200), ficha('ficha-carla', 250)], pins: [FACA] }

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onPinAudiencesChange = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => MAPA,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    onPinAudiencesChange,
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
  const diego = entra('c-diego', 'Diego', 'ficha-diego')
  const carla = entra('c-carla', 'Carla', 'ficha-carla')
  /** Pinos do último snapshot enviado a `clientId`. */
  const pinosDe = (clientId: string): string[] => {
    const envios = invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
    for (let i = envios.length - 1; i >= 0; i -= 1) {
      const envio = envios[i]
      if (typeof envio !== 'object' || envio === null || !('clientId' in envio) || !('msg' in envio)) continue
      if (envio.clientId !== clientId) continue
      const msg = envio.msg
      if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'snapshot' && 'map' in msg) {
        const map = msg.map
        if (typeof map === 'object' && map !== null && 'pins' in map && Array.isArray(map.pins)) {
          return map.pins.flatMap((p: unknown) => (typeof p === 'object' && p !== null && 'id' in p && typeof p.id === 'string' ? [p.id] : []))
        }
      }
    }
    throw new Error(`nenhum snapshot para ${clientId}`)
  }
  return { bridge, diego, carla, pinosDe, onPinAudiencesChange }
}

describe('hostBridge: pino só para os escolhidos', () => {
  it('marcar Diego tira o pino da Carla na hora; marcar Carla devolve, sem recarregar', async () => {
    const { bridge, diego, carla, pinosDe, onPinAudiencesChange } = await mesa()
    expect(pinosDe('c-carla')).toEqual(['faca'])
    bridge.setPinAudience('faca', [diego])
    expect(pinosDe('c-carla')).toEqual([])
    expect(pinosDe('c-diego')).toEqual(['faca'])
    expect(onPinAudiencesChange).toHaveBeenLastCalledWith({ faca: [diego] })
    bridge.setPinAudience('faca', [diego, carla])
    expect(pinosDe('c-carla')).toEqual(['faca'])
    bridge.setPinAudience('faca', null)
    expect(onPinAudiencesChange).toHaveBeenLastCalledWith({})
  })

  it('fechar a sala apaga as listas no painel', async () => {
    const { bridge, diego, onPinAudiencesChange } = await mesa()
    bridge.setPinAudience('faca', [diego])
    await bridge.stop()
    expect(onPinAudiencesChange).toHaveBeenLastCalledWith({})
  })
})
