/**
 * UNIÃO ALAVANCA + MAPA POR ANDARES no cliente do jogador. O `reconnect()` foi
 * o conflito da união: cada peça zerava só o próprio campo (`lever` de um
 * lado, `andares` do outro). Aqui as duas coisas convivem no mesmo estado — o
 * aviso da alavanca não apaga as abas dos andares — e a reconexão zera as
 * duas, para a tela não mostrar abas nem aviso de antes enquanto o host não
 * manda o snapshot novo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, markRings } from '../lib/exploration'
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

function salao(): MapData {
  return {
    ...createEmptyMap('m-salao', '', 20, 10, 50),
    pins: [buildPin('alav', { x: 100, y: 100 }, 'alavanca')],
    tokens: [{ id: 'heroi', characterId: null, name: 'Ana', x: 90, y: 100, size: 1, image: null }],
  }
}

function andarB1() {
  const explorado = createExploration({ width: 1000, height: 500, grid: 50 })
  markRings(explorado, [[{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }]])
  return { rotulo: 'B1', map: createEmptyMap('m-porao', '', 20, 10, 50), explored: encodeExploration(explorado), concealed: [] }
}

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
  socket.receive({
    type: 'snapshot',
    rev: 1,
    map: salao(),
    vision: [],
    ownTokens: ['heroi'],
    concealed: [],
    andares: { atual: '1F', outros: [andarB1()] },
  })
  return { connection, socket }
}

describe('união alavanca + andares no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o aviso da alavanca e as abas dos andares convivem no mesmo estado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.lever.answer', answer: 'pulled' })
    const state = connection.getState()
    expect(state.lever?.phase).toBe('pulled')
    expect(state.andares?.atual).toBe('1F')
    expect(state.andares?.outros.map((o) => o.rotulo)).toEqual(['B1'])
    expect(state.map?.pins.find((p) => p.id === 'alav')?.kind).toBe('alavanca')
  })

  it('reconectar zera o aviso da alavanca E as abas dos andares', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.lever.answer', answer: 'pulled' })
    expect(connection.getState().andares?.atual).toBe('1F')
    connection.reconnect()
    const state = connection.getState()
    expect(state.status).toBe('connecting')
    expect(state.lever).toBeUndefined()
    expect(state.andares).toBeUndefined()
    expect(state.map).toBeUndefined()
  })
})
