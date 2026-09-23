import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addToken, createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, RECONNECT_MAX_DELAY_MS, RESUME_STORAGE_KEY } from './playerConnection'
import type { SocketLike, StorageLike } from './playerConnection'

/**
 * VOLTAR É A MESMA PESSOA, lado do jogador: a Ana abriu a sala noutra aba (ou
 * noutro aparelho com o mesmo resume) e o host avisou esta aba com
 * `session.replaced`. Esta aba para — sem voltar sozinha, o que viraria um
 * cabo de guerra entre as duas — e NÃO apaga o resume, que é o mesmo da aba
 * nova. "Usar aqui" (`reconnect`) traz a sessão de volta para esta aba.
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

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

function jogando() {
  const sockets: FakeSocket[] = []
  const storage = memoryStorage()
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
  const first = sockets[0]
  if (!first) throw new Error('socket não criado')
  first.open()
  first.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
  const map = addToken(createEmptyMap('m1', 'Mapa', 10, 10, 50), { id: 't1', characterId: null, name: 'Lírio', x: 10, y: 10, size: 1, image: null })
  first.receive({ type: 'snapshot', rev: 3, map, vision: [], ownTokens: ['t1'] })
  return { connection, sockets, first, storage }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('playerConnection: a sessão foi para outra aba', () => {
  it('session.replaced para a aba: status replaced, sem voltar sozinha, e o resume fica', () => {
    const { connection, sockets, first, storage } = jogando()
    first.receive({ type: 'session.replaced' })
    expect(connection.getState().status).toBe('replaced')
    expect(connection.getState().reconnecting).toBeUndefined()
    // O host derruba o socket logo depois: nada de reconexão automática.
    first.drop()
    vi.advanceTimersByTime(RECONNECT_MAX_DELAY_MS * 3)
    expect(sockets).toHaveLength(1)
    expect(connection.getState().status).toBe('replaced')
    // O resume é o da aba nova também: apagar aqui tiraria a volta das duas.
    expect(storage.data.get(RESUME_STORAGE_KEY)).toBe(JSON.stringify({ code: 'ABC123', token: 'tok' }))
  })

  it('"Usar aqui" (reconnect) entra de novo com o mesmo resume', () => {
    const { connection, sockets, first } = jogando()
    first.receive({ type: 'session.replaced' })
    first.drop()
    connection.reconnect()
    expect(sockets).toHaveLength(2)
    const second = sockets[1]
    if (!second) throw new Error('sem socket novo')
    second.open()
    expect(second.sent[0]).toEqual({ type: 'join', code: 'ABC123', name: 'Ana', resume: 'tok' })
  })
})
