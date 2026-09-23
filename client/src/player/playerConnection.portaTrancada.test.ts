/**
 * PORTA TRANCADA VIRA PEDIDO no cliente do jogador: o "Trancada" guarda qual
 * porta foi, e dele sai o pedido (Bater, Forçar, Usar chave) ao mestre. A
 * resposta do mestre vira aviso: "O mestre abriu" ou "O mestre disse não".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, DOOR_NOTICE_TTL_MS, type SocketLike } from './playerConnection'

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
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('porta trancada no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('"Trancada" guarda a porta e NÃO some sozinho: o jogador precisa de tempo para escolher', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' })
    expect(connection.getState().doorNotice).toMatchObject({ reason: 'locked', wallId: 'escritorio' })
    vi.advanceTimersByTime(DOOR_NOTICE_TTL_MS * 10)
    expect(connection.getState().doorNotice).toMatchObject({ reason: 'locked', wallId: 'escritorio' })
    connection.dismissDoorNotice()
    expect(connection.getState().doorNotice).toBeUndefined()
  })

  it('"Longe" continua sumindo sozinho', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'far' })
    vi.advanceTimersByTime(DOOR_NOTICE_TTL_MS + 1)
    expect(connection.getState().doorNotice).toBeUndefined()
  })

  it('Forçar: manda o pedido, troca o "Trancada" por "Pedido enviado"', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' })
    expect(connection.requestDoor('escritorio', 'force')).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'door.request', wallId: 'escritorio', how: 'force' })
    expect(connection.getState().doorNotice).toBeUndefined()
    expect(connection.getState().doorRequest).toMatchObject({ phase: 'sent' })
  })

  it('a resposta do mestre vira aviso: abriu, disse não, ou o pedido anterior ainda espera', () => {
    const { connection, socket } = jogando()
    connection.requestDoor('escritorio', 'force')
    socket.receive({ type: 'door.request.answer', answer: 'opened' })
    expect(connection.getState().doorRequest).toMatchObject({ phase: 'opened' })
    socket.receive({ type: 'door.request.answer', answer: 'denied' })
    expect(connection.getState().doorRequest).toMatchObject({ phase: 'denied' })
    socket.receive({ type: 'door.request.rejected', wallId: 'escritorio', reason: 'pending' })
    expect(connection.getState().doorRequest).toMatchObject({ phase: 'pending' })
  })

  it('resposta malformada é ignorada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'door.request.answer', answer: 'talvez' })
    socket.receive({ type: 'door.request.rejected', wallId: 'escritorio', reason: 'porque-sim' })
    expect(connection.getState().doorRequest).toBeUndefined()
  })

  it('pedido com jeito inventado não sai', () => {
    const { connection, socket } = jogando()
    expect(connection.requestDoor('', 'force')).toBe(false)
    expect(socket.sent.filter((m) => JSON.stringify(m).includes('door.request'))).toEqual([])
  })
})
