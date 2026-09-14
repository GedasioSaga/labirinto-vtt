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
    expect(t.listen.mock.calls.map((c) => c[0])).toEqual(['net:message', 'net:peer', 'net:tunnel'])
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
    expect(t.unlisten).toHaveBeenCalledTimes(3)
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
    expect(t.listen).toHaveBeenCalledTimes(3)
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
    expect(t.unlisten).toHaveBeenCalledTimes(3)
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

  describe('túnel público', () => {
    const LINK = { url: 'https://abc-def.trycloudflare.com', qrSvg: '<svg id="pub"/>' }

    /** net_start_tunnel fica pendente até o teste resolver/rejeitar. */
    function setupTunnel() {
      let settle: { resolve: (v: unknown) => void; reject: (e: unknown) => void } = { resolve: () => undefined, reject: () => undefined }
      const invoke = vi.fn((cmd: string, _args?: unknown): Promise<unknown> => {
        if (cmd === 'net_start_room') return Promise.resolve(ROOM)
        if (cmd === 'net_start_tunnel') return new Promise<unknown>((resolve, reject) => (settle = { resolve, reject }))
        return Promise.resolve(undefined)
      })
      const onTunnelChange = vi.fn()
      const t = setup({ invoke, onTunnelChange })
      // `invoke` explícito: o `t.invoke` de setup é o mock padrão, não o override.
      return { ...t, invoke, onTunnelChange, settle: () => settle, kinds: () => onTunnelChange.mock.calls.map((c) => c[0]) }
    }

    it('downloading → connecting → ready e o invoke confirma sem notificar de novo', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
      const running = t.bridge.startTunnel()
      t.emit('net:tunnel', { state: 'downloading', progress: 0.25 })
      t.emit('net:tunnel', { state: 'downloading', progress: 0.25 })
      t.emit('net:tunnel', { state: 'connecting' })
      t.emit('net:tunnel', { state: 'ready', ...LINK })
      t.settle().resolve(LINK)
      await running
      expect(t.kinds()).toEqual([
        { kind: 'connecting' },
        { kind: 'downloading', progress: 0.25 },
        { kind: 'connecting' },
        { kind: 'ready', ...LINK },
      ])
      expect(t.bridge.tunnel()).toEqual({ kind: 'ready', ...LINK })
      expect(useToastStore.getState().toasts).toEqual([])
    })

    it('closed volta para idle', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      const running = t.bridge.startTunnel()
      t.settle().resolve(LINK)
      await running
      t.emit('net:tunnel', { state: 'closed', reason: 'stopped' })
      expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
      expect(t.onTunnelChange).toHaveBeenLastCalledWith({ kind: 'idle' })
    })

    describe('queda depois de pronto', () => {
      async function setupReady() {
        const t = setupTunnel()
        await t.bridge.start()
        const running = t.bridge.startTunnel()
        t.settle().resolve(LINK)
        await running
        expect(t.bridge.tunnel()).toEqual({ kind: 'ready', ...LINK })
        return t
      }

      it('closed/exited depois de ready vira idle e 1 toast de "caiu"', async () => {
        const t = await setupReady()
        t.emit('net:tunnel', { state: 'closed', reason: 'exited' })
        expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
        expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ kind: 'error', text: expect.stringContaining('caiu') })])
      })

      it('error depois de ready vira kind error e 1 toast', async () => {
        const t = await setupReady()
        t.emit('net:tunnel', { state: 'error', message: 'x' })
        expect(t.bridge.tunnel()).toEqual({ kind: 'error', message: 'x' })
        expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ kind: 'error', text: expect.stringContaining('caiu') })])
      })

      it('closed/exited ainda em connecting não avisa que caiu', async () => {
        const t = setupTunnel()
        await t.bridge.start()
        void t.bridge.startTunnel()
        t.emit('net:tunnel', { state: 'connecting' })
        t.emit('net:tunnel', { state: 'closed', reason: 'exited' })
        expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
        expect(useToastStore.getState().toasts).toEqual([])
      })

      it('closed/stopped depois de ready vira idle sem toast', async () => {
        const t = await setupReady()
        t.emit('net:tunnel', { state: 'closed', reason: 'stopped' })
        expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
        expect(useToastStore.getState().toasts).toEqual([])
      })
    })

    it('rejeição do invoke vira estado error e toast', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      const running = t.bridge.startTunnel()
      t.emit('net:tunnel', { state: 'error', message: 'sem internet' })
      t.settle().reject('sem internet')
      await expect(running).resolves.toBeUndefined()
      expect(t.bridge.tunnel()).toEqual({ kind: 'error', message: 'sem internet' })
      expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ kind: 'error', text: expect.stringContaining('sem internet') })])
    })

    it('resposta inválida de net_start_tunnel vira error', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      const running = t.bridge.startTunnel()
      t.settle().resolve({ url: 'http://inseguro', qrSvg: '<svg/>' })
      await running
      expect(t.bridge.tunnel().kind).toBe('error')
    })

    it('stop da sala zera o túnel e ignora a rejeição tardia', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      const running = t.bridge.startTunnel()
      t.emit('net:tunnel', { state: 'connecting' })
      await t.bridge.stop()
      expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
      t.settle().reject('túnel encerrado')
      await running
      expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
      expect(useToastStore.getState().toasts).toEqual([])
    })

    it('stopTunnel chama net_stop_tunnel e evento atrasado não ressuscita o estado', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      void t.bridge.startTunnel()
      await t.bridge.stopTunnel()
      expect(t.invoke).toHaveBeenLastCalledWith('net_stop_tunnel')
      t.emit('net:tunnel', { state: 'downloading', progress: 0.9 })
      t.emit('net:tunnel', { state: 'ready', ...LINK })
      expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
    })

    it.each([
      ['não-objeto', 'ready'],
      ['estado desconhecido', { state: 'lixo' }],
      ['progress string', { state: 'downloading', progress: '50' }],
      ['progress NaN', { state: 'downloading', progress: Number.NaN }],
      ['ready sem qrSvg', { state: 'ready', url: LINK.url }],
      ['ready com url não-https', { state: 'ready', url: 'javascript:alert(1)', qrSvg: '<svg/>' }],
      ['closed com reason inválido', { state: 'closed', reason: 'x' }],
      ['error sem message', { state: 'error' }],
    ])('payload inválido (%s) é ignorado', async (_label, payload) => {
      const t = setupTunnel()
      await t.bridge.start()
      void t.bridge.startTunnel()
      t.onTunnelChange.mockClear()
      t.emit('net:tunnel', payload)
      expect(t.onTunnelChange).not.toHaveBeenCalled()
      expect(t.bridge.tunnel()).toEqual({ kind: 'connecting' })
    })

    it('duplo clique devolve a mesma promise e chama net_start_tunnel uma vez', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      const a = t.bridge.startTunnel()
      const b = t.bridge.startTunnel()
      expect(b).toBe(a)
      t.settle().resolve(LINK)
      await Promise.all([a, b])
      expect(t.invoke.mock.calls.filter((c) => c[0] === 'net_start_tunnel')).toHaveLength(1)
    })

    it('sem sala aberta não chama net_start_tunnel e avisa', async () => {
      const t = setupTunnel()
      await t.bridge.startTunnel()
      expect(t.invoke).not.toHaveBeenCalled()
      expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
      expect(useToastStore.getState().toasts).toHaveLength(1)
    })

    it('progress fora de 0..1 é limitado', async () => {
      const t = setupTunnel()
      await t.bridge.start()
      void t.bridge.startTunnel()
      t.emit('net:tunnel', { state: 'downloading', progress: 1.7 })
      expect(t.bridge.tunnel()).toEqual({ kind: 'downloading', progress: 1 })
    })
  })

  it('falha de invoke vira toast de erro', async () => {
    const t = setup({ invoke: vi.fn(async () => Promise.reject(new Error('porta ocupada'))) })
    await expect(t.bridge.start()).rejects.toThrow('porta ocupada')
    expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ kind: 'error', text: expect.stringContaining('porta ocupada') })])
  })
})
