/**
 * O cliente da TELA DA MESA é o mesmo `playerConnection` em modo espectador:
 * entra com `role: 'table'`, nunca guarda nem usa resume de jogador e nunca
 * manda nada além do próprio `join` e do `ping`.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap, addToken } from '../lib/mapFactory'
import { RESUME_STORAGE_KEY, TABLE_SCREEN_NAME, createPlayerConnection } from './playerConnection'
import type { SocketLike, StorageLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
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

function telaDaMesa(storage: StorageLike | null) {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: TABLE_SCREEN_NAME,
    role: 'table',
    tableKey: 'chave-do-link',
    storage,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (!socket) throw new Error('socket não criado')
  return { connection, socket }
}

const mapa = addToken(createEmptyMap('m1', '', 10, 10, 50), { id: 't1', characterId: null, name: 'Aria', x: 75, y: 75, size: 1, image: null })

describe('playerConnection no modo tela da mesa', () => {
  it('entra com role table, a chave do link da TV e sem resume, mesmo com resume de jogador guardado na aba', () => {
    const storage = memoryStorage()
    storage.setItem(RESUME_STORAGE_KEY, JSON.stringify({ code: 'ABC123', token: 'tok-da-ana' }))
    const { socket } = telaDaMesa(storage)
    socket.open()
    expect(socket.sent[0]).toEqual({ type: 'join', code: 'ABC123', name: TABLE_SCREEN_NAME, role: 'table', tableKey: 'chave-do-link' })
  })

  it('welcome (mestre antigo) não grava resume: a aba do jogador não é sequestrada', () => {
    const storage = memoryStorage()
    const { socket, connection } = telaDaMesa(storage)
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'r1', name: 'Mesa' })
    expect(storage.data.has(RESUME_STORAGE_KEY)).toBe(false)
    expect(connection.getState().status).toBe('connecting')
  })

  it('espera e depois mostra o mapa, sem ficha própria', () => {
    const { socket, connection } = telaDaMesa(null)
    socket.open()
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().status).toBe('waiting')
    socket.receive({ type: 'snapshot', rev: 1, map: mapa, vision: [], ownTokens: [], concealed: [] })
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().ownTokens).toEqual([])
  })

  it('só olha: não move, não sinaliza, não abre porta, não pede passagem', () => {
    const { socket, connection } = telaDaMesa(null)
    socket.open()
    // Mesmo que o mestre, por engano, dissesse que a ficha é dela.
    socket.receive({ type: 'snapshot', rev: 1, map: mapa, vision: [], ownTokens: ['t1'], concealed: [] })
    const antes = socket.sent.length
    expect(connection.requestMove('t1', 125, 75)).toBe(false)
    expect(connection.sendSignal(10, 10)).toBe(false)
    expect(connection.toggleDoor('w1')).toBe(false)
    expect(connection.requestTravel('p1')).toBe(false)
    expect(connection.setOwnTokenName('t1', 'Outro')).toBe(false)
    expect(socket.sent.length).toBe(antes)
  })
})
