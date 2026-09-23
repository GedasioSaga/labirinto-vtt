import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addToken, createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, MANUAL_RECONNECT_AFTER_MS, RECONNECT_MAX_DELAY_MS, reconnectDelayMs } from './playerConnection'
import type { SocketLike, StorageLike } from './playerConnection'

/**
 * RECONEXÃO AUTOMÁTICA: Wi-Fi que pisca ou tela bloqueada não trocam mais o
 * mapa por "A conexão caiu" com um botão. O cliente tenta de novo sozinho,
 * com espera crescente até 30 s, e na hora quando a tela acende ou a rede
 * volta (`wake`). O mapa fica (esmaecido pela tela) até a volta.
 */

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
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
  drop(): void {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
  }
}

function memoryStorage(): StorageLike {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

function mapWithToken(x: number, y: number): MapData {
  return addToken(createEmptyMap('m1', 'Mapa', 10, 10, 50), { id: 't1', characterId: null, name: 'Gina', x, y, size: 1, image: null })
}

/** Gina entrou, recebeu a ficha e está jogando no socket 0. */
function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Gina',
    storage: memoryStorage(),
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const first = sockets[0]
  if (!first) throw new Error('socket não criado')
  first.open()
  first.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
  first.receive({ type: 'snapshot', rev: 7, map: mapWithToken(10, 10), vision: [] })
  const last = (): FakeSocket => {
    const socket = sockets.at(-1)
    if (!socket) throw new Error('sem socket')
    return socket
  }
  return { connection, sockets, first, last }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-23T20:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('playerConnection: reconexão automática', () => {
  it('queda no meio do jogo NÃO vira erro: o mapa fica e o estado diz "reconectando"', () => {
    const { connection, first } = jogando()
    first.drop()
    const state = connection.getState()
    expect(state.status).toBe('playing')
    expect(state.error).toBeUndefined()
    expect(state.map?.tokens[0]).toMatchObject({ id: 't1', x: 10, y: 10 })
    expect(state.reconnecting).toMatchObject({ since: Date.now(), manual: false })
  })

  it('tenta de novo sozinho, com o resume, e volta ao normal com o snapshot (mesmo rev de antes)', () => {
    const { connection, sockets, first, last } = jogando()
    first.drop()
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(reconnectDelayMs(1))
    expect(sockets).toHaveLength(2)
    last().open()
    expect(last().sent[0]).toEqual({ type: 'join', code: 'ABC123', name: 'Gina', resume: 'tok' })
    last().receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    // O host não fez broadcast enquanto ela esteve fora: o rev é o MESMO. Tem de valer.
    last().receive({ type: 'snapshot', rev: 7, map: mapWithToken(60, 60), vision: [] })
    const state = connection.getState()
    expect(state.reconnecting).toBeUndefined()
    expect(state.status).toBe('playing')
    expect(state.map?.tokens[0]).toMatchObject({ x: 60, y: 60 })
  })

  it('a espera cresce a cada tentativa que falha e para em 30 s', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7, 8].map(reconnectDelayMs)
    for (let i = 1; i < delays.length; i += 1) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1] ?? 0)
    expect(delays[0]).toBeLessThanOrEqual(1000)
    expect(delays.at(-1)).toBe(RECONNECT_MAX_DELAY_MS)
    expect(RECONNECT_MAX_DELAY_MS).toBe(30_000)

    const { connection, sockets, first, last } = jogando()
    first.drop()
    vi.advanceTimersByTime(reconnectDelayMs(1))
    expect(sockets).toHaveLength(2)
    // A tentativa falha (o Wi-Fi ainda está desligado): a próxima espera mais.
    last().drop()
    expect(connection.getState().reconnecting?.attempt).toBe(1)
    vi.advanceTimersByTime(reconnectDelayMs(2) - 1)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)
  })

  it('"Reconectar" (manual) só aparece depois de 30 s fora', () => {
    const { connection, first } = jogando()
    first.drop()
    vi.advanceTimersByTime(MANUAL_RECONNECT_AFTER_MS - 1)
    expect(connection.getState().reconnecting?.manual).toBe(false)
    vi.advanceTimersByTime(1)
    expect(connection.getState().reconnecting?.manual).toBe(true)
    expect(MANUAL_RECONNECT_AFTER_MS).toBe(30_000)
  })

  it('wake (tela desbloqueou, rede voltou) tenta NA HORA, sem esperar a espera crescente', () => {
    const { sockets, first, last, connection } = jogando()
    first.drop()
    vi.advanceTimersByTime(reconnectDelayMs(1))
    last().drop()
    vi.advanceTimersByTime(reconnectDelayMs(2))
    last().drop()
    const antes = sockets.length
    connection.wake()
    expect(sockets.length).toBe(antes + 1)
  })

  it('wake sem queda não abre socket nenhum', () => {
    const { sockets, connection } = jogando()
    connection.wake()
    expect(sockets).toHaveLength(1)
  })

  it('tentativa que não abre (rede muda) é abandonada e a próxima é agendada', () => {
    const { sockets, first, last } = jogando()
    first.drop()
    vi.advanceTimersByTime(reconnectDelayMs(1))
    const presa = last()
    expect(sockets).toHaveLength(2)
    // Nem abre nem fecha: fica pendurada.
    vi.advanceTimersByTime(60_000)
    expect(presa.closed).toBe(true)
    expect(sockets.length).toBeGreaterThan(2)
  })

  it('a sala acabou enquanto ela estava fora: bad_code encerra a reconexão, sem tentar mais', () => {
    const { connection, sockets, first, last } = jogando()
    first.drop()
    vi.advanceTimersByTime(reconnectDelayMs(1))
    last().open()
    last().receive({ type: 'error', reason: 'bad_code' })
    last().drop()
    const total = sockets.length
    vi.advanceTimersByTime(120_000)
    expect(sockets).toHaveLength(total)
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'bad_code' })
    expect(connection.getState().reconnecting).toBeUndefined()
  })

  it('close() durante a reconexão para tudo', () => {
    const { connection, sockets, first } = jogando()
    first.drop()
    connection.close()
    vi.advanceTimersByTime(120_000)
    expect(sockets).toHaveLength(1)
  })

  it('queda ANTES de entrar na sala (nunca houve welcome) continua sendo connection_lost', () => {
    const sockets: FakeSocket[] = []
    const connection = createPlayerConnection({
      url: 'ws://host/ws',
      code: 'ABC123',
      name: 'Gina',
      storage: null,
      createSocket: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
    })
    sockets[0]?.open()
    sockets[0]?.drop()
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'connection_lost' })
    expect(connection.getState().reconnecting).toBeUndefined()
  })

  it('queda na tela de espera (sem ficha) também reconecta sozinha', () => {
    const sockets: FakeSocket[] = []
    const connection = createPlayerConnection({
      url: 'ws://host/ws',
      code: 'ABC123',
      name: 'Gina',
      storage: memoryStorage(),
      createSocket: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
    })
    sockets[0]?.open()
    sockets[0]?.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok' })
    sockets[0]?.drop()
    expect(connection.getState().status).toBe('waiting')
    expect(connection.getState().reconnecting).toBeDefined()
    vi.advanceTimersByTime(reconnectDelayMs(1))
    expect(sockets).toHaveLength(2)
  })

  it('o pedido de passagem que esperava o mestre morre com a queda (o host também o esquece)', () => {
    const { connection, first } = jogando()
    first.receive({
      type: 'snapshot',
      rev: 8,
      map: { ...mapWithToken(10, 10), pins: [{ id: 'escada', x: 20, y: 20, kind: 'viagem', description: '', image: null }] },
      vision: [],
    })
    expect(connection.requestTravel('escada')).toBe(true)
    expect(connection.getState().travel?.phase).toBe('waiting')
    first.drop()
    expect(connection.getState().travel).toBeUndefined()
  })
})
