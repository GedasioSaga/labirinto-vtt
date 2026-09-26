/**
 * MOEDAS E TROCA no cliente do jogador: "Pagar a…" manda moedas a um colega;
 * a oferta do mestre abre o cartão; Aceitar, Recusar e Contrapropor mandam a
 * resposta; o fim da troca vira aviso que some sozinho.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { ownTradeToken, TRADE_ITEMS_MAX } from '../lib/troca'
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

function jogando(map: MapData = mapa(), ownTokens: string[] = ['bruno']) {
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
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens, concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

const OFERTA = { type: 'trade.offer', offerId: 'o1', tokenId: 'bruno', de: 'Zulmira', dou: { itens: ['Xarope'], moedas: 0 }, peco: { itens: [{ id: 'faca', nome: 'Faca' }], moedas: 3 } }

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

  it('duas fichas: só paga a ficha ENCOSTADA no colega, como o host cobra', () => {
    // Ficha A rica e longe do Diego; ficha B pobre e encostada nele.
    const map: MapData = {
      ...createEmptyMap('m1', '', 10, 10, 50),
      tokens: [
        { id: 'fichaA', characterId: null, name: 'Ficha A', x: 400, y: 400, size: 1, image: null, moedas: 10 },
        { id: 'fichaB', characterId: null, name: 'Ficha B', x: 100, y: 100, size: 1, image: null, moedas: 2 },
        { id: 'diego', characterId: null, name: 'Diego', x: 160, y: 100, size: 1, image: null },
      ],
    }
    const { connection, socket } = jogando(map, ['fichaA', 'fichaB'])
    const antes = socket.sent.length
    expect(connection.giveCoins('diego', 5)).toBe(false)
    expect(socket.sent.length).toBe(antes)
    expect(connection.giveCoins('diego', 2)).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'coins.give', toTokenId: 'diego', moedas: 2 })
  })

  it('a ficha encostada sem moeda nenhuma (campo ausente) não paga, mesmo com a outra cheia', () => {
    const map: MapData = {
      ...createEmptyMap('m1', '', 10, 10, 50),
      tokens: [
        { id: 'fichaA', characterId: null, name: 'Ficha A', x: 400, y: 400, size: 1, image: null, moedas: 10 },
        { id: 'fichaB', characterId: null, name: 'Ficha B', x: 100, y: 100, size: 1, image: null },
        { id: 'diego', characterId: null, name: 'Diego', x: 160, y: 100, size: 1, image: null },
      ],
    }
    const { connection, socket } = jogando(map, ['fichaA', 'fichaB'])
    const antes = socket.sent.length
    expect(connection.giveCoins('diego', 1)).toBe(false)
    expect(socket.sent.length).toBe(antes)
  })

  it('o aviso de "short" fala da ficha perto do colega, não da bolsa toda', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'coins.give.rejected', reason: 'short' })
    const notice = connection.getState().item
    expect(notice).toMatchObject({ phase: 'coins_rejected', reason: 'short' })
    expect(notice && itemNoticeText(notice)).toBe('A sua ficha ao lado dele não tem tantas moedas')
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

  it('Contrapropor confere a FICHA DA OFERTA: item ou moedas da outra ficha dele nem saem', () => {
    // Bruno segura também o Cavalo (emprestado), com a Sela e 20 moedas.
    const cavalo = { id: 'cavalo', characterId: null, name: 'Cavalo', x: 140, y: 100, size: 1, image: null, moedas: 20, mochila: [{ id: 'sela', nome: 'Sela' }] }
    const { connection, socket } = jogando({ ...mapa(), tokens: [...mapa().tokens, cavalo] }, ['bruno', 'cavalo'])
    socket.receive(OFERTA)
    expect(connection.getState().troca?.tokenId).toBe('bruno')
    const antes = socket.sent.length
    expect(connection.counterTrade(['sela'], 0)).toBe(false)
    expect(connection.counterTrade([], 9)).toBe(false)
    expect(socket.sent.length).toBe(antes)
    expect(connection.getState().troca?.phase).toBe('open')
    expect(connection.counterTrade(['vela'], 5)).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'trade.counter', offerId: 'o1', itemIds: ['vela'], moedas: 5 })
  })

  it('a ficha da oferta sumiu do mapa dele: Contrapropor nem sai; o "unavailable" do host fecha o cartão enviado', () => {
    const { connection, socket } = jogando()
    socket.receive(OFERTA)
    expect(connection.counterTrade(['vela'], 1)).toBe(true)
    expect(connection.getState().troca?.phase).toBe('countered')
    socket.receive({ type: 'trade.closed', offerId: 'o1', result: 'unavailable' })
    expect(connection.getState().troca?.phase).toBe('unavailable')
    connection.dismissTrade()
    expect(connection.getState().troca).toBeUndefined()
    const outra = jogando({ ...mapa(), tokens: [] })
    outra.socket.receive(OFERTA)
    expect(outra.connection.counterTrade(['vela'], 1)).toBe(false)
    expect(outra.connection.getState().troca?.phase).toBe('open')
  })

  it('Contrapropor com mais itens do que o host aceita (TRADE_ITEMS_MAX) nem sai e o cartão segue aberto', () => {
    const muitos = Array.from({ length: TRADE_ITEMS_MAX + 1 }, (_, i) => ({ id: `item${i}`, nome: `Item ${i}` }))
    const cheio: MapData = { ...mapa(), tokens: mapa().tokens.map((t) => ({ ...t, mochila: muitos })) }
    const { connection, socket } = jogando(cheio)
    socket.receive(OFERTA)
    const antes = socket.sent.length
    expect(connection.counterTrade(muitos.map((item) => item.id), 0)).toBe(false)
    expect(socket.sent.length).toBe(antes)
    expect(connection.getState().troca?.phase).toBe('open')
    // No teto exato ainda vai: o host aceita até TRADE_ITEMS_MAX.
    const noTeto = muitos.slice(0, TRADE_ITEMS_MAX).map((item) => item.id)
    expect(connection.counterTrade(noTeto, 0)).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'trade.counter', offerId: 'o1', itemIds: noTeto, moedas: 0 })
    expect(connection.getState().troca?.phase).toBe('countered')
  })

  it('oferta sem a ficha (tokenId) não abre o cartão', () => {
    const { connection, socket } = jogando()
    const { tokenId: _semFicha, ...semFicha } = OFERTA
    socket.receive(semFicha)
    expect(connection.getState().troca).toBeUndefined()
  })
})

describe('ownTradeToken: a ficha da oferta no mapa dele', () => {
  it('só a ficha dele, presente no mapa', () => {
    const tokens = mapa().tokens
    expect(ownTradeToken(tokens, ['bruno'], 'bruno')?.id).toBe('bruno')
    expect(ownTradeToken(tokens, [], 'bruno')).toBeUndefined()
    expect(ownTradeToken(tokens, ['bruno', 'cavalo'], 'cavalo')).toBeUndefined()
  })
})
