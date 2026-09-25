/**
 * ESPIAR e CONE DE TELHADO no cliente do jogador: `peekDoor` manda `door.peek`,
 * e o `glimpses` do snapshot vira estado (a tela abre o telhado ali). Campo
 * aditivo: ausente vale sem cone; malformado derruba o snapshot inteiro.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, type SocketLike } from './playerConnection'

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

function conectado() {
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
  return { connection, socket }
}

const CONE = [
  [
    { x: 500, y: 250 },
    { x: 600, y: 250 },
    { x: 600, y: 350 },
  ],
]

function snapshot(rev: number, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [], ...extra }
}

describe('espiar no cliente do jogador', () => {
  it('peekDoor manda door.peek só jogando', () => {
    const { connection, socket } = conectado()
    expect(connection.peekDoor('porta')).toBe(false)
    socket.receive(snapshot(1))
    expect(connection.peekDoor('porta')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'door.peek', wallId: 'porta' })
    expect(connection.peekDoor('')).toBe(false)
  })

  it('glimpses do snapshot viram estado; ausente = sem cone; malformado derruba o snapshot', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { glimpses: CONE }))
    expect(connection.getState().glimpses).toEqual(CONE)
    socket.receive(snapshot(2))
    expect(connection.getState().glimpses).toEqual([])
    socket.receive(snapshot(3, { glimpses: [[{ x: 'a', y: 1 }]] }))
    expect(connection.getState().rev).toBe(2)
  })
})
