/**
 * ITEM PEGÁVEL no cliente do jogador: "Pegar" manda o pedido; a resposta vira
 * aviso ("A Chave do Escudo está com você", "O mestre disse não"). "Dar a…"
 * manda o item a um colega; recusa vira aviso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, ITEM_NOTICE_TTL_MS, type SocketLike } from './playerConnection'
import { itemNoticeText } from './itemNotice'

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
    pins: [
      { ...buildPin('chave', { x: 100, y: 100 }, 'exclamacao'), item: { nome: 'Chave do Escudo' } },
      { ...buildPin('moeda', { x: 150, y: 100 }, 'exclamacao'), item: { nome: 'Moeda', livre: true } },
    ],
    tokens: [{ id: 'diego', characterId: null, name: 'Diego', x: 90, y: 100, size: 1, image: null, mochila: [{ id: 'carta', nome: 'Carta' }] }],
  }
}

function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Diego',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Diego' })
  socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [], ownTokens: ['diego'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('Pegar no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Pegar manda o pedido e mostra que espera o mestre', () => {
    const { connection, socket } = jogando()
    expect(connection.takePin('chave')).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'pin.take', pinId: 'chave' })
    const notice = connection.getState().item
    expect(notice).toMatchObject({ phase: 'sent', direct: false })
    expect(notice && itemNoticeText(notice)).toBe('Pedido enviado ao mestre')
  })

  it('pino livre: o aviso não fala em mestre', () => {
    const { connection } = jogando()
    connection.takePin('moeda')
    const notice = connection.getState().item
    expect(notice).toMatchObject({ phase: 'sent', direct: true })
    expect(notice && itemNoticeText(notice)).toBe('Pegando…')
  })

  it('o mestre deixou: "A Chave do Escudo está com você", e o aviso some sozinho', () => {
    const { connection, socket } = jogando()
    connection.takePin('chave')
    socket.receive({ type: 'pin.take.answer', answer: 'taken', nome: 'Chave do Escudo' })
    const notice = connection.getState().item
    expect(notice && itemNoticeText(notice)).toBe('Chave do Escudo está com você')
    vi.advanceTimersByTime(ITEM_NOTICE_TTL_MS + 1)
    expect(connection.getState().item).toBeUndefined()
  })

  it('não, longe, pendente e indisponível viram avisos claros', () => {
    const { connection, socket } = jogando()
    const textos: string[] = []
    const ler = () => {
      const notice = connection.getState().item
      textos.push(notice === undefined ? '' : itemNoticeText(notice))
    }
    socket.receive({ type: 'pin.take.answer', answer: 'denied' })
    ler()
    for (const reason of ['far', 'pending', 'unavailable']) {
      socket.receive({ type: 'pin.take.rejected', reason })
      ler()
    }
    expect(textos).toEqual(['O mestre disse não', 'Chegue mais perto para pegar', 'Seu pedido ainda espera o mestre', 'Não dá para pegar isso agora'])
  })

  it('resposta malformada é ignorada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.take.answer', answer: 'talvez' })
    socket.receive({ type: 'pin.take.answer', answer: 'taken', nome: 42 })
    socket.receive({ type: 'pin.take.rejected', reason: 'porque-sim' })
    socket.receive({ type: 'item.give.rejected', reason: 'porque-sim' })
    expect(connection.getState().item).toBeUndefined()
  })

  it('pino que não é item, ou inexistente, não manda nada', () => {
    const { connection, socket } = jogando()
    expect(connection.takePin('nao-existe')).toBe(false)
    expect(connection.takePin('')).toBe(false)
    expect(socket.sent.filter((m) => JSON.stringify(m).includes('pin.take'))).toEqual([])
  })
})

describe('Dar a… no cliente do jogador', () => {
  it('Dar a Bruno manda o item e a ficha dele; recusa vira aviso', () => {
    const { connection, socket } = jogando()
    expect(connection.giveItem('carta', 'bruno')).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'item.give', itemId: 'carta', toTokenId: 'bruno' })
    socket.receive({ type: 'item.give.rejected', reason: 'far' })
    const notice = connection.getState().item
    expect(notice && itemNoticeText(notice)).toBe('Chegue mais perto para dar')
  })

  it('o snapshot traz as fichas de colegas; ausente vira lista vazia; malformado descarta a mensagem', () => {
    const { connection, socket } = jogando()
    expect(connection.getState().partyTokens).toEqual([])
    socket.receive({ type: 'snapshot', rev: 2, map: mapa(), vision: [], ownTokens: ['diego'], concealed: [], partyTokens: ['bruno'] })
    expect(connection.getState().partyTokens).toEqual(['bruno'])
    socket.receive({ type: 'snapshot', rev: 3, map: mapa(), vision: [], ownTokens: ['diego'], concealed: [], partyTokens: [7] })
    expect(connection.getState().rev).toBe(2)
  })

  it('item que não está na mochila dele não sai', () => {
    const { connection, socket } = jogando()
    expect(connection.giveItem('inventado', 'bruno')).toBe(false)
    expect(socket.sent.filter((m) => JSON.stringify(m).includes('item.give'))).toEqual([])
  })
})
