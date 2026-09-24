import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * PAINEL PISTAS, lado do integrador: o App recebe quem recebeu e quem leu
 * cada pino (`onPinCluesChange`). A leitura da Gabi chega NA HORA — sem
 * esperar o próximo broadcast — e fechar a sala apaga o painel.
 */

const ROOM = { code: 'CR1ME7', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null })
const BILHETE: Pin = { id: 'bilhete', x: 300, y: 200, kind: 'interrogacao', description: 'Bilhete', image: null }
const MAPA: MapData = { ...createEmptyMap('m', 'Andar de cima', 40, 10, 50), tokens: [ficha('ficha-gabi', 275), ficha('ficha-ana', 1900)], pins: [BILHETE] }

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onPinCluesChange = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => MAPA,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    onPinCluesChange,
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
  const gabi = entra('c-gabi', 'Gabi', 'ficha-gabi')
  entra('c-ana', 'Ana', 'ficha-ana')
  return { bridge, emit, gabi, onPinCluesChange }
}

describe('hostBridge: painel Pistas', () => {
  it('o pino que saiu para a Gabi aparece como recebido; a Ana, longe, não', async () => {
    const { gabi, onPinCluesChange } = await mesa()
    expect(onPinCluesChange).toHaveBeenLastCalledWith({ bilhete: { received: [gabi], read: [] } })
  })

  it('a Gabi abre o cartão e a bolinha enche na hora, sem broadcast novo', async () => {
    const { emit, gabi, onPinCluesChange } = await mesa()
    const chamadasAntes = onPinCluesChange.mock.calls.length
    emit({ clientId: 'c-gabi', msg: { type: 'pin.read', pinId: 'bilhete' } })
    expect(onPinCluesChange).toHaveBeenLastCalledWith({ bilhete: { received: [gabi], read: [gabi] } })
    expect(onPinCluesChange.mock.calls.length).toBe(chamadasAntes + 1)
    // Ler de novo não muda nada: o painel não redesenha à toa.
    emit({ clientId: 'c-gabi', msg: { type: 'pin.read', pinId: 'bilhete' } })
    expect(onPinCluesChange.mock.calls.length).toBe(chamadasAntes + 1)
  })

  it('fechar a sala apaga o painel', async () => {
    const { bridge, onPinCluesChange } = await mesa()
    await bridge.stop()
    expect(onPinCluesChange).toHaveBeenLastCalledWith({})
  })
})
