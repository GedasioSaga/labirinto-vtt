/**
 * ESCOLHER FICHAS NO PINO no cliente do jogador: `requestTravel` leva a lista
 * das fichas escolhidas (`tokenIds`) quando há escolha, e sai idêntico ao de
 * antes quando não há — o mestre antigo continua entendendo o pedido.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'
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
  enviados(tipo: string): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === tipo)
  }
}

function pino(id: string): Pin {
  return { id, x: 100, y: 100, kind: 'viagem', description: '', image: null }
}

function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Enzo',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Enzo' })
  const map = { ...createEmptyMap('m1', '', 10, 10, 50), pins: [pino('escotilha')] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('escolher fichas no pino: o pedido do jogador', () => {
  it('com fichas escolhidas, o pedido leva a lista', () => {
    const { connection, socket } = jogando()
    expect(connection.requestTravel('escotilha', undefined, ['enzo', 'rufo'])).toBe(true)
    expect(socket.enviados('pin.travel.request')).toEqual([{ type: 'pin.travel.request', pinId: 'escotilha', tokenIds: ['enzo', 'rufo'] }])
  })

  it('sem escolha (uma ficha só perto do pino), o pedido sai como sempre, sem a lista', () => {
    const { connection, socket } = jogando()
    expect(connection.requestTravel('escotilha')).toBe(true)
    expect(socket.enviados('pin.travel.request')).toEqual([{ type: 'pin.travel.request', pinId: 'escotilha' }])
  })

  it('lista vazia não vira pedido: não há quem passar', () => {
    const { connection, socket } = jogando()
    expect(connection.requestTravel('escotilha', undefined, [])).toBe(false)
    expect(socket.enviados('pin.travel.request')).toEqual([])
    expect(connection.getState().travel).toBeUndefined()
  })
})
