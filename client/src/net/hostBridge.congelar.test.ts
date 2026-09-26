import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { BROADCAST_THROTTLE_MS, createHostBridge } from './hostBridge'

/**
 * CONGELAR FICHA com pedido esperando, do lado do mestre: congelar a ficha de
 * quem pediu tira o pedido da espera no envio seguinte — a linha dele some da
 * Caixa de Pedidos (nenhum "Deixar ir" para um pedido que já seria recusado),
 * o mestre lê por quê, e a tela da jogadora sai do "Aguardando o mestre…".
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function mesa() {
  const congeladas = new Set<string>()
  const ficha = (id: string, name: string, x: number): Token => ({ id, characterId: null, name, x, y: 200, size: 1, image: null, ...(congeladas.has(id) ? { congelado: true } : {}) })
  const escada = (id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin => ({ id, x, y, kind: 'viagem', description, image: null, destino: { sceneId, pinId } })
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: {
        ...createEmptyMap('mapa-a', 'A', 40, 10, 50),
        tokens: [ficha('ficha-ana', 'Ana', 350), ficha('ficha-bruno', 'Bruno', 250)],
        pins: [escada('escada-a', 300, 200, 'Escada que desce', 'cena-b', 'escada-b')],
      },
    },
    background: [
      { sceneId: 'cena-b', name: 'Cripta', map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), pins: [escada('escada-b', 1000, 250, 'Escada que sobe', 'cena-a', 'escada-a')] } },
    ],
  })
  return { congeladas, world }
}

async function mesaComPedidos() {
  const m = mesa()
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
    applyTransfer: vi.fn(() => true),
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Ana', 'ficha-ana')
  entra('c2', 'Bruno', 'ficha-bruno')
  useToastStore.setState({ toasts: [] })
  emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  emit({ clientId: 'c2', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  return { ...m, sent, bridge }
}

const textos = () => useToastStore.getState().toasts.map((t) => t.text)

describe('hostBridge: congelar com pedido de passagem esperando', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('o mestre congela a Ana: a linha dela sai da Caixa, ele lê por quê, e a Ana lê a recusa', async () => {
    const { congeladas, sent, bridge } = await mesaComPedidos()
    expect(textos()).toEqual(['Ana quer passar por Escada que desce → Cripta', 'Bruno quer passar por Escada que desce → Cripta'])

    congeladas.add('ficha-ana')
    bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)

    expect(textos()).toEqual(['Bruno quer passar por Escada que desce → Cripta', 'Pedido de Ana retirado: ficha congelada'])
    const aviso = useToastStore.getState().toasts.find((t) => t.text === 'Pedido de Ana retirado: ficha congelada')
    // Não é pergunta: sem "Deixar ir", e some sozinho.
    expect(aviso?.kind).toBe('info')
    expect(aviso?.actions).toBeUndefined()
    expect(sent()).toContainEqual({ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'congelado' } })
    // O selo "pedido" da lista Cenas sai com a linha; o do Bruno fica.
    expect(bridge.players().find((p) => p.name === 'Ana')?.travelPending).toBeUndefined()
    expect(bridge.players().find((p) => p.name === 'Bruno')?.travelPending).toBe(true)
  })
})
