import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Token } from '../types/map'
import { TRAVEL_REQUEST_MIN_INTERVAL_MS, TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS, type HostWorld } from './hostSession'
import { createHostBridge, type HostBridgeDeps } from './hostBridge'
import { setPinPassageFromRequest } from './pinPassageFromRequest'

/**
 * MODO POR SAÍDA, trecho host → ponte → App: o pedido pela saída EXTRA
 * trancada vira linha em "Pedidos"; o "Passar para pede" dela leva o `exitId`
 * até o `setPinPassage` do App, que grava o modo daquela saída — e não o do
 * pino inteiro. Se o `exitId` se perder no caminho, o pino inteiro passaria
 * a pedir.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const GRID = 50
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const POCO = 'cena-poco'

// Ana encostada na encruzilhada (400, 200): pino só atravessa de perto.
const ana: Token = { id: 'ana', characterId: null, name: 'Ana', x: 350, y: 200, size: 1, image: null }

function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino, ...extra }
}

/** Encruzilhada livre: a principal leva à Cripta; a saída extra "Poço", trancada, ao Fundo do Poço. */
function salao(): MapData {
  return {
    ...createEmptyMap('mapa-salao', 'Salão', 2000, 500, GRID),
    tokens: [ana],
    pins: [
      viagem('cruz', 400, 200, 'Encruzilhada', { sceneId: CRIPTA, pinId: 'escada-b' }, {
        passagem: 'livre',
        saidas: [{ id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: POCO, pinId: 'boca-poco' }, passagem: 'trancada' }],
      }),
    ],
  }
}

function cena(mapId: string, nome: string, pinId: string): MapData {
  return { ...createEmptyMap(mapId, nome, 2000, 500, GRID), pins: [viagem(pinId, 1000, 250, 'Chegada', { sceneId: SALAO, pinId: 'cruz' })] }
}

async function mesa(setPinPassage: NonNullable<HostBridgeDeps['setPinPassage']>) {
  const world = (): HostWorld => ({
    open: { sceneId: SALAO, name: 'Salão', map: salao() },
    background: [
      { sceneId: CRIPTA, name: 'Cripta', map: cena('mapa-cripta', 'Cripta', 'escada-b') },
      { sceneId: POCO, name: 'Fundo do Poço', map: cena('mapa-poco', 'Fundo do Poço', 'boca-poco') },
    ],
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyTransfer = vi.fn(() => true)
  const relogio = { agora: 0 }
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer,
    setPinPassage,
    onPlayersChange: vi.fn(),
    now: () => relogio.agora,
  })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  await bridge.start()
  emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const jogadora = bridge.players().find((p) => p.name === 'Ana')
  if (jogadora === undefined) throw new Error('Ana deveria ter entrado')
  bridge.assignToken(jogadora.playerId, 'ana')
  const pedir = (exitId: string) => {
    relogio.agora += TRAVEL_REQUEST_MIN_INTERVAL_MS + TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS
    emit('net:message', { clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'cruz', exitId } })
  }
  const pedidos = () => useToastStore.getState().toasts.filter((t) => t.grupo === 'Pedidos')
  return { pedir, pedidos, applyTransfer }
}

function passarParaPede(toast: { actions?: { label: string; run: () => void }[] } | undefined) {
  const found = toast?.actions?.find((a) => a.label === 'Passar para pede')
  if (found === undefined) throw new Error('sem ação "Passar para pede"')
  return found
}

describe('hostBridge: "Passar para pede" pela saída extra trancada', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    useMapStore.getState().loadMap(salao())
  })

  it('a ponte repassa o exitId da saída ao setPinPassage, e a Ana passa', async () => {
    const setPinPassage = vi.fn()
    const m = await mesa(setPinPassage)
    m.pedir('saida_poco')
    expect(m.pedidos()).toHaveLength(1)
    passarParaPede(m.pedidos()[0]).run()
    expect(setPinPassage).toHaveBeenCalledTimes(1)
    expect(setPinPassage).toHaveBeenCalledWith('cruz', 'pede', undefined, 'saida_poco')
    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
  })

  it('ligada ao setPinPassage do App: só a saída "Poço" passa a pedir; o pino segue livre', async () => {
    const m = await mesa(setPinPassageFromRequest)
    m.pedir('saida_poco')
    passarParaPede(m.pedidos()[0]).run()
    const pino = useMapStore.getState().map.pins.find((p) => p.id === 'cruz')
    expect(pino?.passagem).toBe('livre')
    expect(pino?.saidas?.map((s) => [s.id, s.passagem])).toEqual([['saida_poco', 'pede']])
    expect(m.applyTransfer).toHaveBeenCalledTimes(1)
  })
})
