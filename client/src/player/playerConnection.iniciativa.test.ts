/**
 * INICIATIVA no cliente do jogador: `turn` do snapshot vira `state.turn`.
 * Ausente = ninguém que ele enxergue está na vez. Malformado derruba a
 * mensagem inteira, como os outros campos aditivos.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
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

const LANTERNA: Token = { id: 'tok-lanterna', characterId: null, name: 'Lanterna', x: 100, y: 100, size: 1, image: null }
const GOBLIN: Token = { id: 'tok-goblin', characterId: null, name: 'Goblin', x: 200, y: 100, size: 1, image: null }

function snapshot(rev: number, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map: { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [LANTERNA, GOBLIN] }, vision: [], ownTokens: [LANTERNA.id], concealed: [], ...extra }
}

describe('vez no cliente do jogador', () => {
  it('guarda de quem é a vez, e a vez sai quando o snapshot seguinte não traz o campo', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { turn: LANTERNA.id }))
    expect(connection.getState().turn).toBe(LANTERNA.id)
    socket.receive(snapshot(2, { turn: GOBLIN.id }))
    expect(connection.getState().turn).toBe(GOBLIN.id)
    socket.receive(snapshot(3))
    expect(connection.getState().turn).toBeUndefined()
  })

  it('vez malformada derruba o snapshot inteiro', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { turn: LANTERNA.id }))
    socket.receive(snapshot(2, { turn: 42 }))
    socket.receive(snapshot(3, { turn: 'x'.repeat(200) }))
    expect(connection.getState().rev).toBe(1)
    expect(connection.getState().turn).toBe(LANTERNA.id)
  })

  it('vez de ficha que não veio no mapa não vale (nada a destacar)', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { turn: 'tok-que-nao-veio' }))
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().turn).toBeUndefined()
  })

  it('voltar ao lobby limpa a vez', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { turn: LANTERNA.id }))
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().turn).toBeUndefined()
  })
})
