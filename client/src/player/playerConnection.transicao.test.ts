/**
 * TRANSIÇÃO ESPECIAL no cliente do jogador: atravessar um pino que tem uma
 * liga `state.transicao`; ser levado pelo mestre, reunido ou ir a bordo não.
 * Na escada da mesma cena, o toque já toca a da escada.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Stair } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

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

const PORTA: Pin = { id: 'porta', x: 100, y: 100, kind: 'viagem', description: '', image: null, transicao: { id: 'porta', duracaoS: 4 } }
const SEM_TRANSICAO: Pin = { id: 'beco', x: 200, y: 100, kind: 'viagem', description: '', image: null }
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 100, y1: 100, x2: 100, y2: 180 }], stepWidth: 40, levaAoPiso: 1, transicao: { id: 'escada-pedra' } }

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
  const map = { ...createEmptyMap('m1', '', 10, 10, 50), pins: [PORTA, SEM_TRANSICAO], stairs: [ESCADA] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: [], concealed: [] })
  return { connection, socket }
}

describe('transição especial no cliente do jogador', () => {
  it('pediu pelo pino com transição e chegou: toca a do pino, uma vez por travessia', () => {
    const { connection, socket } = conectado()
    expect(connection.requestTravel('porta')).toBe(true)
    socket.receive({ type: 'scene.changed' })
    const primeira = connection.getState().transicao
    expect(primeira?.escolha).toEqual({ id: 'porta', duracaoS: 4 })
    // A próxima chegada pelo mesmo pino é outra travessia: outro nonce.
    socket.receive({ type: 'snapshot', rev: 2, map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [PORTA] }, vision: [], ownTokens: [], concealed: [] })
    expect(connection.requestTravel('porta')).toBe(true)
  })

  it('pino sem transição: chega direto', () => {
    const { connection, socket } = conectado()
    connection.requestTravel('beco')
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().transicao).toBeUndefined()
  })

  it('levado pelo mestre, reunido ou a bordo depois de pedir: sem transição', () => {
    for (const by of ['master', 'gather', 'veiculo']) {
      const { connection, socket } = conectado()
      connection.requestTravel('porta')
      socket.receive({ type: 'scene.changed', by })
      expect(connection.getState().transicao).toBeUndefined()
    }
  })

  it('escada da mesma cena: o toque toca a transição da escada', () => {
    const { connection, socket } = conectado()
    expect(connection.changeFloor('ficha', 'escada')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'token.piso', tokenId: 'ficha', stairId: 'escada' })
    expect(connection.getState().transicao?.escolha).toEqual({ id: 'escada-pedra' })
  })
})
