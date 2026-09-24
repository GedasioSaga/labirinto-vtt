/**
 * BILHETE NO LUGAR no cliente do jogador: "Deixar" manda `mark.place` no
 * ponto da ficha dele, e a resposta do host (`mark.place.result`) vira o
 * estado que o formulário lê. A marca em si chega no snapshot seguinte.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, MARK_PLACE_TIMEOUT_MS, type SocketLike } from './playerConnection'

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

function jogando(ownTokens: string[] = ['ficha-ana']) {
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
  const map = { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [{ id: 'ficha-ana', characterId: null, name: 'Ana', x: 130, y: 170, size: 1, image: null }] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens, concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.sent = []
  return { connection, socket }
}

describe('placeMark', () => {
  it('bilhete: sai no ponto da própria ficha e o estado vira "sending"', () => {
    const { connection, socket } = jogando()
    expect(connection.placeMark({ tipo: 'bilhete', texto: 'volto já' })).toBe(true)
    expect(socket.sent).toEqual([{ type: 'mark.place', x: 130, y: 170, tipo: 'bilhete', texto: 'volto já' }])
    expect(connection.getState().markPlace).toEqual({ phase: 'sending' })
  })

  it('seta: leva o rumo', () => {
    const { connection, socket } = jogando()
    expect(connection.placeMark({ tipo: 'seta', rumo: 'so' })).toBe(true)
    expect(socket.sent).toEqual([{ type: 'mark.place', x: 130, y: 170, tipo: 'seta', rumo: 'so' }])
  })

  it('sem ficha própria no mapa: não envia nada', () => {
    const { connection, socket } = jogando([])
    expect(connection.placeMark({ tipo: 'bilhete', texto: 'oi' })).toBe(false)
    expect(socket.sent).toEqual([])
    expect(connection.getState().markPlace).toBeUndefined()
  })

  it('a resposta do host vira "ok" ou "refused" com o motivo; motivo desconhecido vira o comum', () => {
    const { connection, socket } = jogando()
    connection.placeMark({ tipo: 'bilhete', texto: 'oi' })
    socket.receive({ type: 'mark.place.result', ok: true })
    expect(connection.getState().markPlace).toEqual({ phase: 'ok' })
    connection.placeMark({ tipo: 'bilhete', texto: 'oi' })
    socket.receive({ type: 'mark.place.result', ok: false, reason: 'full' })
    expect(connection.getState().markPlace).toEqual({ phase: 'refused', reason: 'full' })
    connection.placeMark({ tipo: 'bilhete', texto: 'oi' })
    socket.receive({ type: 'mark.place.result', ok: false, reason: 'coisa-nova' })
    expect(connection.getState().markPlace).toEqual({ phase: 'refused', reason: 'unavailable' })
  })

  it('resposta torta ou fora de hora (nada esperando) não mexe no estado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'mark.place.result', ok: true })
    expect(connection.getState().markPlace).toBeUndefined()
    connection.placeMark({ tipo: 'bilhete', texto: 'oi' })
    socket.receive({ type: 'mark.place.result', ok: 'sim' })
    expect(connection.getState().markPlace).toEqual({ phase: 'sending' })
  })

  it('mestre que não responde (antigo, rede lenta): o "Deixando…" não fica para sempre', () => {
    vi.useFakeTimers()
    try {
      const { connection } = jogando()
      connection.placeMark({ tipo: 'bilhete', texto: 'oi' })
      expect(connection.getState().markPlace).toEqual({ phase: 'sending' })
      vi.advanceTimersByTime(MARK_PLACE_TIMEOUT_MS)
      expect(connection.getState().markPlace).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resetMarkPlace esquece o resultado', () => {
    const { connection, socket } = jogando()
    connection.placeMark({ tipo: 'bilhete', texto: 'oi' })
    socket.receive({ type: 'mark.place.result', ok: true })
    connection.resetMarkPlace()
    expect(connection.getState().markPlace).toBeUndefined()
  })
})
