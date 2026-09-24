/**
 * CORREIO DE BILHETES no cliente do jogador: pedir a lista de colegas, mandar
 * o bilhete e ler a resposta do host; o bilhete entregue chega como recado com
 * remetente e meio, e fica no caderno.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, hasUnreadNotes, type SocketLike } from './playerConnection'

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

function conectado() {
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
  return { connection, socket, sockets }
}

function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  mesa.socket.sent = []
  return mesa
}

describe('correio no cliente: mandar', () => {
  it('pede a lista de colegas e mostra quando chega', () => {
    const { connection, socket } = jogando()
    expect(connection.askLetterPeers()).toBe(true)
    expect(socket.sent).toEqual([{ type: 'letter.peers' }])
    expect(connection.getState().letterPeers).toEqual({ phase: 'loading' })
    socket.receive({ type: 'letter.peers', names: ['Bruno', 'Caio'] })
    expect(connection.getState().letterPeers).toEqual({ phase: 'ready', names: ['Bruno', 'Caio'] })
  })

  it('manda o bilhete aparado e acompanha a resposta do host', () => {
    const { connection, socket } = jogando()
    expect(connection.sendLetter('Bruno', 'pombo', '  Te espero.  ')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'letter.send', to: 'Bruno', via: 'pombo', text: 'Te espero.' }])
    expect(connection.getState().letterSend).toEqual({ to: 'Bruno', via: 'pombo', phase: 'sending' })
    socket.receive({ type: 'letter.send.result', to: 'Bruno', ok: true })
    expect(connection.getState().letterSend).toEqual({ to: 'Bruno', via: 'pombo', phase: 'ok' })
  })

  it('cada recusa do host vira a fase dela', () => {
    const { connection, socket } = jogando()
    for (const [reason, phase] of [
      ['too_soon', 'too_soon'],
      ['full', 'full'],
      [undefined, 'failed'],
    ] as const) {
      connection.sendLetter('Bruno', 'tubo', 'oi')
      socket.receive({ type: 'letter.send.result', to: 'Bruno', ok: false, ...(reason === undefined ? {} : { reason }) })
      expect(connection.getState().letterSend?.phase).toBe(phase)
    }
  })

  it('texto vazio, grande demais ou fora do jogo: nada sai', () => {
    const { connection, socket } = jogando()
    expect(connection.sendLetter('Bruno', 'pombo', '   ')).toBe(false)
    expect(connection.sendLetter('Bruno', 'pombo', 'x'.repeat(281))).toBe(false)
    expect(connection.sendLetter('', 'pombo', 'oi')).toBe(false)
    expect(socket.sent).toEqual([])

    const aguardando = conectado()
    aguardando.socket.sent = []
    aguardando.socket.receive({ type: 'lobby.waiting' })
    expect(aguardando.connection.sendLetter('Bruno', 'pombo', 'oi')).toBe(false)
    expect(aguardando.connection.askLetterPeers()).toBe(false)
    expect(aguardando.socket.sent).toEqual([])
  })

  it('resposta sem pedido em curso não muda nada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'letter.peers', names: ['Bruno'] })
    socket.receive({ type: 'letter.send.result', to: 'Bruno', ok: true })
    expect(connection.getState().letterPeers).toBeUndefined()
    expect(connection.getState().letterSend).toBeUndefined()
  })
})

describe('correio no cliente: receber', () => {
  it('o bilhete entregue abre com remetente e meio, e fica no caderno', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'b1', text: 'Te espero.', at: 10, from: 'Bruno', via: 'capsula' })
    expect(connection.getState().note).toEqual({ id: 'b1', text: 'Te espero.', from: 'Bruno', via: 'capsula' })
    expect(connection.getState().notebook).toEqual([{ id: 'b1', text: 'Te espero.', at: 10, from: 'Bruno', via: 'capsula' }])
    expect(connection.getState().unreadNotes).toEqual(['b1'])
  })

  it('bilhete entregue enquanto o jogador estava fora: o caderno da volta acende o não lido, sem abrir cartão', () => {
    const { connection, socket, sockets } = jogando()
    socket.receive({ type: 'scene.note', id: 'n0', text: 'A porta range.', at: 5 })
    connection.dismissNote()
    // O wifi cai: reconectar zera o que era da sessão, o caderno volta pelo host.
    connection.reconnect()
    expect(connection.getState().unreadNotes).toBeUndefined()
    const volta = sockets[1]
    if (volta === undefined) throw new Error('reconectar deveria abrir outro socket')
    volta.open()
    volta.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    volta.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    volta.receive({
      type: 'notes.book',
      notes: [
        { id: 'n0', text: 'A porta range.', at: 5 },
        { id: 'b1', text: 'Te espero.', at: 10, from: 'Bruno', via: 'pombo' },
      ],
      unread: ['b1'],
    })
    const estado = connection.getState()
    expect(estado.notebook?.map((entry) => entry.id)).toEqual(['n0', 'b1'])
    expect(estado.unreadNotes).toEqual(['b1'])
    expect(estado.note).toBeUndefined()
    expect(hasUnreadNotes(estado)).toBe(true)
  })

  it('caderno sem marca de não lido continua só história, e não repete o que já era novo', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'b1', text: 'Te espero.', at: 10, from: 'Bruno', via: 'pombo' })
    socket.receive({ type: 'notes.book', notes: [{ id: 'b1', text: 'Te espero.', at: 10, from: 'Bruno', via: 'pombo' }], unread: ['b1'] })
    expect(connection.getState().unreadNotes).toEqual(['b1'])
    socket.receive({ type: 'notes.book', notes: [{ id: 'n0', text: 'A porta range.', at: 5 }] })
    expect(connection.getState().unreadNotes).toEqual([])
  })

  it('recado do mestre continua sem remetente', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'A porta range.', at: 10 })
    expect(connection.getState().note).toEqual({ id: 'n1', text: 'A porta range.' })
    expect(connection.getState().notebook).toEqual([{ id: 'n1', text: 'A porta range.', at: 10 }])
  })
})
