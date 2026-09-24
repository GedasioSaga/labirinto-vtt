/**
 * LEITURA DA PISTA no cliente do jogador: `markPinRead` manda `pin.read` só
 * com o id, só jogando e só para pino que está no mapa dele.
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
    code: 'CR1ME7',
    name: 'Gabi',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' })
  return { connection, socket }
}

const MAPA = { ...createEmptyMap('m1', '', 10, 10, 50), pins: [{ id: 'bilhete', x: 100, y: 100, kind: 'interrogacao', description: 'Bilhete', image: null }] }

describe('markPinRead', () => {
  it('jogando: manda pin.read com o id do pino', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: [], concealed: [] })
    expect(connection.getState().status).toBe('playing')
    expect(connection.markPinRead('bilhete')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'pin.read', pinId: 'bilhete' })
  })

  it('pino que não está no mapa dele, ou fora do jogo: não manda nada', () => {
    const { connection, socket } = conectado()
    expect(connection.markPinRead('bilhete')).toBe(false)
    socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: [], concealed: [] })
    const enviadas = socket.sent.length
    expect(connection.markPinRead('inventado')).toBe(false)
    expect(socket.sent.length).toBe(enviadas)
  })
})
