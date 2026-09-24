import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * PASSE do lado do mestre: a Fabi (crachá na mochila) passa a catraca sem
 * aviso de pedido; o Caio (sem crachá) vira o aviso "(sem passe)".
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 200, size: 1, image: null, ...extra }
}

function catraca(id: string, description: string, sceneId: string, pinId: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 300, y: 200, kind: 'viagem', description, image: null, destino: { sceneId, pinId }, ...extra }
}

function mundo() {
  const noLab = new Set<string>()
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Saguão',
      map: {
        ...createEmptyMap('mapa-a', 'A', 40, 10, 50),
        tokens: [ficha('ficha-fabi', 'Fabi', 200, { mochila: [{ id: 'i1', nome: 'Crachá' }] }), ficha('ficha-caio', 'Caio', 250)].filter((t) => !noLab.has(t.id)),
        pins: [catraca('catraca-a', 'Catraca', 'cena-b', 'catraca-b', { passagem: 'passe', passe: { item: 'Crachá' } })],
      },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Laboratório',
        map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), pins: [catraca('catraca-b', 'Saída', 'cena-a', 'catraca-a')] },
      },
    ],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    noLab.add(transfer.tokenId)
    return true
  })
  return { world, applyTransfer }
}

describe('hostBridge: passagem com passe', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a Fabi passa sem aviso de pedido; o Caio vira "quer passar … (sem passe)"', async () => {
    const m = mundo()
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
    const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return vi.fn()
    })
    const bridge = createHostBridge({
      invoke,
      listen,
      getMap: () => m.world().open.map,
      getWorld: m.world,
      applyMove: vi.fn(),
      applyDoor: vi.fn(),
      applyTransfer: m.applyTransfer,
      onPlayersChange: vi.fn(),
      now: () => 0,
    })
    const emit = (payload: unknown) => {
      const handler = handlers.get('net:message')
      if (handler === undefined) throw new Error('sem listener de net:message')
      handler({ payload })
    }
    await bridge.start()
    const entra = (clientId: string, name: string, tokenId: string) => {
      emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
      const player = bridge.players().find((p) => p.name === name)
      if (player === undefined) throw new Error(`${name} deveria ter entrado`)
      bridge.assignToken(player.playerId, tokenId)
    }
    entra('c1', 'Fabi', 'ficha-fabi')
    entra('c2', 'Caio', 'ficha-caio')
    emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'catraca-a' } })
    emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'catraca-a' } })

    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
    expect(m.applyTransfer.mock.calls[0]?.[0]).toMatchObject({ tokenId: 'ficha-fabi', toSceneId: 'cena-b' })
    const textos = useToastStore.getState().toasts.map((t) => t.text)
    expect(textos).toContain('Caio quer passar por Catraca → Laboratório (sem passe)')
    expect(textos.filter((texto) => texto.startsWith('Fabi quer passar'))).toEqual([])
  })
})
