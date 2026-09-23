import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function sampleMap(): MapData {
  return createEmptyMap('m', 'M', 1000, 1000, 40)
}

/** Ponte com `invoke`/`listen` falsos: `emit` entrega o evento como o Rust entregaria. */
function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = sampleMap()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  const entrar = (clientId: string, name: string) => emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
  return { bridge, emit, entrar }
}

describe('hostBridge.connectedPlayerCount — quem cai se o mestre fechar agora', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('sala nunca aberta: zero', () => {
    const t = setup()
    expect(t.bridge.connectedPlayerCount()).toBe(0)
  })

  it('sala aberta e vazia: zero', async () => {
    const t = setup()
    await t.bridge.start()
    expect(t.bridge.room()).toEqual(ROOM)
    expect(t.bridge.connectedPlayerCount()).toBe(0)
  })

  it('7 jogadores conectados: 7', async () => {
    const t = setup()
    await t.bridge.start()
    for (let i = 1; i <= 7; i++) t.entrar(`c${i}`, `Jogador ${i}`)
    expect(t.bridge.players()).toHaveLength(7)
    expect(t.bridge.connectedPlayerCount()).toBe(7)
  })

  it('quem já caiu não conta: fechar não derruba ninguém que não está lá', async () => {
    const t = setup()
    await t.bridge.start()
    t.entrar('c1', 'Ana')
    t.entrar('c2', 'Bia')
    t.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(t.bridge.players()).toHaveLength(2)
    expect(t.bridge.connectedPlayerCount()).toBe(1)
  })

  it('sala fechada pelo mestre: volta a zero', async () => {
    const t = setup()
    await t.bridge.start()
    t.entrar('c1', 'Ana')
    expect(t.bridge.connectedPlayerCount()).toBe(1)
    await t.bridge.stop()
    expect(t.bridge.connectedPlayerCount()).toBe(0)
  })
})
