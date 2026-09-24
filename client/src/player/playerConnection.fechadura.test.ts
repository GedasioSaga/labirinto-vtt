/**
 * FECHADURA COM SEGREDO no cliente do jogador: `answerLock` manda a tentativa
 * (só para pino que chegou com fechadura) e `pin.answer.result` vira
 * `state.lockAnswer` — "abriu", "não abre" ou "espere".
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
}

const COFRE: Pin = { id: 'cofre', x: 10, y: 10, kind: 'exclamacao', description: 'Cofre', image: null, fechadura: { forma: 'teclado' } }
const QUADRO: Pin = { id: 'quadro', x: 20, y: 10, kind: 'exclamacao', description: 'Quadro', image: null }

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
  socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [COFRE, QUADRO] }, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.sent = []
  return { connection, socket }
}

describe('fechadura no cliente do jogador', () => {
  it('manda a tentativa e espera a resposta do host', () => {
    const { connection, socket } = jogando()
    expect(connection.answerLock('cofre', ' 1234 ')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'pin.answer', pinId: 'cofre', tentativa: '1234' }])
    expect(connection.getState().lockAnswer).toEqual({ pinId: 'cofre', phase: 'sending' })
  })

  it('"não abre", "abriu" e "espere" chegam ao estado', () => {
    const { connection, socket } = jogando()
    connection.answerLock('cofre', '1111')
    socket.receive({ type: 'pin.answer.result', pinId: 'cofre', ok: false })
    expect(connection.getState().lockAnswer).toEqual({ pinId: 'cofre', phase: 'wrong' })
    connection.answerLock('cofre', '2222')
    socket.receive({ type: 'pin.answer.result', pinId: 'cofre', ok: false, reason: 'too_soon' })
    expect(connection.getState().lockAnswer).toEqual({ pinId: 'cofre', phase: 'too_soon' })
    connection.answerLock('cofre', '9382')
    socket.receive({ type: 'pin.answer.result', pinId: 'cofre', ok: true })
    expect(connection.getState().lockAnswer).toEqual({ pinId: 'cofre', phase: 'open' })
  })

  it('resposta de outro pino, ou sem pedido no ar, não mexe no estado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.answer.result', pinId: 'cofre', ok: true })
    expect(connection.getState().lockAnswer).toBeUndefined()
    connection.answerLock('cofre', '1111')
    socket.receive({ type: 'pin.answer.result', pinId: 'quadro', ok: true })
    expect(connection.getState().lockAnswer).toEqual({ pinId: 'cofre', phase: 'sending' })
    socket.receive({ type: 'pin.answer.result', pinId: 'cofre', ok: 'sim' })
    expect(connection.getState().lockAnswer).toEqual({ pinId: 'cofre', phase: 'sending' })
  })

  it('pino sem fechadura, tentativa vazia ou longa demais: nada sai', () => {
    const { connection, socket } = jogando()
    expect(connection.answerLock('quadro', '1234')).toBe(false)
    expect(connection.answerLock('cofre', '   ')).toBe(false)
    expect(connection.answerLock('cofre', '1'.repeat(65))).toBe(false)
    expect(connection.answerLock('sumiu', '1234')).toBe(false)
    expect(socket.sent).toEqual([])
    expect(connection.getState().lockAnswer).toBeUndefined()
  })

  it('resetLockAnswer limpa o resultado (o cartão fechou)', () => {
    const { connection, socket } = jogando()
    connection.answerLock('cofre', '1111')
    socket.receive({ type: 'pin.answer.result', pinId: 'cofre', ok: false })
    connection.resetLockAnswer()
    expect(connection.getState().lockAnswer).toBeUndefined()
  })
})
