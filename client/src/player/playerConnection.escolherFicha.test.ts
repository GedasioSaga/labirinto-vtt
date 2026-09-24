/**
 * Quem chega escolhe a própria ficha, no cliente do jogador: `seat.options`
 * vira `state.seatOptions`, `claimSeat` manda o pedido e `seat.claim.state`
 * diz onde ele está. O mapa que chega com a ficha encerra o pedido.
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

function naEspera() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Hugo',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Hugo' })
  socket.receive({ type: 'lobby.waiting' })
  return { connection, socket }
}

const claims = (socket: FakeSocket) => socket.sent.filter((m) => JSON.stringify(m).includes('"seat.claim"'))

describe('escolher a ficha na espera', () => {
  it('seat.options vira state.seatOptions; lista malformada é ignorada e a anterior fica', () => {
    const { connection, socket } = naEspera()
    expect(connection.getState().seatOptions).toBeUndefined()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    expect(connection.getState().seatOptions).toEqual([{ tokenId: 't-kael', name: 'Kael' }])
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: '', name: 'Kael' }] })
    expect(connection.getState().seatOptions).toEqual([{ tokenId: 't-kael', name: 'Kael' }])
  })

  it('claimSeat manda o pedido de uma ficha da lista; fora da lista não manda nada', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    expect(connection.claimSeat('t-lira')).toBe(false)
    expect(claims(socket)).toEqual([])
    expect(connection.claimSeat('t-kael')).toBe(true)
    expect(claims(socket)).toEqual([{ type: 'seat.claim', tokenId: 't-kael' }])
    expect(connection.getState().seatClaim).toEqual({ id: expect.any(Number), phase: 'sent', tokenId: 't-kael', name: 'Kael' })
  })

  it('seat.claim.state muda a fase; estado desconhecido é ignorado', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    connection.claimSeat('t-kael')
    socket.receive({ type: 'seat.claim.state', state: 'pending' })
    expect(connection.getState().seatClaim?.phase).toBe('pending')
    socket.receive({ type: 'seat.claim.state', state: 'talvez' })
    expect(connection.getState().seatClaim?.phase).toBe('pending')
    socket.receive({ type: 'seat.claim.state', state: 'denied' })
    expect(connection.getState().seatClaim).toEqual({ id: expect.any(Number), phase: 'denied', tokenId: 't-kael', name: 'Kael' })
  })

  it('o mapa com a ficha encerra o pedido', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    connection.claimSeat('t-kael')
    socket.receive({ type: 'seat.claim.state', state: 'pending' })
    socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().seatClaim).toBeUndefined()
    // Jogando, não pede ficha.
    expect(connection.claimSeat('t-kael')).toBe(false)
  })

  it('com um pedido esperando o mestre, não manda outro', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }, { tokenId: 't-bruna', name: 'Bruna' }] })
    connection.claimSeat('t-kael')
    socket.receive({ type: 'seat.claim.state', state: 'pending' })
    expect(connection.claimSeat('t-bruna')).toBe(false)
    expect(claims(socket)).toHaveLength(1)
  })
})
