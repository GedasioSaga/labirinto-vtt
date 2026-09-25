/**
 * LOJA COM PREÇOS no cliente do jogador: `buy` manda o "Quero" (só de
 * mercadoria que chegou no recorte e não acabou) e a resposta vira
 * `state.compra` — enviado, vendido, não vendido ou a recusa do host.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'
import { compraNoticeText } from './compraNotice'
import { COMPRA_NOTICE_TTL_MS, createPlayerConnection, type SocketLike } from './playerConnection'

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

const BOTICA: Pin = {
  id: 'botica',
  x: 10,
  y: 10,
  kind: 'exclamacao',
  description: 'Botica',
  image: null,
  loja: [
    { id: 'xarope', nome: 'Xarope', preco: '1 moeda', estoque: 2 },
    { id: 'atadura', nome: 'Atadura', preco: '2 moedas', estoque: 0 },
  ],
}
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
  socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [BOTICA, QUADRO] }, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.sent = []
  return { connection, socket }
}

const texto = (connection: ReturnType<typeof jogando>['connection']): string | undefined => {
  const compra = connection.getState().compra
  return compra === undefined ? undefined : compraNoticeText(compra)
}

describe('loja no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('"Quero" manda o pedido e mostra que espera o mestre, sem prazo', () => {
    const { connection, socket } = jogando()
    expect(connection.buy('botica', 'xarope')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'pin.buy', pinId: 'botica', itemId: 'xarope' }])
    expect(connection.getState().compra).toMatchObject({ pinId: 'botica', itemId: 'xarope', nome: 'Xarope', phase: 'sent' })
    expect(texto(connection)).toBe('Pedido enviado ao mestre: Xarope')
    vi.advanceTimersByTime(COMPRA_NOTICE_TTL_MS * 3)
    expect(connection.getState().compra?.phase).toBe('sent')
  })

  it('o mestre vendeu: "Xarope está com você", e o aviso some sozinho', () => {
    const { connection, socket } = jogando()
    connection.buy('botica', 'xarope')
    socket.receive({ type: 'pin.buy.answer', answer: 'sold', nome: 'Xarope' })
    expect(connection.getState().compra).toMatchObject({ pinId: 'botica', itemId: 'xarope', phase: 'sold' })
    expect(texto(connection)).toBe('Xarope está com você')
    vi.advanceTimersByTime(COMPRA_NOTICE_TTL_MS + 1)
    expect(connection.getState().compra).toBeUndefined()
  })

  it('o mestre não vendeu: o aviso diz qual mercadoria, e dá para pedir de novo', () => {
    const { connection, socket } = jogando()
    connection.buy('botica', 'xarope')
    socket.receive({ type: 'pin.buy.answer', answer: 'denied' })
    expect(texto(connection)).toBe('O mestre não vendeu Xarope')
    socket.sent = []
    expect(connection.buy('botica', 'xarope')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'pin.buy', pinId: 'botica', itemId: 'xarope' }])
  })

  it('a recusa do host vira aviso: longe, esperando, cedo demais, indisponível', () => {
    const { connection, socket } = jogando()
    const casos: [string, string][] = [
      ['far', 'Chegue mais perto da banca para pedir'],
      ['pending', 'Seu pedido ainda espera o mestre'],
      ['too_soon', 'Espere um instante antes de pedir de novo'],
      ['unavailable', 'Não dá para pedir isso agora'],
    ]
    for (const [reason, esperado] of casos) {
      connection.buy('botica', 'xarope')
      socket.receive({ type: 'pin.buy.rejected', reason })
      expect(texto(connection)).toBe(esperado)
    }
  })

  it('com um pedido esperando o mestre, outro "Quero" não sai', () => {
    const { connection, socket } = jogando()
    connection.buy('botica', 'xarope')
    socket.sent = []
    expect(connection.buy('botica', 'xarope')).toBe(false)
    expect(socket.sent).toEqual([])
  })

  it('mercadoria que acabou, inventada, ou pino sem loja: nada sai', () => {
    const { connection, socket } = jogando()
    expect(connection.buy('botica', 'atadura')).toBe(false)
    expect(connection.buy('botica', 'espada')).toBe(false)
    expect(connection.buy('quadro', 'xarope')).toBe(false)
    expect(connection.buy('sumiu', 'xarope')).toBe(false)
    expect(socket.sent).toEqual([])
    expect(connection.getState().compra).toBeUndefined()
  })

  it('resposta sem pedido no ar, ou com forma desconhecida, não mexe no estado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.buy.answer', answer: 'sold', nome: 'Xarope' })
    expect(connection.getState().compra).toBeUndefined()
    connection.buy('botica', 'xarope')
    socket.receive({ type: 'pin.buy.answer', answer: 'de graça' })
    socket.receive({ type: 'pin.buy.rejected', reason: 'porque sim' })
    expect(connection.getState().compra?.phase).toBe('sent')
  })

  it('o mestre tira a ficha (volta à espera): o pedido some da tela', () => {
    const { connection, socket } = jogando()
    connection.buy('botica', 'xarope')
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().compra).toBeUndefined()
  })
})
