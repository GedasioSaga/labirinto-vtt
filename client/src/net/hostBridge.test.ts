import { invoke as realInvoke } from '@tauri-apps/api/core'
import { listen as realListen } from '@tauri-apps/api/event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useFollowStore } from '../stores/followStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { LASER_MAX_POINTS_PER_MESSAGE, LASER_SEND_INTERVAL_MS } from '../lib/laser'
import { BROADCAST_THROTTLE_MS, createHostBridge, type HostBridgeDeps } from './hostBridge'
import { createLaserGesture } from '../pixi/laserGesture'
import { laserStrokeEnded, useLaserStore } from '../stores/laserStore'

// Garante em tempo de tipo que as funções reais do Tauri cabem nas deps.
const realDeps: Pick<HostBridgeDeps, 'invoke' | 'listen'> = { invoke: realInvoke, listen: realListen }
void realDeps

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function sampleMap(): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    // Porta fechada encostada no herói (40 px abaixo dele): o jogador pode abrir.
    // Fica ABAIXO, fora do caminho do movimento para (240, 200) usado nos testes de move.
    walls: [{ id: 'porta', x1: 180, y1: 240, x2: 220, y2: 240, blocksLight: false, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }],
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
  const applyDoor = vi.fn((wallId: string, open: boolean) => {
    map = { ...map, walls: map.walls.map((w) => (w.id === wallId && w.door ? { ...w, door: { ...w.door, open } } : w)) }
  })
  const onPlayersChange = vi.fn()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove, applyDoor, onPlayersChange, now: () => 0, ...overrides })
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener para ${name}`)
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, invoke, listen, unlisten, applyMove, applyDoor, onPlayersChange, emit, sent }
}

/** Os `party.update` mandados a `clientId`, na ordem (só a `msg` de cada envio). */
function partyUpdatesTo(sent: unknown[], clientId: string): unknown[] {
  const out: unknown[] = []
  for (const args of sent) {
    if (typeof args !== 'object' || args === null || !('clientId' in args) || args.clientId !== clientId || !('msg' in args)) continue
    const msg: unknown = args.msg
    if (typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'party.update') out.push(msg)
  }
  return out
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

  it('porta aceita chama applyDoor e manda snapshot para todos', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    const before = t.sent().length
    t.emit('net:message', { clientId: 'c1', msg: { type: 'door.toggle', wallId: 'porta' } })
    expect(t.applyDoor).toHaveBeenCalledWith('porta', true)
    expect(t.sent().slice(before)).toMatchObject([{ clientId: 'c1', msg: { type: 'snapshot' } }])
  })

  it('porta recusada não chama applyDoor e manda a recusa', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    const before = t.sent().length
    t.emit('net:message', { clientId: 'c1', msg: { type: 'door.toggle', wallId: 'inexistente' } })
    expect(t.applyDoor).not.toHaveBeenCalled()
    expect(t.sent().slice(before)).toMatchObject([
      { clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'inexistente', reason: 'not_visible' } },
    ])
  })

  it('o mestre vê num aviso quem abriu e quem fechou a porta; o aviso novo do mesmo jogador substitui o anterior', async () => {
    let clock = 0
    const t = setup({ now: () => clock })
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    const avisosDePorta = () => useToastStore.getState().toasts.filter((toast) => toast.text.includes('a porta'))
    t.emit('net:message', { clientId: 'c1', msg: { type: 'door.toggle', wallId: 'porta' } })
    expect(avisosDePorta()).toEqual([expect.objectContaining({ kind: 'info', text: 'Ana abriu a porta' })])
    clock += 1000
    t.emit('net:message', { clientId: 'c1', msg: { type: 'door.toggle', wallId: 'porta' } })
    expect(t.applyDoor).toHaveBeenLastCalledWith('porta', false)
    expect(avisosDePorta()).toEqual([expect.objectContaining({ kind: 'info', text: 'Ana fechou a porta' })])
  })

  it('porta recusada (ninguém mexeu nela) não gera aviso ao mestre', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    t.emit('net:message', { clientId: 'c1', msg: { type: 'door.toggle', wallId: 'inexistente' } })
    expect(t.applyDoor).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.filter((toast) => toast.text.includes('a porta'))).toEqual([])
  })

  it('net:peer disconnected marca o jogador como desconectado', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(t.bridge.players()[0]).toMatchObject({ connected: false, clientId: null })
  })

  it('companheiros: entrar e cair mandam party.update aos outros na hora, sem nome de cena', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.emit('net:message', { clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bruno' } })
    const listaDaAna = () => partyUpdatesTo(t.sent(), 'c1').at(-1)
    expect(listaDaAna()).toMatchObject({ type: 'party.update', members: [{ name: 'Bruno', where: 'longe' }] })
    t.emit('net:peer', { clientId: 'c2', event: 'disconnected' })
    expect(listaDaAna()).toMatchObject({ type: 'party.update', members: [{ name: 'Bruno', where: 'fora' }] })
    expect(partyUpdatesTo(t.sent(), 'c2')).toHaveLength(1)
  })

  it('throttle agrega 5 notifyMapChanged em 1 broadcast', async () => {
    vi.useFakeTimers()
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    const before = t.sent().length
    // Cada aviso vem de uma edição de verdade: mapa igual não sai mais (o broadcast só manda o que mudou).
    for (let i = 0; i < 5; i += 1) {
      t.applyMove('heroi', 200 + i * 10, 200)
      t.bridge.notifyMapChanged()
    }
    expect(t.sent().length).toBe(before)
    vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
    expect(t.sent().slice(before)).toEqual([expect.objectContaining({ clientId: 'c1', msg: expect.objectContaining({ type: 'snapshot' }) })])
  })

  it('tela que não chegou (net_send falhou): o broadcast seguinte manda a tela inteira de novo, mesmo sem mudança', async () => {
    vi.useFakeTimers()
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    let falhar = true
    const ehSnapshot = (args: unknown): boolean =>
      typeof args === 'object' && args !== null && 'msg' in args && typeof args.msg === 'object' && args.msg !== null && 'type' in args.msg && args.msg.type === 'snapshot'
    t.invoke.mockImplementation(async (cmd: string, args?: unknown) => {
      if (cmd === 'net_send' && falhar && ehSnapshot(args)) {
        falhar = false
        throw new Error('fila do cliente cheia')
      }
      return cmd === 'net_start_room' ? ROOM : undefined
    })
    t.emit('net:message', { clientId: 'c1', msg: { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 240, y: 200 } })
    await vi.advanceTimersByTimeAsync(0)
    expect(falhar).toBe(false)

    const before = t.sent().length
    t.bridge.notifyMapChanged()
    await vi.advanceTimersByTimeAsync(BROADCAST_THROTTLE_MS)
    expect(t.sent().slice(before)).toEqual([{ clientId: 'c1', msg: expect.objectContaining({ type: 'snapshot' }) }])
  })

  it('stop desregistra listeners e chama net_stop_room', async () => {
    const t = setup()
    await t.bridge.start()
    await t.bridge.stop()
    expect(t.unlisten).toHaveBeenCalledTimes(3)
    expect(t.invoke).toHaveBeenLastCalledWith('net_stop_room')
    expect(t.bridge.room()).toBeNull()
  })

  it('stop avisa room.closed a cada jogador conectado ANTES de net_stop_room', async () => {
    const t = setup()
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.emit('net:message', { clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
    await t.bridge.stop()
    const cmds = t.invoke.mock.calls.map((call) => call[0])
    const closedCalls = t.invoke.mock.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => call[0] === 'net_send' && (call[1] as { msg: { type: string } }).msg.type === 'room.closed')
    expect(closedCalls.map(({ call }) => call[1])).toEqual([
      { clientId: 'c1', msg: { type: 'room.closed' } },
      { clientId: 'c2', msg: { type: 'room.closed' } },
    ])
    const stopIndex = cmds.lastIndexOf('net_stop_room')
    expect(stopIndex).toBeGreaterThan(-1)
    expect(closedCalls.every(({ index }) => index < stopIndex)).toBe(true)
  })

  it('stop sem sala aberta não envia room.closed', async () => {
    const t = setup()
    await t.bridge.stop()
    expect(t.sent()).toEqual([])
    expect(t.invoke).toHaveBeenLastCalledWith('net_stop_room')
  })

  it('"torná-la pública" sem sala aberta: o aviso ensina e fica até o mestre dispensar, sem chamar o túnel', () => {
    vi.useFakeTimers()
    const t = setup()
    void t.bridge.startTunnel()
    const aviso = useToastStore.getState().toasts.find((toast) => toast.text === 'Abra a sala antes de torná-la pública')
    if (aviso === undefined) throw new Error('o mestre deveria ver o aviso')
    expect(aviso.kind).toBe('instrucao')
    // Bem depois do prazo de um erro comum (7 s): continua na tela.
    vi.advanceTimersByTime(60_000)
    expect(useToastStore.getState().toasts.map((toast) => toast.id)).toEqual([aviso.id])
    expect(t.invoke).not.toHaveBeenCalledWith('net_start_tunnel', expect.anything())
    expect(t.bridge.tunnel()).toEqual({ kind: 'idle' })
    useToastStore.getState().dismiss(aviso.id)
    expect(useToastStore.getState().toasts).toEqual([])
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
    // Único envio depois do stop é o aviso de sala encerrada: nenhum snapshot.
    expect(t.sent().slice(before)).toEqual([{ clientId: 'c1', msg: { type: 'room.closed' } }])
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
    // Espera os envios do join (welcome, lobby.waiting e o party.update — a
    // lista de companheiros vai mesmo vazia, para uma tela reconectada trocar
    // a lista antiga) saírem antes de medir a ordem do kick.
    await vi.waitFor(() => expect(order).toEqual(['send-done', 'send-done', 'send-done']))
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

  describe('código errado', () => {
    // No app real o servidor Rust recusa o código errado sem repassar nada ao
    // TS (server.rs, await_join): este join nunca chega aqui. O teste simula a
    // defesa em profundidade da sessão TS — se um dia chegar, a conexão já
    // ocupa vaga de jogador no Rust e precisa ser liberada.
    const joinCodigoErrado = { clientId: '17', msg: { type: 'join', code: 'ZZ9999', name: 'Ana' } }

    it('join recusado com bad_code responde o erro e libera a vaga com net_kick depois', async () => {
      const t = setup()
      await t.bridge.start()
      t.emit('net:message', joinCodigoErrado)
      await vi.waitFor(() => expect(t.invoke).toHaveBeenCalledWith('net_kick', { clientId: '17' }))
      const cmds = t.invoke.mock.calls.map((c) => c[0])
      expect(cmds.indexOf('net_send')).toBeLessThan(cmds.indexOf('net_kick'))
      expect(t.sent()).toEqual([{ clientId: '17', msg: { type: 'error', reason: 'bad_code' } }])
      expect(t.bridge.players()).toEqual([])
    })

    it('a ponte não promete aviso de código errado ao mestre: esse caminho não existe no app real', async () => {
      const t = setup()
      await t.bridge.start()
      t.emit('net:message', joinCodigoErrado)
      await vi.waitFor(() => expect(t.invoke).toHaveBeenCalledWith('net_kick', { clientId: '17' }))
      expect(useToastStore.getState().toasts).toEqual([])
    })
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

  it('sinal aceito chega a onSignal e o eco sai por net_send; o limite por segundo segura o repetido', async () => {
    const onSignal = vi.fn()
    const t = setup({ onSignal })
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    const playerId = joinedPlayerId(t.sent())
    t.bridge.assignToken(playerId, 'heroi')
    const before = t.sent().length
    t.emit('net:message', { clientId: 'c1', msg: { type: 'signal', x: 210, y: 190 } })
    // O mestre lê a jogadora e a ficha; o eco sai com o nome da ficha.
    expect(onSignal).toHaveBeenCalledWith({ playerId, name: 'Ana', tokenName: 'Herói', color: expect.stringMatching(/^#[0-9a-f]{6}$/i), x: 210, y: 190 })
    expect(t.sent().slice(before)).toEqual([{ clientId: 'c1', msg: expect.objectContaining({ type: 'signal', x: 210, y: 190, from: 'Herói' }) }])
    t.emit('net:message', { clientId: 'c1', msg: { type: 'signal', x: 210, y: 190 } })
    expect(onSignal).toHaveBeenCalledTimes(1)
  })

  describe('B3: controles do mestre por jogador', () => {
    const snapshotsFrom = (sent: unknown[]) => sent.filter((args) => JSON.stringify(args).includes('"type":"snapshot"'))

    async function controlsSetup() {
      vi.useFakeTimers()
      const t = setup()
      await t.bridge.start()
      t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
      const playerId = joinedPlayerId(t.sent())
      t.bridge.assignToken(playerId, 'heroi')
      return { ...t, playerId }
    }

    it('Revelar planta e Esconder de novo mandam snapshot na hora', async () => {
      const t = await controlsSetup()
      const before = t.sent().length
      t.bridge.revealPlan(t.playerId)
      expect(snapshotsFrom(t.sent().slice(before))).toHaveLength(1)
      t.bridge.hidePlan(t.playerId)
      expect(snapshotsFrom(t.sent().slice(before))).toHaveLength(2)
    })

    it('slider de raio: vários ajustes viram 1 snapshot pelo throttle e a lista de jogadores traz o raio', async () => {
      const t = await controlsSetup()
      const before = t.sent().length
      for (const radius of [300, 350, 400]) t.bridge.setVisionRadius(t.playerId, radius)
      expect(snapshotsFrom(t.sent().slice(before))).toHaveLength(0)
      expect(t.onPlayersChange).toHaveBeenLastCalledWith([expect.objectContaining({ visionRadius: 400 })])
      vi.advanceTimersByTime(BROADCAST_THROTTLE_MS)
      expect(snapshotsFrom(t.sent().slice(before))).toHaveLength(1)
    })

    it('sem sala os controles não fazem nada', async () => {
      const t = setup()
      t.bridge.revealPlan('p1')
      t.bridge.hidePlan('p1')
      t.bridge.setVisionRadius('p1', 300)
      expect(t.sent()).toEqual([])
      expect(t.bridge.revealPlanFor('s-b', ['p1'])).toBeNull()
      expect(t.bridge.giveGroupView('p1')).toBeNull()
      expect(t.sent()).toEqual([])
    })

    it('Revelar planta para… cena de fundo: devolve quantos e manda snapshot; cena que não existe não manda nada', async () => {
      vi.useFakeTimers()
      const cripta = { ...sampleMap(), id: 'm-cripta', tokens: [] }
      const t = setup({ getWorld: () => ({ open: { sceneId: 's-a', name: 'Salão', map: sampleMap() }, background: [{ sceneId: 's-b', name: 'Cripta', map: cripta }] }) })
      await t.bridge.start()
      t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
      const playerId = joinedPlayerId(t.sent())
      t.bridge.assignToken(playerId, 'heroi')
      const before = t.sent().length
      expect(t.bridge.revealPlanFor('s-nao-existe', [playerId])).toBe(0)
      expect(snapshotsFrom(t.sent().slice(before))).toHaveLength(0)
      expect(t.bridge.revealPlanFor('s-b', [playerId])).toBe(1)
      const snaps = snapshotsFrom(t.sent().slice(before))
      expect(snaps).toHaveLength(1)
      // Ana está no Salão: o snapshot é o do Salão, nada da Cripta vai junto.
      expect(JSON.stringify(snaps)).not.toContain('m-cripta')
      expect(JSON.stringify(snaps)).not.toContain('Cripta')
    })

    it('Dar o que o grupo viu sem colega na cena: 0 e nenhum snapshot', async () => {
      const t = await controlsSetup()
      const before = t.sent().length
      expect(t.bridge.giveGroupView(t.playerId)).toBe(0)
      expect(snapshotsFrom(t.sent().slice(before))).toHaveLength(0)
    })
  })

  describe('laser', () => {
    const laserSends = (sent: unknown[]) => sent.filter((args) => JSON.stringify(args).includes('"type":"laser"'))

    async function laserSetup() {
      vi.useFakeTimers()
      const t = setup()
      await t.bridge.start()
      t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
      t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
      // Bia entra e fica aguardando: sem mapa na tela, não recebe laser.
      t.emit('net:message', { clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
      return { ...t, lasers: () => laserSends(t.sent()) }
    }

    it('throttle: o primeiro ponto sai na hora e os seguintes em lote a cada 50 ms, só para quem joga', async () => {
      const t = await laserSetup()
      t.bridge.laserMove(10.4, 20.6)
      expect(t.lasers()).toEqual([{ clientId: 'c1', msg: { type: 'laser', points: [{ x: 10, y: 21 }] } }])

      t.bridge.laserMove(11, 21)
      t.bridge.laserMove(12, 22)
      vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS - 1)
      expect(t.lasers()).toHaveLength(1)
      vi.advanceTimersByTime(1)
      expect(t.lasers()).toHaveLength(2)
      expect(t.lasers()[1]).toEqual({ clientId: 'c1', msg: { type: 'laser', points: [{ x: 11, y: 21 }, { x: 12, y: 22 }] } })

      // Janela sem ponto novo não envia nada; o próximo ponto depois dela volta a sair na hora.
      vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 3)
      expect(t.lasers()).toHaveLength(2)
      t.bridge.laserMove(13, 23)
      expect(t.lasers()).toHaveLength(3)

      // Mouse rápido: o lote respeita o teto e guarda os pontos mais novos.
      for (let i = 0; i < LASER_MAX_POINTS_PER_MESSAGE + 5; i += 1) t.bridge.laserMove(i, 0)
      vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS)
      const newest = Array.from({ length: LASER_MAX_POINTS_PER_MESSAGE }, (_, i) => ({ x: i + 5, y: 0 }))
      expect(t.lasers()[3]).toEqual({ clientId: 'c1', msg: { type: 'laser', points: newest } })

      t.bridge.laserMove(Number.NaN, 1)
      vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 2)
      expect(t.lasers()).toHaveLength(4)
    })

    it('laserOff manda off uma vez, descarta o lote pendente e não deixa timer enviando depois', async () => {
      const t = await laserSetup()
      t.bridge.laserOff()
      expect(t.lasers()).toEqual([])

      t.bridge.laserMove(10, 10)
      t.bridge.laserMove(20, 20)
      t.bridge.laserOff()
      expect(t.lasers()).toEqual([
        { clientId: 'c1', msg: { type: 'laser', points: [{ x: 10, y: 10 }] } },
        { clientId: 'c1', msg: { type: 'laser', off: true } },
      ])
      vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 4)
      t.bridge.laserOff()
      expect(t.lasers()).toHaveLength(2)

      // Laser ligado de novo depois do off volta a sair na hora.
      t.bridge.laserMove(30, 30)
      expect(t.lasers()).toHaveLength(3)
    })

    it('fechar a sala cancela o lote pendente; sem sala laserMove e laserOff não fazem nada', async () => {
      const t = await laserSetup()
      t.bridge.laserMove(10, 10)
      t.bridge.laserMove(20, 20)
      await t.bridge.stop()
      vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 4)
      t.bridge.laserMove(30, 30)
      t.bridge.laserOff()
      expect(t.lasers()).toHaveLength(1)
    })

    describe('gesto do canvas (mesma fiação do PixiCanvas e do App)', () => {
      async function gestureSetup() {
        useLaserStore.setState({ held: false, toggled: false, drawing: false, trail: [] })
        const t = await laserSetup()
        const gesture = createLaserGesture((p) => t.bridge.laserMove(p.x, p.y))
        const unsubscribe = useLaserStore.subscribe((state, previous) => {
          if (laserStrokeEnded(previous, state)) t.bridge.laserOff()
        })
        return { ...t, gesture, unsubscribe }
      }

      it('armado e movendo sem botão não envia nada; botão direito/meio também não', async () => {
        const t = await gestureSetup()
        useLaserStore.getState().setHeld(true)
        for (let i = 0; i < 5; i += 1) expect(t.gesture.pointerMove({ x: 10 * i, y: 5 })).toBe(false)
        vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 3)
        expect(t.gesture.pointerDown(2, { x: 1, y: 1 })).toBe(false)
        expect(t.gesture.pointerDown(1, { x: 1, y: 1 })).toBe(false)
        expect(t.gesture.pointerMove({ x: 2, y: 2 })).toBe(false)
        expect(t.gesture.pointerUp()).toBe(false)
        vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 3)
        expect(t.lasers()).toEqual([])
        expect(useLaserStore.getState().trail).toEqual([])
        t.unsubscribe()
      })

      it('botão esquerdo pressionado e movendo envia pontos; soltar envia off uma única vez', async () => {
        const t = await gestureSetup()
        useLaserStore.getState().setToggled(true)
        expect(t.gesture.pointerDown(0, { x: 10, y: 10 })).toBe(true)
        expect(t.gesture.pointerMove({ x: 20, y: 20 })).toBe(true)
        expect(t.gesture.pointerMove({ x: 30, y: 30 })).toBe(true)
        vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS)
        expect(t.lasers()).toEqual([
          { clientId: 'c1', msg: { type: 'laser', points: [{ x: 10, y: 10 }] } },
          { clientId: 'c1', msg: { type: 'laser', points: [{ x: 20, y: 20 }, { x: 30, y: 30 }] } },
        ])

        expect(t.gesture.pointerUp()).toBe(true)
        expect(t.gesture.pointerUp()).toBe(false)
        useLaserStore.getState().setToggled(false)
        vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 4)
        const offs = t.lasers().filter((args) => JSON.stringify(args).includes('"off":true'))
        expect(offs).toHaveLength(1)
        expect(t.lasers()).toHaveLength(3)
        t.unsubscribe()
      })

      it('desarmar no meio do traço envia off uma vez e o resto do gesto continua do laser, sem enviar', async () => {
        const t = await gestureSetup()
        useLaserStore.getState().setHeld(true)
        t.gesture.pointerDown(0, { x: 10, y: 10 })
        useLaserStore.getState().setHeld(false)
        expect(t.lasers()).toHaveLength(2)
        // O move e o up ainda são do laser (a ferramenta não recebe um up solto), mas nada sai.
        expect(t.gesture.pointerMove({ x: 50, y: 50 })).toBe(true)
        expect(t.gesture.pointerUp()).toBe(true)
        vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 4)
        expect(t.lasers()).toEqual([
          { clientId: 'c1', msg: { type: 'laser', points: [{ x: 10, y: 10 }] } },
          { clientId: 'c1', msg: { type: 'laser', off: true } },
        ])

        // Perder o foco da janela no meio do traço também fecha com um off.
        useLaserStore.getState().setHeld(true)
        t.gesture.pointerDown(0, { x: 60, y: 60 })
        t.gesture.cancel()
        t.gesture.cancel()
        expect(t.gesture.pointerMove({ x: 70, y: 70 })).toBe(false)
        vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS * 4)
        expect(t.lasers().filter((args) => JSON.stringify(args).includes('"off":true'))).toHaveLength(2)
        expect(t.lasers()).toHaveLength(4)
        t.unsubscribe()
      })
    })
  })
})

describe('hostBridge: pedido de passagem pelo pino de viagem', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    useFollowStore.setState({ playerId: null })
  })

  /** Salão (aberto) e Cripta (de fundo), com a escada ligada em mão dupla. `naCripta` diz onde está o herói. */
  function aventura() {
    const estado = { naCripta: false }
    const heroi = (x: number, y: number): Token => ({ id: 'heroi', characterId: null, name: 'Herói', x, y, size: 1, image: null })
    const escada = (id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin => ({
      id,
      x,
      y,
      kind: 'viagem',
      description,
      image: null,
      destino: { sceneId, pinId },
    })
    const world = (): HostWorld => ({
      open: {
        sceneId: 'cena-a',
        name: 'Salão',
        // O herói encostado na escada: pino só atravessa de perto.
        map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: estado.naCripta ? [] : [heroi(250, 200)], pins: [escada('escada-a', 300, 200, 'Escada que desce', 'cena-b', 'escada-b')] },
      },
      background: [
        {
          sceneId: 'cena-b',
          name: 'Cripta',
          map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), tokens: estado.naCripta ? [heroi(1025, 275)] : [], pins: [escada('escada-b', 1000, 250, 'Escada que sobe', 'cena-a', 'escada-a')] },
        },
      ],
    })
    const applyTransfer = vi.fn((_transfer: AppliedTransfer) => {
      estado.naCripta = true
      return true
    })
    const onGoToScene = vi.fn()
    return { world, applyTransfer, onGoToScene }
  }

  async function pedido() {
    const a = aventura()
    const t = setup({ getWorld: a.world, applyTransfer: a.applyTransfer, onGoToScene: a.onGoToScene })
    await t.bridge.start()
    t.emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
    t.bridge.assignToken(joinedPlayerId(t.sent()), 'heroi')
    t.emit('net:message', { clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
    const aviso = useToastStore.getState().toasts.find((toast) => toast.text === 'Ana quer passar por Escada que desce → Cripta')
    if (aviso === undefined) throw new Error('o mestre deveria ver o pedido')
    return { ...a, t, aviso }
  }

  it('o pedido vira um aviso que ESPERA o mestre, com "Deixar ir" e "Não"', async () => {
    const { aviso } = await pedido()
    expect(aviso.kind).toBe('instrucao')
    expect(aviso.actions?.map((action) => action.label)).toEqual(['Deixar ir', 'Não'])
  })

  it('"Deixar ir": move o token, manda scene.changed ANTES do snapshot da Cripta e avisa "Ana entrou em Cripta" com "Ir lá"', async () => {
    const { t, aviso, applyTransfer, onGoToScene } = await pedido()
    const antes = t.sent().length
    aviso.actions?.[0]?.run()
    // Casa livre ao lado do par, não a casa dele (chegada-em-casa-livre).
    expect(applyTransfer).toHaveBeenCalledWith(expect.objectContaining({ tokenId: 'heroi', fromSceneId: 'cena-a', toSceneId: 'cena-b', x: 975, y: 275 }))
    const depois = t.sent().slice(antes)
    expect(depois[0]).toEqual({ clientId: 'c1', msg: { type: 'scene.changed' } })
    expect(depois[1]).toMatchObject({ clientId: 'c1', msg: { type: 'snapshot', map: { id: 'mapa-b' } } })
    const toasts = useToastStore.getState().toasts
    expect(toasts.some((toast) => toast.id === aviso.id)).toBe(false)
    const chegada = toasts.find((toast) => toast.text === 'Ana entrou em Cripta')
    expect(chegada?.actions?.map((action) => action.label)).toEqual(['Ir lá'])
    chegada?.actions?.[0]?.run()
    // PISOS: o quarto argumento é o piso de chegada (o par está no térreo).
    expect(onGoToScene).toHaveBeenCalledWith('cena-b', 975, 275, 0)
    expect(t.bridge.players()[0]?.sceneName).toBe('Cripta')
  })

  it('"Ir lá" na chegada de OUTRO jogador desliga o seguir; na de quem já é seguido, mantém', async () => {
    const { t, aviso, onGoToScene } = await pedido()
    const ana = joinedPlayerId(t.sent())
    aviso.actions?.[0]?.run()
    const chegada = useToastStore.getState().toasts.find((toast) => toast.text === 'Ana entrou em Cripta')
    const irLa = chegada?.actions?.[0]
    if (irLa === undefined) throw new Error('a chegada deveria ter "Ir lá"')

    // Seguindo Bruno, o mestre vai ver Ana: o seguir não pode arrastá-lo de volta.
    useFollowStore.setState({ playerId: 'bruno' })
    irLa.run()
    expect(useFollowStore.getState().playerId).toBeNull()
    expect(onGoToScene).toHaveBeenLastCalledWith('cena-b', 1025, 275)

    // Seguindo a própria Ana: ir até ela é o que o seguir já faz, então continua seguindo.
    useFollowStore.setState({ playerId: ana })
    irLa.run()
    expect(useFollowStore.getState().playerId).toBe(ana)
    expect(onGoToScene).toHaveBeenCalledTimes(2)
  })

  it('"Não" e o × do aviso respondem pin.travel.denied, sem mover nada', async () => {
    const { t, aviso, applyTransfer } = await pedido()
    const antes = t.sent().length
    aviso.onDismiss?.()
    expect(t.sent().slice(antes)).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.denied' } }])
    expect(applyTransfer).not.toHaveBeenCalled()
  })

  it('o jogador sai da sala com o pedido pendente: o aviso do mestre some', async () => {
    const { t, aviso } = await pedido()
    t.emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    expect(useToastStore.getState().toasts.some((toast) => toast.id === aviso.id)).toBe(false)
  })

  it('a transferência que falha no editor vira recusa, nunca "Você chegou"', async () => {
    const { t, aviso, applyTransfer } = await pedido()
    applyTransfer.mockImplementation(() => false)
    const antes = t.sent().length
    aviso.actions?.[0]?.run()
    expect(t.sent().slice(antes)).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }])
  })
})
