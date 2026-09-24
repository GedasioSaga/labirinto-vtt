/**
 * Ficha sem chão, na tela do jogador: o mestre aceita o arrasto em outro
 * lugar (o chão mais próximo) e manda `landing: 'nearest_floor'`. A ficha vai
 * para onde o mestre disse e a tela mostra, por um instante, por que ela
 * andou para lá. Movimento aceito comum não mostra nada.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, DOOR_NOTICE_TTL_MS, MOVE_NOTICE_TEXT, type SocketLike } from './playerConnection'

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

function mapaComFicha(): MapData {
  return {
    ...createEmptyMap('m1', '', 20, 20, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 100, y: 100, size: 1, image: null }],
  }
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
  socket.receive({ type: 'snapshot', rev: 1, map: mapaComFicha(), vision: [], ownTokens: ['heroi'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

function posicaoDoHeroi(state: ReturnType<ReturnType<typeof jogando>['connection']['getState']>) {
  const t = state.map?.tokens.find((token) => token.id === 'heroi')
  return t === undefined ? null : { x: t.x, y: t.y }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ficha sem chão, na tela do jogador', () => {
  it('aceito no chão mais próximo: a ficha vai para lá e o aviso explica, depois some', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    expect(connection.requestMove('heroi', 150, 100)).toBe(true)
    socket.receive({ type: 'token.move.accepted', reqId: 'm1', x: 350, y: 100, landing: 'nearest_floor' })
    const state = connection.getState()
    expect(posicaoDoHeroi(state)).toEqual({ x: 350, y: 100 })
    expect(state.moveNotice).toMatchObject({ reason: 'nearest_floor' })
    vi.advanceTimersByTime(DOOR_NOTICE_TTL_MS - 1)
    expect(connection.getState().moveNotice).toMatchObject({ reason: 'nearest_floor' })
    vi.advanceTimersByTime(1)
    expect(connection.getState().moveNotice).toBeUndefined()
  })

  it('aceito comum (sem motivo) não mostra aviso', () => {
    const { connection, socket } = jogando()
    connection.requestMove('heroi', 150, 100)
    socket.receive({ type: 'token.move.accepted', reqId: 'm1', x: 150, y: 100 })
    expect(posicaoDoHeroi(connection.getState())).toEqual({ x: 150, y: 100 })
    expect(connection.getState().moveNotice).toBeUndefined()
  })

  it('motivo desconhecido: o movimento vale, mas não inventa aviso', () => {
    const { connection, socket } = jogando()
    connection.requestMove('heroi', 150, 100)
    socket.receive({ type: 'token.move.accepted', reqId: 'm1', x: 160, y: 100, landing: 'inventado' })
    expect(posicaoDoHeroi(connection.getState())).toEqual({ x: 160, y: 100 })
    expect(connection.getState().moveNotice).toBeUndefined()
  })

  it('o texto do aviso diz o que aconteceu com o chão', () => {
    expect(MOVE_NOTICE_TEXT.nearest_floor).toContain('chão')
    expect(MOVE_NOTICE_TEXT.nearest_floor.length).toBeGreaterThan(10)
  })
})
