/**
 * MOVIMENTO CONTADO no cliente do jogador: soltar a ficha sobre outra, com
 * "Fichas ocupam espaço", volta a ficha e mostra 'Lugar ocupado' por um tempo.
 * Outras recusas continuam só voltando a ficha, como sempre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { createPlayerConnection, MOVE_NOTICE_TTL_MS, type SocketLike } from './playerConnection'

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

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Ana',
    storage: null,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (!socket) throw new Error('socket não criado')
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
  const map = { ...createEmptyMap('m1', '', 20, 20, 50), tokens: [ficha('heroi', 125, 125), ficha('guarda', 325, 125)] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: ['heroi'], concealed: [] })
  return { connection, socket }
}

function lastReqId(socket: FakeSocket): string {
  const last = socket.sent[socket.sent.length - 1]
  if (typeof last !== 'object' || last === null || !('reqId' in last) || typeof last.reqId !== 'string') throw new Error('sem pedido')
  return last.reqId
}

describe('Lugar ocupado no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('recusa occupied volta a ficha e mostra o aviso, que some sozinho', () => {
    const { connection, socket } = jogando()
    connection.requestMove('heroi', 325, 125)
    socket.receive({ type: 'token.move.rejected', reqId: lastReqId(socket), reason: 'occupied' })

    const state = connection.getState()
    expect(state.map?.tokens.find((t) => t.id === 'heroi')).toMatchObject({ x: 125, y: 125 })
    expect(state.moveNotice).toMatchObject({ reason: 'occupied' })

    vi.advanceTimersByTime(MOVE_NOTICE_TTL_MS)
    expect(connection.getState().moveNotice).toBeUndefined()
  })

  it('outra recusa (parede) só volta a ficha, sem aviso de lugar ocupado', () => {
    const { connection, socket } = jogando()
    connection.requestMove('heroi', 225, 125)
    socket.receive({ type: 'token.move.rejected', reqId: lastReqId(socket), reason: 'wall' })
    expect(connection.getState().moveNotice).toBeUndefined()
    expect(connection.getState().map?.tokens.find((t) => t.id === 'heroi')).toMatchObject({ x: 125, y: 125 })
  })

  it('tentar de novo repete o aviso com id novo (a animação recomeça)', () => {
    const { connection, socket } = jogando()
    connection.requestMove('heroi', 325, 125)
    socket.receive({ type: 'token.move.rejected', reqId: lastReqId(socket), reason: 'occupied' })
    const first = connection.getState().moveNotice?.id
    connection.requestMove('heroi', 325, 125)
    socket.receive({ type: 'token.move.rejected', reqId: lastReqId(socket), reason: 'occupied' })
    expect(connection.getState().moveNotice?.id).not.toBe(first)
  })
})
