/**
 * CHAMAR O MESTRE no cliente do jogador: a mão acende ao chamar, apaga no
 * "Visto" (com "O mestre viu" por um instante) e a resposta vira recado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { CALL_NOTICE_TTL_MS, createPlayerConnection, type SocketLike } from './playerConnection'

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
    name: 'Duda',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Duda' })
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

const chamadosEnviados = (socket: FakeSocket) => socket.sent.filter((m) => JSON.stringify(m).includes('"call.'))

describe('mão levantada no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('chamar acende a mão ("esperando") e manda motivo e texto', () => {
    const { connection, socket } = jogando()
    expect(connection.raiseHand('agir', 'abro o baú')).toBe(true)
    expect(connection.getState().call).toEqual({ id: expect.any(Number), phase: 'waiting', reason: 'agir' })
    expect(chamadosEnviados(socket)).toEqual([{ type: 'call.raise', reason: 'agir', text: 'abro o baú' }])
  })

  it('texto em branco não viaja; acima de 140 não sai', () => {
    const { connection, socket } = jogando()
    expect(connection.raiseHand('ajuda', '   ')).toBe(true)
    expect(chamadosEnviados(socket)).toEqual([{ type: 'call.raise', reason: 'ajuda' }])
    connection.lowerHand()
    expect(connection.raiseHand('ajuda', 'x'.repeat(141))).toBe(false)
  })

  it('5 toques: um chamado só enquanto a mão está acesa', () => {
    const { connection, socket } = jogando()
    const respostas = [1, 2, 3, 4, 5].map(() => connection.raiseHand('agir'))
    expect(respostas).toEqual([true, false, false, false, false])
    expect(chamadosEnviados(socket)).toHaveLength(1)
  })

  it('"Visto": a mão apaga, "O mestre viu" aparece e some sozinho', () => {
    const { connection, socket } = jogando()
    connection.raiseHand('agir')
    socket.receive({ type: 'call.state', state: 'seen' })
    expect(connection.getState().call).toEqual({ id: expect.any(Number), phase: 'seen' })
    vi.advanceTimersByTime(CALL_NOTICE_TTL_MS)
    expect(connection.getState().call).toBeUndefined()
    expect(connection.raiseHand('ajuda')).toBe(true)
  })

  it('"cedo demais": a mão apaga e o aviso diz para esperar', () => {
    const { connection, socket } = jogando()
    connection.raiseHand('agir')
    socket.receive({ type: 'call.state', state: 'too_soon' })
    expect(connection.getState().call).toEqual({ id: expect.any(Number), phase: 'too_soon' })
  })

  it('a resposta do mestre vira recado e apaga a mão', () => {
    const { connection, socket } = jogando()
    connection.raiseHand('pergunta')
    socket.receive({ type: 'call.reply', id: 'r1', text: 'Pode usar a corda.' })
    expect(connection.getState().note).toEqual({ id: 'r1', text: 'Pode usar a corda.' })
    expect(connection.getState().call).toBeUndefined()
  })

  it('resposta malformada não aparece', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'call.reply', id: 'r1', text: '' })
    socket.receive({ type: 'call.reply', text: 'sem id' })
    expect(connection.getState().note).toBeUndefined()
  })

  it('baixar a mão avisa o mestre e apaga', () => {
    const { connection, socket } = jogando()
    connection.raiseHand('sair')
    expect(connection.lowerHand()).toBe(true)
    expect(connection.getState().call).toBeUndefined()
    expect(chamadosEnviados(socket)).toEqual([{ type: 'call.raise', reason: 'sair' }, { type: 'call.lower' }])
  })

  it('fora do jogo não chama', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.raiseHand('ajuda')).toBe(false)
  })
})
