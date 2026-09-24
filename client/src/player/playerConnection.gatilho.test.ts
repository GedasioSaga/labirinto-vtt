/**
 * GATILHO DE ÁREA no cliente do jogador: `snapshot.gatilhos` (só o que o
 * mestre revelou) vira `state.gatilhos`, o que a tela pinta. Snapshot sem o
 * campo apaga; forma errada derruba a mensagem inteira.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
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
  return { connection, socket }
}

const TRIANGULO = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

function snapshot(rev: number, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [], ...extra }
}

describe('gatilho de área no cliente do jogador', () => {
  it('snapshot com gatilho revelado vira state.gatilhos; o seguinte sem o campo apaga', () => {
    const { connection, socket } = jogando()
    socket.receive(snapshot(1, { gatilhos: [{ kind: 'armadilha', points: TRIANGULO }] }))
    expect(connection.getState().gatilhos).toEqual([{ kind: 'armadilha', points: TRIANGULO }])
    socket.receive(snapshot(2))
    expect(connection.getState().gatilhos).toEqual([])
  })

  it('gatilho malformado derruba a mensagem inteira', () => {
    const { connection, socket } = jogando()
    socket.receive(snapshot(1))
    socket.receive(snapshot(2, { gatilhos: [{ kind: 'mina', points: TRIANGULO }] }))
    expect(connection.getState().rev).toBe(1)
    expect(connection.getState().gatilhos).toEqual([])
  })
})
