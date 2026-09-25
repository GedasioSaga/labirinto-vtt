/**
 * MOEDAS E TROCA no cliente do jogador: "Pagar a…" manda moedas a um colega;
 * a oferta do mestre abre o cartão; Aceitar, Recusar e Contrapropor mandam a
 * resposta; o fim da troca vira aviso que some sozinho.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { itemNoticeText } from './itemNotice'
import { createPlayerConnection, TRADE_CLOSED_TTL_MS, type SocketLike } from './playerConnection'

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

function mapa(): MapData {
  return {
    ...createEmptyMap('m1', '', 10, 10, 50),
    tokens: [{ id: 'bruno', characterId: null, name: 'Bruno', x: 90, y: 100, size: 1, image: null, moedas: 5, mochila: [{ id: 'faca', nome: 'Faca' }, { id: 'vela', nome: 'Vela' }] }],
  }
}

function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Bruno',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Bruno' })
  socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [], ownTokens: ['bruno'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

const OFERTA = { type: 'trade.offer', offerId: 'o1', de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itens: [{ id: 'faca', nome: 'Faca' }], moedas: 3 } }

describe('Pagar no cliente do jogador', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('manda as moedas; mais do que tem, zero ou quebrado nem sai', () => {
    const { connection, socket } = jogando()
    expect(connection.giveCoins('diego', 3)).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'coins.give', toTokenId: 'diego', moedas: 3 })
    const antes = socket.sent.length
    expect(connection.giveCoins('diego', 6)).toBe(false)
    expect(connection.giveCoins('diego', 0)).toBe(false)
    expect(connection.giveCoins('diego', 1.5)).toBe(false)
    expect(socket.sent.length).toBe(antes)
  })

  it('a recusa vira aviso', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'coins.give.rejected', reason: 'far' })
    const notice = connection.getState().item
    expect(notice).toMatchObject({ phase: 'coins_rejected', reason: 'far' })
    expect(notice && itemNoticeText(notice)).toBe('Chegue mais perto para pagar')
  })
})

describe('Oferta do mestre no cliente do jogador', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a oferta abre o cartão e Aceitar manda a resposta', () => {
    const { connection, socket } = jogando()
    socket.receive(OFERTA)
    expect(connection.getState().troca).toMatchObject({ offerId: 'o1', de: 'Zulmira', phase: 'open', dou: { itens: ['Xarope'], moedas: 0 } })
    expect(connection.answerTrade(true)).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'trade.answer', offerId: 'o1', answer: 'accept' })
    expect(connection.getState().troca?.phase).toBe('answered')
  })

  it('Recusar manda a recusa', () => {
    const { connection, socket } = jogando()
    socket.receive(OFERTA)
    expect(connection.answerTrade(false)).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'trade.answer', offerId: 'o1', answer: 'refuse' })
  })

  it('Contrapropor manda o que ele tem; item que não tem ou moeda demais nem sai', () => {
    const { connection, socket } = jogando()
    socket.receive(OFERTA)
    expect(connection.counterTrade(['espada'], 0)).toBe(false)
    expect(connection.counterTrade([], 9)).toBe(false)
    expect(connection.counterTrade([], 0)).toBe(false)
    expect(connection.counterTrade(['vela'], 1)).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'trade.counter', offerId: 'o1', itemIds: ['vela'], moedas: 1 })
    expect(connection.getState().troca?.phase).toBe('countered')
  })

  it('o fim da troca vira aviso e some sozinho', () => {
    const { connection, socket } = jogando()
    socket.receive(OFERTA)
    connection.answerTrade(true)
    socket.receive({ type: 'trade.closed', offerId: 'o1', result: 'done' })
    expect(connection.getState().troca?.phase).toBe('done')
    vi.advanceTimersByTime(TRADE_CLOSED_TTL_MS)
    expect(connection.getState().troca).toBeUndefined()
  })

  it('fim de OUTRA oferta não mexe no cartão aberto; oferta torta nem abre', () => {
    const { connection, socket } = jogando()
    socket.receive({ ...OFERTA, peco: { itens: 'faca', moedas: 3 } })
    expect(connection.getState().troca).toBeUndefined()
    socket.receive(OFERTA)
    socket.receive({ type: 'trade.closed', offerId: 'outra', result: 'cancelled' })
    expect(connection.getState().troca?.phase).toBe('open')
  })
})
