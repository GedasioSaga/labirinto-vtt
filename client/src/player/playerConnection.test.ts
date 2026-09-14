import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap, addToken } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, PING_INTERVAL_MS, RESUME_STORAGE_KEY } from './playerConnection'
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

  it('snapshot malformado é ignorado', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: { tokens: 'x' }, vision: [] })
    socket.rawReceive('não é json')
    expect(connection.getState().status).toBe('connecting')
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
})
