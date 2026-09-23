/**
 * PAUSA POR CENA no cliente do jogador: `scene.paused` liga e desliga
 * `state.paused` (que a tela lê como "O mestre está com o outro grupo"), e a
 * recusa `paused` do movimento devolve a ficha ao lugar, como qualquer recusa.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
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

function mapaComFicha(x: number, y: number): MapData {
  return { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [{ id: 't1', characterId: null, name: 'Lanterna', x, y, size: 1, image: null }] }
}

/** Jogador já jogando, dono de `t1` em (10, 10). */
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
  socket.receive({ type: 'snapshot', rev: 1, map: mapaComFicha(10, 10), vision: [], ownTokens: ['t1'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('pausa por cena no cliente do jogador', () => {
  it('scene.paused liga e desliga o aviso', () => {
    const { connection, socket } = jogando()
    expect(connection.getState().paused).toBeUndefined()
    socket.receive({ type: 'scene.paused', paused: true })
    expect(connection.getState().paused).toBe(true)
    socket.receive({ type: 'scene.paused', paused: false })
    expect(connection.getState().paused).toBeUndefined()
  })

  it('forma errada não liga nem desliga', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.paused', paused: 'sim' })
    socket.receive({ type: 'scene.paused' })
    expect(connection.getState().paused).toBeUndefined()
    socket.receive({ type: 'scene.paused', paused: true })
    socket.receive({ type: 'scene.paused', paused: 1 })
    expect(connection.getState().paused).toBe(true)
  })

  it('a recusa `paused` devolve a ficha ao lugar', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.paused', paused: true })
    expect(connection.requestMove('t1', 160, 10)).toBe(true)
    const pedido = socket.sent.at(-1)
    const reqId = typeof pedido === 'object' && pedido !== null && 'reqId' in pedido ? pedido.reqId : null
    expect(typeof reqId).toBe('string')
    socket.receive({ type: 'token.move.rejected', reqId, reason: 'paused' })
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 10, y: 10 })
  })

  it('lobby.waiting não apaga a pausa (o host só reenvia quando muda)', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.paused', paused: true })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().paused).toBe(true)
  })

  it('reconectar (tela nova) começa sem o aviso', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.paused', paused: true })
    connection.reconnect()
    expect(connection.getState().paused).toBeUndefined()
  })
})
