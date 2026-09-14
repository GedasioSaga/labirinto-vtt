import { invoke as realInvoke } from '@tauri-apps/api/core'
import { listen as realListen } from '@tauri-apps/api/event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData } from '../types/map'
import { BROADCAST_THROTTLE_MS, createHostBridge, type HostBridgeDeps } from './hostBridge'

// Garante em tempo de tipo que as funções reais do Tauri cabem nas deps.
const realDeps: Pick<HostBridgeDeps, 'invoke' | 'listen'> = { invoke: realInvoke, listen: realListen }
void realDeps

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function sampleMap(): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
  }
}

function setup(overrides: Partial<HostBridgeDeps> = {}) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const unlisten = vi.fn()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return unlisten
  })
  let map = sampleMap()
  const applyMove = vi.fn((tokenId: string, x: number, y: number) => {
    map = { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)) }
  })
  const onPlayersChange = vi.fn()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove, onPlayersChange, now: () => 0, ...overrides })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, invoke, listen, unlisten, applyMove, onPlayersChange, emit, sent }
}

function joinedPlayerId(sent: unknown[]): string {
  for (const args of sent) {
    const msg: unknown = typeof args === 'object' && args !== null && 'msg' in args ? args.msg : null
    if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'welcome' && 'playerId' in msg && typeof msg.playerId === 'string') {
      return msg.playerId
    }
  }
  throw new Error('sem welcome')
}

describe('hostBridge', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('start chama net_start_room e registra os 2 listeners', async () => {
    const t = setup()
    await expect(t.bridge.start()).resolves.toEqual(ROOM)
    expect(t.invoke).toHaveBeenCalledWith('net_start_room')
    expect(t.listen.mock.calls.map((c) => c[0])).toEqual(['net:message', 'net:peer'])
    expect(t.bridge.room()).toEqual(ROOM)
  })

  it('join via evento envia welcome por net_send e avisa a lista de jogadores', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    expect(t.sent()[0]).toMatchObject({ clientId: 'c1', msg: { type: 'welcome' } })
    expect(t.sent()[1]).toEqual({ clientId: 'c1', msg: { type: 'lobby.waiting' } })
    expect(t.onPlayersChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'Ana', status: 'waiting', connected: true })])
  })

  it('move aceito chama applyMove e manda snapshot', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    const before = t.sent().length
    t.emit('net:message', { clientId: 'c1', msg: { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 240, y: 200 } })
    expect(t.applyMove).toHaveBeenCalledWith('heroi', expect.any(Number), expect.any(Number))
    const after = t.sent().slice(before)
    expect(after[0]).toMatchObject({ clientId: 'c1', msg: { type: 'token.move.accepted', reqId: 'r1' } })
    expect(after[1]).toMatchObject({ clientId: 'c1', msg: { type: 'snapshot' } })
  })

  it('net:peer disconnected marca o jogador como desconectado', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(t.bridge.players()[0]).toMatchObject({ connected: false, clientId: null })
  })

  it('throttle agrega 5 notifyMapChanged em 1 broadcast', async () => {
    vi.useFakeTimers()
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    const before = t.sent().length
    for (let i = 0; i < 5; i += 1) t.bridge.notifyMapChanged()
    expect(t.sent().length).toBe(before)
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
    expect(t.sent().slice(before)).toEqual([expect.objectContaining({ clientId: 'c1', msg: expect.objectContaining({ type: 'snapshot' }) })])
  })

  it('stop desregistra listeners e chama net_stop_room', async () => {
    const t = setup()
    await t.bridge.start()
    await t.bridge.stop()
    expect(t.unlisten).toHaveBeenCalledTimes(2)
    expect(t.invoke).toHaveBeenLastCalledWith('net_stop_room')
    expect(t.bridge.room()).toBeNull()
  })

  it('kick envia kicked e chama net_kick', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    await t.bridge.kick('c1')
    expect(t.sent()).toContainEqual({ clientId: 'c1', msg: { type: 'kicked' } })
    expect(t.invoke).toHaveBeenLastCalledWith('net_kick', { clientId: 'c1' })
    expect(t.bridge.players()).toEqual([])
  })

  it('payload exato do Rust (clientId "17", net:peer com name) do join ao accepted', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:peer', { clientId: '17', event: 'connected', name: 'Ana' })
    t.emit('net:message', { clientId: '17', msg: JSON.stringify({ type: 'join', code: ROOM.code, name: 'Ana' }) })
    expect(t.sent()[0]).toMatchObject({ clientId: '17', msg: { type: 'welcome' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    t.emit('net:message', { clientId: '17', msg: JSON.stringify({ type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 240, y: 200 }) })
    expect(t.sent()).toContainEqual({ clientId: '17', msg: { type: 'token.move.accepted', reqId: 'r1', x: 240, y: 200 } })
    expect(t.applyMove).toHaveBeenCalledWith('heroi', 240, 200)
    t.emit('net:peer', { clientId: '17', event: 'disconnected' })
    expect(t.bridge.players()[0]).toMatchObject({ connected: false })
  })

  it.each([
    ['número', 17],
    ['vazio', ''],
    ['com barra', '../17'],
    ['longo demais', 'x'.repeat(65)],
  ])('clientId inválido (%s) é ignorado', async (_label, clientId) => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.emit('net:peer', { clientId, event: 'disconnected' })
    expect(t.sent()).toEqual([])
    expect(t.bridge.players()).toEqual([])
  })

  it('start concorrente (duplo clique) abre uma sala só e devolve a mesma promise', async () => {
    const t = setup()
    const a = t.bridge.start()
    const b = t.bridge.start()
    expect(b).toBe(a)
    await expect(Promise.all([a, b])).resolves.toEqual([ROOM, ROOM])
    expect(t.invoke.mock.calls.filter((c) => c[0] === 'net_start_room')).toHaveLength(1)
    expect(t.listen).toHaveBeenCalledTimes(2)
  })

  it('stop durante start pendente espera o start e não deixa listener órfão', async () => {
    let resolveRoom: (value: unknown) => void = () => undefined
    const invoke = vi.fn((cmd: string, _args?: unknown) =>
      cmd === 'net_start_room' ? new Promise<unknown>((resolve) => (resolveRoom = resolve)) : Promise.resolve(undefined),
    )
    const t = setup({ invoke })
    const starting = t.bridge.start()
    const stopping = t.bridge.stop()
    resolveRoom(ROOM)
    await starting
    await stopping
    expect(t.unlisten).toHaveBeenCalledTimes(2)
    expect(t.bridge.room()).toBeNull()
    expect(invoke).toHaveBeenLastCalledWith('net_stop_room')
    // Evento que chega depois do stop é ignorado.
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    expect(invoke.mock.calls.filter((c) => c[0] === 'net_send')).toEqual([])
  })

  it('stop cancela broadcast pendente e notifyMapChanged depois do stop não envia', async () => {
    vi.useFakeTimers()
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    const before = t.sent().length
    t.bridge.notifyMapChanged()
    await t.bridge.stop()
    t.bridge.notifyMapChanged()
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS * 4)
    expect(t.sent().length).toBe(before)
  })

  it('unassign do último token manda lobby.waiting pela ponte', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const playerId = joinedPlayerId(t.sent())
    t.bridge.assignToken(playerId, 'heroi')
    const before = t.sent().length
    t.bridge.unassignToken(playerId, 'heroi')
    expect(t.sent().slice(before)).toEqual([{ clientId: 'c1', msg: { type: 'lobby.waiting' } }])
  })

  it('kick espera o net_send do kicked terminar antes de chamar net_kick', async () => {
    const order: string[] = []
    const invoke = vi.fn(async (cmd: string, _args?: unknown) => {
      if (cmd === 'net_start_room') return ROOM
      if (cmd === 'net_send') {
        await new Promise((resolve) => setTimeout(resolve, 5))
        order.push('send-done')
      }
      if (cmd === 'net_kick') order.push('kick')
      return undefined
    })
    const t = setup({ invoke })
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    // Espera os envios do join (welcome, lobby.waiting) saírem antes de medir a ordem do kick.
    await vi.waitFor(() => expect(order).toEqual(['send-done', 'send-done']))
    order.length = 0
    await t.bridge.kick('c1')
    expect(order).toEqual(['send-done', 'kick'])
  })

  it('join inválido de conexão não registrada responde invalid_message e chama net_kick depois', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: '17', msg: { type: 'join', code: ROOM.code, name: '😀'.repeat(17) } })
    await vi.waitFor(() => expect(t.invoke).toHaveBeenCalledWith('net_kick', { clientId: '17' }))
    const cmds = t.invoke.mock.calls.map((c) => c[0])
    expect(cmds.indexOf('net_send')).toBeLessThan(cmds.indexOf('net_kick'))
    expect(t.sent()).toEqual([{ clientId: '17', msg: { type: 'error', reason: 'invalid_message' } }])
  })

  it('mensagem inválida de jogador já registrado não expulsa', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.emit('net:message', { clientId: 'c1', msg: { type: 'lixo' } })
    await Promise.resolve()
    expect(t.invoke.mock.calls.some((c) => c[0] === 'net_kick')).toBe(false)
    expect(t.bridge.players()).toHaveLength(1)
  })

  it('falha de invoke vira toast de erro', async () => {
    const t = setup({ invoke: vi.fn(async () => Promise.reject(new Error('porta ocupada'))) })
    await expect(t.bridge.start()).rejects.toThrow('porta ocupada')
    expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ kind: 'error', text: expect.stringContaining('porta ocupada') })])
  })
})
