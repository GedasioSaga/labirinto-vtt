import { afterEach, describe, expect, it, vi } from 'vitest'
import { addToken, createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

/** Eco do sinal no jogador: `unheard: true` do host vira sinal tracejado (`unheard` no SignalMark). Contrato do campo em net/protocol.ts. */

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
  return addToken(createEmptyMap('m1', 'Mapa', 10, 10, 50), { id: 't1', characterId: null, name: 'Aria', x: 10, y: 10, size: 1, image: null })
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
  socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [] })
  return { connection, socket }
}

const ECO = { type: 'signal', x: 5, y: 6, from: 'Ana', color: '#64b5f6' }

afterEach(() => {
  vi.useRealTimers()
})

describe('playerConnection: eco do sinal com unheard', () => {
  it('eco sem unheard: o sinal sai cheio', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    socket.receive(ECO)
    const [sinal] = connection.getState().signals ?? []
    expect(sinal).toMatchObject({ x: 5, y: 6, name: 'Ana', color: '#64b5f6' })
    expect(sinal?.unheard).toBeUndefined()
  })

  it('eco com unheard (nenhum colega à vista vê o ponto; não é "ninguém recebeu"): vira sinal tracejado', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    socket.receive({ ...ECO, unheard: true })
    expect(connection.getState().signals).toEqual([expect.objectContaining({ x: 5, y: 6, name: 'Ana', unheard: true })])
  })

  it('unheard que não é true (texto, 1, objeto) é ignorado: o sinal sai cheio', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    for (const unheard of ['true', 1, {}, false]) socket.receive({ ...ECO, unheard })
    const sinais = connection.getState().signals ?? []
    expect(sinais).toHaveLength(4)
    expect(sinais.map((s) => s.unheard)).toEqual([undefined, undefined, undefined, undefined])
  })
})
