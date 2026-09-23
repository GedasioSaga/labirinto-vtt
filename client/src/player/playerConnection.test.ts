import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExploration, encodeExploration, isPointExplored, markRings } from '../lib/exploration'
import { createEmptyMap, addToken } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { NAME_MAX_LENGTH } from '../net/protocol'
import { SIGNAL_TTL_MS } from '../lib/signals'
import { LASER_MAX_POINTS_PER_MESSAGE, LASER_TRAIL_MS } from '../lib/laser'
import {
  ARRIVAL_NOTICE_TTL_MS,
  createPlayerConnection,
  DOOR_NOTICE_TTL_MS,
  FREE_PASSAGE_BEAT_MS,
  GATHERED_NOTICE_TTL_MS,
  MOVE_NOTICE_TTL_MS,
  MOVED_NOTICE_TTL_MS,
  PING_INTERVAL_MS,
  RESUME_STORAGE_KEY,
  TRAVEL_NOTICE_TTL_MS,
} from './playerConnection'
import type { SocketLike, StorageLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: unknown[] = []
  closed = false
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }
  close(): void {
    this.closed = true
  }
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.rawReceive(JSON.stringify(message))
  }
  rawReceive(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
  drop(): void {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
  }
}

function field(message: unknown, key: string): unknown {
  return typeof message === 'object' && message !== null ? Reflect.get(message, key) : undefined
}

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

function mapWithToken(x: number, y: number): MapData {
  return addToken(createEmptyMap('m1', 'Mapa', 10, 10, 50), { id: 't1', characterId: null, name: 'Aria', x, y, size: 1, image: null })
}

function setup(storage: StorageLike | null = memoryStorage()) {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Ana',
    storage,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (!socket) throw new Error('socket não criado')
  return { connection, socket, sockets }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createPlayerConnection', () => {
  it('envia join com código e nome ao abrir', () => {
    const { connection, socket } = setup()
    expect(connection.getState().status).toBe('connecting')
    socket.open()
    expect(socket.sent).toEqual([{ type: 'join', code: 'ABC123', name: 'Ana' }])
  })

  it('guarda resumeToken no welcome e o reenvia no próximo join da mesma sala', () => {
    const storage = memoryStorage()
    const first = setup(storage)
    first.socket.open()
    first.socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    expect(first.connection.getState().playerId).toBe('p1')
    expect(storage.data.get(RESUME_STORAGE_KEY)).toBeDefined()

    const second = setup(storage)
    second.socket.open()
    expect(second.socket.sent[0]).toEqual({ type: 'join', code: 'ABC123', name: 'Ana', resume: 'tok' })
  })

  it('funciona sem storage (join sem resume)', () => {
    const { connection, socket } = setup(null)
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    expect(socket.sent[0]).toEqual({ type: 'join', code: 'ABC123', name: 'Ana' })
    expect(connection.getState().status).toBe('waiting')
  })

  it('room.closed: status closed, esquece o resume e a queda do socket logo depois NÃO vira connection_lost', () => {
    const storage = memoryStorage()
    const { connection, socket } = setup(storage)
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'room.closed' })
    expect(connection.getState().status).toBe('closed')
    expect(storage.data.has(RESUME_STORAGE_KEY)).toBe(false)
    socket.drop()
    expect(connection.getState()).toMatchObject({ status: 'closed', error: undefined })
  })

  it('queda de rede real (sem room.closed) continua sendo error connection_lost', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.drop()
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'connection_lost' })
  })

  it('lobby.waiting muda status para waiting', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().status).toBe('waiting')
  })

  it('snapshot com rev antigo ou igual é ignorado; delta com rev maior substitui', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 5, map: mapWithToken(10, 10), vision: [] })
    expect(connection.getState()).toMatchObject({ status: 'playing', rev: 5 })

    socket.receive({ type: 'snapshot', rev: 4, map: mapWithToken(99, 99), vision: [] })
    socket.receive({ type: 'delta', rev: 5, map: mapWithToken(99, 99), vision: [] })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 10, y: 10 })

    socket.receive({ type: 'delta', rev: 6, map: mapWithToken(20, 30), vision: [[{ x: 0, y: 0 }]] })
    expect(connection.getState().rev).toBe(6)
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 20, y: 30 })
  })

  it('A5: concealed do snapshot vai para o estado; malformado descarta a mensagem; ausente vira []', () => {
    const { connection, socket } = setup()
    socket.open()
    const concealed = [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]]
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(1, 1), vision: [], concealed })
    expect(connection.getState().concealed).toEqual(concealed)
    socket.receive({ type: 'snapshot', rev: 2, map: mapWithToken(2, 2), vision: [], concealed: [[{ x: 'a', y: 0 }]] })
    expect(connection.getState().rev).toBe(1)
    socket.receive({ type: 'snapshot', rev: 3, map: mapWithToken(3, 3), vision: [] })
    expect(connection.getState().concealed).toEqual([])
  })

  it('snapshot malformado é ignorado', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: { tokens: 'x' }, vision: [] })
    socket.rawReceive('não é json')
    expect(connection.getState().status).toBe('connecting')
  })

  it('guarda explored decodificado e ownTokens; lobby.waiting e reconnect limpam', () => {
    const { connection, socket } = setup()
    socket.open()
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(exp, [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]])
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [], explored: encodeExploration(exp), ownTokens: ['t1'] })
    const state = connection.getState()
    expect(state.ownTokens).toEqual(['t1'])
    expect(state.explored).toMatchObject({ cell: 10, cols: 40, rows: 40 })
    expect(state.explored && isPointExplored(state.explored, { x: 50, y: 50 })).toBe(true)

    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState()).toMatchObject({ explored: undefined, ownTokens: undefined })

    socket.receive({ type: 'snapshot', rev: 2, map: mapWithToken(10, 10), vision: [], explored: encodeExploration(exp), ownTokens: ['t1'] })
    connection.reconnect()
    expect(connection.getState()).toMatchObject({ explored: undefined, ownTokens: undefined })
  })

  it.each([
    ['explored com bits corrompidos', { explored: { cell: 10, cols: 40, rows: 40, bits: '***' }, ownTokens: [] }],
    ['explored acima do teto', { explored: { cell: 1, cols: 2000, rows: 2000, bits: '' }, ownTokens: [] }],
    ['explored não objeto', { explored: 'x', ownTokens: [] }],
    ['ownTokens com número', { explored: undefined, ownTokens: ['t1', 7] }],
    ['ownTokens não array', { ownTokens: 't1' }],
  ])('snapshot com %s é descartado inteiro', (_label, extra) => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'delta', rev: 2, map: mapWithToken(40, 40), vision: [], ...extra })
    expect(connection.getState()).toMatchObject({ rev: 1, ownTokens: [] })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 10, y: 10 })
  })

  it('requestMove é otimista e rejected desfaz para a posição anterior', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })

    expect(connection.requestMove('t1', 60, 70)).toBe(true)
    const move = socket.sent.at(-1)
    expect(move).toMatchObject({ type: 'token.move', tokenId: 't1', x: 60, y: 70 })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 60, y: 70 })

    const reqId = field(move, 'reqId')
    expect(typeof reqId).toBe('string')
    socket.receive({ type: 'token.move.rejected', reqId, reason: 'not_owner' })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 10, y: 10 })
  })

  it('recusa do movimento diz o motivo por alguns segundos e some sozinha', () => {
    vi.useFakeTimers()
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    connection.requestMove('t1', 60, 70)
    socket.receive({ type: 'token.move.rejected', reqId: field(socket.sent.at(-1), 'reqId'), reason: 'wall' })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 10, y: 10 })
    expect(connection.getState().moveNotice).toMatchObject({ reason: 'wall' })

    // Recusa nova troca o motivo e reinicia o tempo.
    const first = connection.getState().moveNotice?.id
    connection.requestMove('t1', 20, 20)
    socket.receive({ type: 'token.move.rejected', reqId: field(socket.sent.at(-1), 'reqId'), reason: 'outside_floor' })
    expect(connection.getState().moveNotice).toMatchObject({ reason: 'outside_floor' })
    expect(connection.getState().moveNotice?.id).not.toBe(first)
    vi.advanceTimersByTime(MOVE_NOTICE_TTL_MS - 1)
    expect(connection.getState().moveNotice).toMatchObject({ reason: 'outside_floor' })
    vi.advanceTimersByTime(1)
    expect(connection.getState().moveNotice).toBeUndefined()
  })

  it('recusa com motivo desconhecido ou de pedido que não é meu desfaz sem aviso', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'token.move.rejected', reqId: 'm999', reason: 'wall' })
    expect(connection.getState().moveNotice).toBeUndefined()
    connection.requestMove('t1', 60, 70)
    socket.receive({ type: 'token.move.rejected', reqId: field(socket.sent.at(-1), 'reqId'), reason: 'inventado' })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 10, y: 10 })
    expect(connection.getState().moveNotice).toBeUndefined()
  })

  it('aviso de movimento recusado não sobrevive à troca de cena', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    connection.requestMove('t1', 60, 70)
    socket.receive({ type: 'token.move.rejected', reqId: field(socket.sent.at(-1), 'reqId'), reason: 'wall' })
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().moveNotice).toBeUndefined()
  })

  it('accepted fixa a posição do servidor', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    connection.requestMove('t1', 61, 71)
    socket.receive({ type: 'token.move.accepted', reqId: 'm1', x: 50, y: 75 })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 50, y: 75 })
  })

  it('snapshot novo reaplica movimento pendente; depois de accepted não reaplica mais', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    connection.requestMove('t1', 60, 70)

    socket.receive({ type: 'delta', rev: 2, map: mapWithToken(10, 10), vision: [] })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 60, y: 70 })

    socket.receive({ type: 'token.move.accepted', reqId: 'm1', x: 60, y: 70 })
    socket.receive({ type: 'delta', rev: 3, map: mapWithToken(15, 15), vision: [] })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 15, y: 15 })
  })

  it('requestMove de token inexistente ou sem mapa não envia', () => {
    const { connection, socket } = setup()
    socket.open()
    expect(connection.requestMove('t1', 1, 1)).toBe(false)
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    expect(connection.requestMove('nope', 1, 1)).toBe(false)
    expect(socket.sent).toHaveLength(1)
  })

  it('kicked muda status e limpa o resume', () => {
    const storage = memoryStorage()
    const { connection, socket } = setup(storage)
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    socket.receive({ type: 'kicked' })
    socket.drop()
    expect(connection.getState().status).toBe('kicked')
    expect(storage.data.has(RESUME_STORAGE_KEY)).toBe(false)
  })

  it('error com reason kicked vira status kicked e limpa o resume', () => {
    const storage = memoryStorage()
    const { connection, socket } = setup(storage)
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    socket.receive({ type: 'error', reason: 'kicked' })
    socket.drop()
    expect(connection.getState().status).toBe('kicked')
    expect(storage.data.has(RESUME_STORAGE_KEY)).toBe(false)
  })

  it('error bad_code vira status error com o motivo', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'error', reason: 'bad_code' })
    socket.drop()
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'bad_code' })
  })

  it('conexão caída vira connection_lost e reconnect abre socket novo', () => {
    const { connection, socket, sockets } = setup()
    socket.open()
    socket.drop()
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'connection_lost' })
    connection.reconnect()
    expect(sockets).toHaveLength(2)
    expect(connection.getState().status).toBe('connecting')
  })

  it('envia ping a cada 15 s enquanto aberto', () => {
    vi.useFakeTimers()
    const { socket } = setup()
    socket.open()
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2)
    expect(socket.sent.filter((m) => field(m, 'type') === 'ping')).toHaveLength(2)
    socket.drop()
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2)
    expect(socket.sent.filter((m) => field(m, 'type') === 'ping')).toHaveLength(2)
  })

  it('sendSignal só envia jogando e com socket aberto, com o ponto arredondado', () => {
    const { connection, socket } = setup()
    socket.open()
    expect(connection.sendSignal(10, 10)).toBe(false)
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    expect(connection.sendSignal(120.4, 80.6)).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'signal', x: 120, y: 81 })
    expect(connection.sendSignal(Number.NaN, 1)).toBe(false)
    socket.drop()
    expect(connection.sendSignal(1, 1)).toBe(false)
  })

  it('toggleDoor só envia jogando e com socket aberto', () => {
    const { connection, socket } = setup()
    socket.open()
    expect(connection.toggleDoor('w1')).toBe(false)
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    expect(connection.toggleDoor('w1')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'door.toggle', wallId: 'w1' })
    expect(connection.toggleDoor('')).toBe(false)
    socket.drop()
    expect(connection.toggleDoor('w1')).toBe(false)
  })

  it('recusa de porta vira aviso que some sozinho; motivo desconhecido ou fora do jogo é descartado', () => {
    vi.useFakeTimers()
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'w1', reason: 'locked' })
    expect(connection.getState().doorNotice).toBeUndefined()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'door.toggle.rejected', wallId: 'w1', reason: 'inventado' })
    expect(connection.getState().doorNotice).toBeUndefined()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'w1', reason: 'locked' })
    expect(connection.getState().doorNotice).toMatchObject({ reason: 'locked' })
    // Aviso novo substitui o anterior e reinicia o tempo (id diferente).
    const first = connection.getState().doorNotice?.id
    socket.receive({ type: 'door.toggle.rejected', wallId: 'w1', reason: 'far' })
    expect(connection.getState().doorNotice?.id).not.toBe(first)
    vi.advanceTimersByTime(DOOR_NOTICE_TTL_MS - 1)
    expect(connection.getState().doorNotice).toMatchObject({ reason: 'far' })
    vi.advanceTimersByTime(1)
    expect(connection.getState().doorNotice).toBeUndefined()
  })

  it('signal recebido entra no estado com nome e cor e some em 3 s; malformado ou fora do jogo é descartado', () => {
    vi.useFakeTimers()
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'signal', x: 5, y: 5, from: 'Bia', color: '#64b5f6' })
    expect(connection.getState().signals).toBeUndefined()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'signal', x: 5, y: 6, from: 'Bia', color: '#64b5f6' })
    expect(connection.getState().signals).toEqual([expect.objectContaining({ x: 5, y: 6, name: 'Bia', color: '#64b5f6' })])
    const malformed = [
      { type: 'signal', x: '5', y: 6, from: 'Bia', color: '#64b5f6' },
      { type: 'signal', x: 5, y: 6, from: 7, color: '#64b5f6' },
      { type: 'signal', x: 5, y: 6, from: 'x'.repeat(NAME_MAX_LENGTH + 1), color: '#64b5f6' },
      { type: 'signal', x: 5, y: 6, from: 'Bia', color: 'red; background:url(x)' },
    ]
    for (const message of malformed) socket.receive(message)
    expect(connection.getState().signals).toHaveLength(1)
    vi.advanceTimersByTime(SIGNAL_TTL_MS - 1)
    expect(connection.getState().signals).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(connection.getState().signals).toEqual([])
  })

  it('lobby.waiting e reconnect limpam sinais e timers', () => {
    vi.useFakeTimers()
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'signal', x: 5, y: 6, from: 'Bia', color: '#64b5f6' })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().signals).toBeUndefined()
    expect(vi.getTimerCount()).toBe(1) // só o ping

    socket.receive({ type: 'snapshot', rev: 2, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'signal', x: 5, y: 6, from: 'Bia', color: '#64b5f6' })
    connection.reconnect()
    expect(connection.getState().signals).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('laser acende o rastro; off deixa sumir em LASER_TRAIL_MS; malformado ou fora do jogo é descartado', () => {
    vi.useFakeTimers()
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'laser', points: [{ x: 1, y: 2 }] })
    expect(connection.getState().laser).toBeUndefined()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'laser', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] })
    expect(connection.getState().laser).toEqual({ on: true, points: [expect.objectContaining({ x: 1, y: 2 }), expect.objectContaining({ x: 3, y: 4 })] })

    const malformed = [
      { type: 'laser', points: [] },
      { type: 'laser', points: [{ x: '5', y: 6 }] },
      { type: 'laser', points: 'x' },
      { type: 'laser', off: 'sim' },
      { type: 'laser', points: Array.from({ length: LASER_MAX_POINTS_PER_MESSAGE + 1 }, () => ({ x: 1, y: 1 })) },
    ]
    for (const message of malformed) socket.receive(message)
    expect(connection.getState().laser?.points).toHaveLength(2)

    socket.receive({ type: 'laser', off: true })
    expect(connection.getState().laser).toEqual({ on: false, points: [expect.objectContaining({ x: 1, y: 2 }), expect.objectContaining({ x: 3, y: 4 })] })
    vi.advanceTimersByTime(LASER_TRAIL_MS - 1)
    expect(connection.getState().laser).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(connection.getState().laser).toBeUndefined()
    // Off sem rastro na tela não cria estado.
    socket.receive({ type: 'laser', off: true })
    expect(connection.getState().laser).toBeUndefined()
  })

  it('laser ligado e parado guarda só a ponta; lobby.waiting e reconnect limpam rastro e timer', () => {
    vi.useFakeTimers()
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'laser', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] })
    vi.advanceTimersByTime(LASER_TRAIL_MS)
    expect(connection.getState().laser).toEqual({ on: true, points: [expect.objectContaining({ x: 3, y: 4 })] })

    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().laser).toBeUndefined()
    expect(vi.getTimerCount()).toBe(1) // só o ping

    socket.receive({ type: 'snapshot', rev: 2, map: mapWithToken(10, 10), vision: [] })
    socket.receive({ type: 'laser', points: [{ x: 1, y: 2 }] })
    connection.reconnect()
    expect(connection.getState().laser).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('playerConnection: pedido de passagem', () => {
  function jogando() {
    const t = setup()
    t.socket.open()
    t.socket.receive({ type: 'snapshot', rev: 1, map: mapWithToken(100, 100), vision: [], ownTokens: ['t1'], concealed: [] })
    return t
  }

  it('pedir manda só o id do pino e fica "esperando"; um segundo pedido não sai enquanto espera', () => {
    const { connection, socket } = jogando()
    expect(connection.requestTravel('escada')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'pin.travel.request', pinId: 'escada' })
    expect(connection.getState().travel?.phase).toBe('waiting')
    const enviados = socket.sent.length
    expect(connection.requestTravel('escada')).toBe(false)
    expect(socket.sent.length).toBe(enviados)
  })

  it('scene.changed: "chegou", e o movimento ainda sem resposta NÃO é reaplicado no mapa novo', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    connection.requestTravel('escada')
    // Movimento no mapa de antes, sem resposta do mestre.
    connection.requestMove('t1', 300, 300)
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().travel?.phase).toBe('arrived')
    // O mapa novo traz o token no pino par: o (300, 300) do mapa antigo não vale aqui.
    socket.receive({ type: 'snapshot', rev: 2, map: { ...mapWithToken(40, 60), id: 'm2' }, vision: [], ownTokens: ['t1'], concealed: [] })
    const token = connection.getState().map?.tokens.find((t) => t.id === 't1')
    expect([token?.x, token?.y]).toEqual([40, 60])
    // Mais que a recusa: a caixa de pedidos põe vários jogadores na cena nova de uma vez.
    vi.advanceTimersByTime(TRAVEL_NOTICE_TTL_MS)
    expect(connection.getState().travel?.phase).toBe('arrived')
    vi.advanceTimersByTime(ARRIVAL_NOTICE_TTL_MS - TRAVEL_NOTICE_TTL_MS)
    expect(connection.getState().travel).toBeUndefined()
  })

  it('"Você chegou" sai quando o jogador mexe a própria ficha', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed' })
    socket.receive({ type: 'snapshot', rev: 2, map: mapWithToken(100, 100), vision: [], ownTokens: ['t1'], concealed: [] })
    expect(connection.getState().travel?.phase).toBe('arrived')
    expect(connection.requestMove('t1', 60, 70)).toBe(true)
    expect(connection.getState().travel).toBeUndefined()
  })

  it('scene.changed do mestre (Mandar para…): "levado", não "chegou", fica além da recusa e sai no teto', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed', by: 'master' })
    expect(connection.getState().travel?.phase).toBe('moved')
    vi.advanceTimersByTime(TRAVEL_NOTICE_TTL_MS)
    expect(connection.getState().travel?.phase).toBe('moved')
    vi.advanceTimersByTime(MOVED_NOTICE_TTL_MS - TRAVEL_NOTICE_TTL_MS)
    expect(connection.getState().travel).toBeUndefined()
  })

  it('scene.changed da reunião: "reunido", espera o jogador e sai quando ele mexe a ficha', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed', by: 'gather' })
    expect(connection.getState().travel?.phase).toBe('gathered')
    vi.advanceTimersByTime(GATHERED_NOTICE_TTL_MS - 1)
    expect(connection.getState().travel?.phase).toBe('gathered')
    socket.receive({ type: 'snapshot', rev: 2, map: mapWithToken(100, 100), vision: [], ownTokens: ['t1'], concealed: [] })
    expect(connection.requestMove('t1', 60, 70)).toBe(true)
    expect(connection.getState().travel).toBeUndefined()
  })

  it('o aviso da reunião some sozinho depois do teto, sem o jogador mexer', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed', by: 'gather' })
    vi.advanceTimersByTime(GATHERED_NOTICE_TTL_MS)
    expect(connection.getState().travel).toBeUndefined()
  })

  it('"Não" do mestre e recusa do host viram aviso que some; motivo desconhecido é ignorado', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    connection.requestTravel('escada')
    socket.receive({ type: 'pin.travel.denied' })
    expect(connection.getState().travel?.phase).toBe('denied')
    vi.advanceTimersByTime(TRAVEL_NOTICE_TTL_MS)
    expect(connection.getState().travel).toBeUndefined()
    socket.receive({ type: 'pin.travel.rejected', reason: 'o-mapa-secreto' })
    expect(connection.getState().travel).toBeUndefined()
    socket.receive({ type: 'pin.travel.rejected', reason: 'too_soon' })
    expect(connection.getState().travel).toMatchObject({ phase: 'rejected', reason: 'too_soon' })
  })

  describe('pino livre', () => {
    function comPinoLivre() {
      const t = setup()
      t.socket.open()
      const livre = { id: 'escada', x: 50, y: 50, kind: 'viagem' as const, description: '', image: null, passagem: 'livre' as const }
      t.socket.receive({ type: 'snapshot', rev: 1, map: { ...mapWithToken(100, 100), pins: [livre] }, vision: [], ownTokens: ['t1'], concealed: [] })
      return t
    }

    it('"Passando…" na hora, e o pedido sai depois da batida — não no mesmo toque', () => {
      vi.useFakeTimers()
      const { connection, socket } = comPinoLivre()
      const antes = socket.sent.length
      expect(connection.requestTravel('escada')).toBe(true)
      expect(connection.getState().travel).toMatchObject({ phase: 'waiting', direct: true })
      expect(socket.sent.length).toBe(antes)
      // Durante a batida, um segundo toque não empilha outro pedido.
      expect(connection.requestTravel('escada')).toBe(false)
      vi.advanceTimersByTime(FREE_PASSAGE_BEAT_MS)
      expect(socket.sent.slice(antes)).toEqual([{ type: 'pin.travel.request', pinId: 'escada' }])
    })

    it('pino sem modo (mapa antigo) continua pedindo na hora, com "esperando o mestre"', () => {
      const { connection, socket } = jogando()
      connection.requestTravel('escada')
      expect(socket.sent.at(-1)).toEqual({ type: 'pin.travel.request', pinId: 'escada' })
      expect(connection.getState().travel).toMatchObject({ phase: 'waiting', direct: false })
    })

    it('reconectar na batida cancela o pedido: nada sai pelo socket novo', () => {
      vi.useFakeTimers()
      const t = comPinoLivre()
      t.connection.requestTravel('escada')
      t.connection.reconnect()
      // O socket novo abre dentro da batida: se o timer sobrevivesse, o pedido sairia por ele.
      t.sockets[1]?.open()
      vi.advanceTimersByTime(FREE_PASSAGE_BEAT_MS)
      const todos = t.sockets.flatMap((s) => s.sent)
      expect(todos).not.toContainEqual({ type: 'pin.travel.request', pinId: 'escada' })
    })
  })
})
