/**
 * ENCONTRO MARCADO no cliente do jogador: "Esperar aqui" manda `wait.set`, o
 * `wait.state` do mestre vira `state.wait` (com o prazo no relógio DESTA
 * tela), o `wait.ended` vira o aviso e a marca "esperando" das fichas vem no
 * snapshot (`waiting`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, WAIT_ENDED_NOTICE_TTL_MS, type SocketLike } from './playerConnection'

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

const T0 = 5_000_000

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
  const map = { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [{ id: 'ana-t', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: ['ana-t'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.sent = []
  return { connection, socket, map }
}

describe('encontro marcado no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('"Esperar aqui" manda o pedido com o que ele digitou, aparado; campo vazio não vai', () => {
    const { connection, socket } = jogando()
    expect(connection.startWait(15, ' Bia ', ' no portão ')).toBe(true)
    expect(connection.startWait(10, '', '  ')).toBe(true)
    expect(socket.sent).toEqual([
      { type: 'wait.set', minutes: 15, who: 'Bia', where: 'no portão' },
      { type: 'wait.set', minutes: 10 },
    ])
  })

  it('prazo fora da faixa nem sai', () => {
    const { connection, socket } = jogando()
    expect(connection.startWait(0)).toBe(false)
    expect(connection.startWait(1.5)).toBe(false)
    expect(socket.sent).toEqual([])
  })

  it('o wait.state do mestre vira a espera, com o prazo no relógio desta tela', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'wait.state', wait: { who: 'Bia', where: 'no portão', remainingMs: 12 * 60_000 } })
    expect(connection.getState().wait).toEqual({ who: 'Bia', where: 'no portão', until: T0 + 12 * 60_000 })
    socket.receive({ type: 'wait.state', wait: null })
    expect(connection.getState().wait).toBeUndefined()
  })

  it('"Parar de esperar" manda wait.clear e tira a espera da tela na hora', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'wait.state', wait: { remainingMs: 60_000 } })
    expect(connection.stopWait()).toBe(true)
    expect(socket.sent).toEqual([{ type: 'wait.clear' }])
    expect(connection.getState().wait).toBeUndefined()
  })

  it('o wait.ended vira o aviso, tira a espera e some sozinho', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'wait.state', wait: { who: 'Bia', remainingMs: 60_000 } })
    socket.receive({ type: 'wait.ended', reason: 'met', who: 'Bia' })
    const state = connection.getState()
    expect(state.wait).toBeUndefined()
    expect(state.waitEnded?.end).toEqual({ reason: 'met', who: 'Bia' })
    vi.advanceTimersByTime(WAIT_ENDED_NOTICE_TTL_MS)
    expect(connection.getState().waitEnded).toBeUndefined()
  })

  it('o aviso pode ser fechado antes do tempo', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'wait.ended', reason: 'expired' })
    expect(connection.getState().waitEnded?.end).toEqual({ reason: 'expired' })
    connection.dismissWaitEnded()
    expect(connection.getState().waitEnded).toBeUndefined()
  })

  it('a marca "esperando" das fichas vem do snapshot; snapshot sem o campo apaga a marca', () => {
    const { connection, socket, map } = jogando()
    socket.receive({ type: 'delta', rev: 2, map, vision: [], ownTokens: ['ana-t'], concealed: [], waiting: ['ana-t'] })
    expect(connection.getState().waitingTokens).toEqual(['ana-t'])
    socket.receive({ type: 'delta', rev: 3, map, vision: [], ownTokens: ['ana-t'], concealed: [] })
    expect(connection.getState().waitingTokens).toEqual([])
  })

  it('snapshot com a marca malformada cai inteiro', () => {
    const { connection, socket, map } = jogando()
    socket.receive({ type: 'delta', rev: 2, map, vision: [], ownTokens: ['ana-t'], concealed: [], waiting: [7] })
    expect(connection.getState().rev).toBe(1)
  })

  it('mensagem de espera malformada não mexe em nada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'wait.state', wait: { who: 'Bia', remainingMs: 60_000 } })
    socket.receive({ type: 'wait.state', wait: { remainingMs: 'muito' } })
    socket.receive({ type: 'wait.ended', reason: 'sumiu' })
    expect(connection.getState().wait).toEqual({ who: 'Bia', until: T0 + 60_000 })
    expect(connection.getState().waitEnded).toBeUndefined()
  })

  it('sem ficha (aguardando o mestre), a espera sai da tela', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'wait.state', wait: { remainingMs: 60_000 } })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().wait).toBeUndefined()
    expect(connection.startWait(15)).toBe(false)
  })
})
