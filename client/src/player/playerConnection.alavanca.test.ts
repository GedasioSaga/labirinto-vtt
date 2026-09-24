/**
 * ALAVANCA no cliente do jogador: "Puxar a alavanca" manda só o id do pino; a
 * resposta vira aviso curto que some sozinho. O aviso nunca diz qual porta a
 * alavanca move, nem se abriu ou fechou — isso o jogador vê no mapa, se a
 * porta estiver à vista.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, LEVER_NOTICE_TTL_MS, type SocketLike } from './playerConnection'
import { leverNoticeText } from './leverNotice'

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
    pins: [buildPin('alav', { x: 100, y: 100 }, 'alavanca'), buildPin('marco', { x: 150, y: 100 }, 'exclamacao')],
    tokens: [{ id: 'diego', characterId: null, name: 'Diego', x: 90, y: 100, size: 1, image: null }],
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

describe('Puxar a alavanca no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a alavanca chega no mapa do jogador como alavanca', () => {
    const { connection } = jogando()
    expect(connection.getState().map?.pins.find((p) => p.id === 'alav')?.kind).toBe('alavanca')
  })

  it('puxar manda só o id do pino', () => {
    const { connection, socket } = jogando()
    expect(connection.pullLever('alav')).toBe(true)
    expect(socket.sent).toContainEqual({ type: 'pin.lever', pinId: 'alav' })
  })

  it('"Você puxou a alavanca", e o aviso some sozinho', () => {
    const { connection, socket } = jogando()
    connection.pullLever('alav')
    socket.receive({ type: 'pin.lever.answer', answer: 'pulled' })
    const notice = connection.getState().lever
    expect(notice && leverNoticeText(notice.phase)).toBe('Você puxou a alavanca')
    vi.advanceTimersByTime(LEVER_NOTICE_TTL_MS + 1)
    expect(connection.getState().lever).toBeUndefined()
  })

  it('longe, emperrada e indisponível viram avisos claros', () => {
    const { connection, socket } = jogando()
    const textos: string[] = []
    for (const reason of ['far', 'stuck', 'unavailable']) {
      socket.receive({ type: 'pin.lever.rejected', reason })
      const notice = connection.getState().lever
      textos.push(notice === undefined ? '' : leverNoticeText(notice.phase))
    }
    expect(textos).toEqual(['Chegue mais perto da alavanca', 'A alavanca não se move', 'Não dá para usar isso agora'])
  })

  it('resposta malformada é ignorada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.lever.answer', answer: 'opened' })
    socket.receive({ type: 'pin.lever.rejected', reason: 'porque-sim' })
    socket.receive({ type: 'pin.lever.rejected' })
    expect(connection.getState().lever).toBeUndefined()
  })

  it('pino que não é alavanca, inexistente ou id vazio não manda nada', () => {
    const { connection, socket } = jogando()
    expect(connection.pullLever('marco')).toBe(false)
    expect(connection.pullLever('nao-existe')).toBe(false)
    expect(connection.pullLever('')).toBe(false)
    expect(socket.sent.filter((m) => JSON.stringify(m).includes('pin.lever'))).toEqual([])
  })
})
