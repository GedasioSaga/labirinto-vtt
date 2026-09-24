/**
 * "NÃO, PORQUE…" no cliente do jogador: o motivo curto do mestre chega com a
 * recusa e fica no aviso, por mais tempo que o "não deixou" sem motivo — é
 * uma frase para ler. Motivo malformado não derruba a recusa: o jogador lê o
 * "não deixou" de sempre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { TRAVEL_DENY_TEXT_MAX_LENGTH } from '../net/protocol'
import { createPlayerConnection, TRAVEL_DENIED_WITH_REASON_TTL_MS, TRAVEL_NOTICE_TTL_MS, type SocketLike } from './playerConnection'
import { travelNoticeText } from './travelNoticeText'

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
    name: 'Felipe',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Felipe' })
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('recusa do mestre com motivo, no jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o motivo chega e o jogador lê "O mestre não deixou: o portão fecha à noite"', () => {
    const { connection, socket } = jogando()
    connection.requestTravel('portao')
    socket.receive({ type: 'pin.travel.denied', text: 'o portão fecha à noite' })
    const aviso = connection.getState().travel
    expect(aviso).toMatchObject({ phase: 'denied', text: 'o portão fecha à noite' })
    if (aviso === undefined) throw new Error('esperava o aviso')
    expect(travelNoticeText(aviso)).toBe('O mestre não deixou: o portão fecha à noite')
  })

  it('com motivo, o aviso fica mais que o "não deixou" sem motivo, e depois some', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.travel.denied', text: 'a ponte caiu' })
    expect(TRAVEL_DENIED_WITH_REASON_TTL_MS).toBeGreaterThan(TRAVEL_NOTICE_TTL_MS)
    vi.advanceTimersByTime(TRAVEL_NOTICE_TTL_MS)
    expect(connection.getState().travel).toMatchObject({ phase: 'denied', text: 'a ponte caiu' })
    vi.advanceTimersByTime(TRAVEL_DENIED_WITH_REASON_TTL_MS - TRAVEL_NOTICE_TTL_MS)
    expect(connection.getState().travel).toBeUndefined()
  })

  it('motivo malformado (não texto, vazio ou acima do teto) vira o "não deixou" de sempre', () => {
    const { connection, socket } = jogando()
    for (const text of [42, '', 'x'.repeat(TRAVEL_DENY_TEXT_MAX_LENGTH + 1)]) {
      socket.receive({ type: 'pin.travel.denied', text })
      const aviso = connection.getState().travel
      expect(aviso?.phase).toBe('denied')
      expect(aviso !== undefined && 'text' in aviso).toBe(false)
      if (aviso === undefined) throw new Error('esperava o aviso')
      expect(travelNoticeText(aviso)).toBe('O mestre não deixou passar agora')
    }
  })

  it('sem motivo, continua exatamente o aviso de antes', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.travel.denied' })
    const aviso = connection.getState().travel
    if (aviso === undefined) throw new Error('esperava o aviso')
    expect(aviso).toEqual({ id: aviso.id, phase: 'denied' })
    expect(travelNoticeText(aviso)).toBe('O mestre não deixou passar agora')
  })
})
