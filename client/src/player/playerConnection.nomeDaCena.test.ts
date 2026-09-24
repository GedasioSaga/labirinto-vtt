/**
 * "ONDE ESTOU" no cliente do jogador: `sceneName` do snapshot vira
 * `state.sceneName`. Snapshot sem o campo (cena sem nome público, mestre
 * antigo) apaga o nome que estava — o selo some. Campo presente e malformado
 * descarta a mensagem inteira, como os outros campos aditivos.
 */
import { describe, expect, it } from 'vitest'
import { SCENE_PUBLIC_NAME_MAX_LENGTH } from '../lib/adventure'
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
  return { connection, socket }
}

function snapshot(rev: number, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map: createEmptyMap(`m${rev}`, '', 10, 10, 50), vision: [], ownTokens: [], concealed: [], ...extra }
}

describe('nome da cena no cliente do jogador', () => {
  it('guarda o nome público do snapshot e troca quando a cena muda', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { sceneName: 'Térreo' }))
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().sceneName).toBe('Térreo')
    socket.receive({ ...snapshot(2, { sceneName: '1º andar' }), type: 'delta' })
    expect(connection.getState().sceneName).toBe('1º andar')
  })

  it('snapshot sem nome (Porão sem nome público) apaga o nome anterior', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { sceneName: '1º andar' }))
    socket.receive(snapshot(2))
    expect(connection.getState().rev).toBe(2)
    expect(connection.getState().sceneName).toBeUndefined()
  })

  it('nome malformado (não é texto, vazio, acima do teto) descarta o snapshot inteiro', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { sceneName: 'Térreo' }))
    socket.receive(snapshot(2, { sceneName: 7 }))
    socket.receive(snapshot(3, { sceneName: '' }))
    socket.receive(snapshot(4, { sceneName: 'x'.repeat(SCENE_PUBLIC_NAME_MAX_LENGTH + 1) }))
    expect(connection.getState().rev).toBe(1)
    expect(connection.getState().sceneName).toBe('Térreo')
  })
})
