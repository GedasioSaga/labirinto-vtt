import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

/**
 * ESCOLHER FICHAS NO PINO, lado do jogador: `requestTravel` leva a lista de
 * fichas escolhidas no cartão. Sem lista (uma ficha só perto do pino), o
 * pedido sai idêntico ao de antes — o mestre antigo continua entendendo.
 */

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
  if (socket === undefined) throw new Error('socket não criado')
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Enzo' })
  const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 100, size: 1, image: null })
  const pino: Pin = { id: 'escotilha', x: 200, y: 100, kind: 'viagem', description: 'Escotilha', image: null }
  const map = { ...createEmptyMap('m1', 'Mapa', 10, 10, 50), tokens: [ficha('enzo', 125), ficha('rufo', 175)], pins: [pino] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: ['enzo', 'rufo'] })
  const pedidos = () => socket.sent.filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null && Reflect.get(m, 'type') === 'pin.travel.request')
  return { connection, pedidos }
}

describe('playerConnection: pedido de passagem com as fichas escolhidas', () => {
  it('com a lista, o pedido leva tokenIds na ordem', () => {
    const { connection, pedidos } = jogando()
    expect(connection.requestTravel('escotilha', undefined, ['enzo'])).toBe(true)
    expect(pedidos()).toEqual([{ type: 'pin.travel.request', pinId: 'escotilha', tokenIds: ['enzo'] }])
  })

  it('com saída de encruzilhada e lista, os dois vão juntos', () => {
    const { connection, pedidos } = jogando()
    expect(connection.requestTravel('escotilha', 'beiral', ['rufo', 'enzo'])).toBe(true)
    expect(pedidos()).toEqual([{ type: 'pin.travel.request', pinId: 'escotilha', exitId: 'beiral', tokenIds: ['rufo', 'enzo'] }])
  })

  it('sem lista (ou lista vazia), o pedido de sempre, sem o campo', () => {
    const a = jogando()
    expect(a.connection.requestTravel('escotilha')).toBe(true)
    expect(a.pedidos()).toEqual([{ type: 'pin.travel.request', pinId: 'escotilha' }])
    const b = jogando()
    expect(b.connection.requestTravel('escotilha', undefined, [])).toBe(true)
    expect(b.pedidos()).toEqual([{ type: 'pin.travel.request', pinId: 'escotilha' }])
  })
})
