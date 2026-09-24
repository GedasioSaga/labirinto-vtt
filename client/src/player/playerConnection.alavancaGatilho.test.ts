/**
 * UNIÃO ALAVANCA + GATILHO DE ÁREA no cliente do jogador. O `reconnect()` foi
 * o conflito da união: cada peça zerava só o próprio campo. Aqui as duas
 * coisas convivem no mesmo estado — o aviso da alavanca não apaga o gatilho —
 * e a reconexão zera as duas, para a tela não pintar o gatilho nem o aviso
 * de antes enquanto o host não manda o snapshot novo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

const TRIANGULO = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

function mapa(): MapData {
  return {
    ...createEmptyMap('m1', '', 10, 10, 50),
    pins: [buildPin('alav', { x: 100, y: 100 }, 'alavanca')],
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
  socket.receive({
    type: 'snapshot',
    rev: 1,
    map: mapa(),
    vision: [],
    ownTokens: ['diego'],
    concealed: [],
    gatilhos: [{ kind: 'alarme', points: TRIANGULO }],
  })
  return { connection, socket }
}

describe('união alavanca + gatilho no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o aviso da alavanca e o gatilho revelado convivem no mesmo estado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.lever.answer', answer: 'pulled' })
    const state = connection.getState()
    expect(state.lever?.phase).toBe('pulled')
    expect(state.gatilhos).toEqual([{ kind: 'alarme', points: TRIANGULO }])
    expect(state.map?.pins.find((p) => p.id === 'alav')?.kind).toBe('alavanca')
  })

  it('reconectar zera o aviso da alavanca E o gatilho', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.lever.answer', answer: 'pulled' })
    connection.reconnect()
    const state = connection.getState()
    expect(state.status).toBe('connecting')
    expect(state.lever).toBeUndefined()
    expect(state.gatilhos).toBeUndefined()
    expect(state.map).toBeUndefined()
  })
})
