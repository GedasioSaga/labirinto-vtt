/**
 * RELÓGIO DA CAMPANHA no cliente do jogador: `snapshot.relogio` é aditivo —
 * ausente, sem relógio; presente e malformado, a mensagem inteira é
 * descartada, como os outros campos aditivos. Só o período e o escuro ficam.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
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

const patio = { ...createEmptyMap('m-patio', '', 20, 10, 50), tokens: [{ id: 'heroi', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }] }

function snapshot(rev: number, relogio?: unknown) {
  return { type: 'snapshot', rev, map: patio, vision: [], ownTokens: ['heroi'], concealed: [], ...(relogio === undefined ? {} : { relogio }) }
}

describe('playerConnection: relógio da campanha', () => {
  it('guarda o período e o escuro da cena dele', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { periodo: 'noite', escuro: true }))
    expect(connection.getState().relogio).toEqual({ periodo: 'noite', escuro: true })
    socket.receive(snapshot(2, { periodo: 'manha' }))
    expect(connection.getState().relogio).toEqual({ periodo: 'manha' })
  })

  it('sem o campo: sem relógio', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1))
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().relogio).toBeUndefined()
  })

  it('campo a mais não fica guardado', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { periodo: 'tarde', hora: 15 }))
    expect(connection.getState().relogio).toEqual({ periodo: 'tarde' })
  })

  it('malformado descarta a mensagem inteira', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { periodo: 'tarde' }))
    socket.receive(snapshot(2, { periodo: 'meia-noite' }))
    socket.receive(snapshot(3, { periodo: 'noite', escuro: 'sim' }))
    socket.receive(snapshot(4, 'noite'))
    expect(connection.getState().rev).toBe(1)
    expect(connection.getState().relogio).toEqual({ periodo: 'tarde' })
  })
})
