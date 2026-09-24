/**
 * CHAVE ABRE PORTA no pino trancado, no cliente do jogador: com a chave (o
 * `chave` que o host só manda a quem a carrega), a passagem é direta — o
 * aviso diz "Passando…", nunca "Aguardando o mestre" —, e o pedido leva só
 * o pino: o host confere a mochila.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'
import { createPlayerConnection, FREE_PASSAGE_BEAT_MS, type SocketLike } from './playerConnection'

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

const portao: Pin = { id: 'portao', x: 400, y: 200, kind: 'viagem', description: 'Portão', image: null, passagem: 'trancada' }

function jogando(pin: Pin) {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Diego',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Diego' })
  socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', '', 40, 10, 50), pins: [pin] }, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('pino trancado com a chave no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('com a chave: "Passando…" (direto) e, depois da pausa, o pedido só com o pino', () => {
    const { connection, socket } = jogando({ ...portao, chave: 'Chave do Escudo' })
    const antes = socket.sent.length
    expect(connection.requestTravel('portao')).toBe(true)
    expect(connection.getState().travel).toMatchObject({ phase: 'waiting', direct: true })
    expect(socket.sent.length).toBe(antes)
    vi.advanceTimersByTime(FREE_PASSAGE_BEAT_MS)
    expect(socket.sent.at(-1)).toEqual({ type: 'pin.travel.request', pinId: 'portao' })
  })

  it('sem a chave, o pino trancado não é passagem direta', () => {
    const { connection } = jogando(portao)
    expect(connection.requestTravel('portao')).toBe(true)
    expect(connection.getState().travel).toMatchObject({ phase: 'waiting', direct: false })
  })
})
