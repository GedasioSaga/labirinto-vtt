/**
 * DIA/TARDE/NOITE no cliente do jogador (Luz L1): `snapshot.luz` é aditivo —
 * ausente, dia; presente e malformado, a mensagem inteira é descartada, como
 * os outros campos aditivos. Só período, cor e força ficam (pacote forjado
 * com campo a mais perde o campo). O `relogio` de mestre antigo é ignorado.
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
const NOITE = { periodo: 'noite', cor: '#465a92', forca: 0.85 }

function snapshot(rev: number, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map: patio, vision: [], ownTokens: ['heroi'], concealed: [], ...extra }
}

describe('playerConnection: período da cena dele', () => {
  it('guarda o período e a tinta; o snapshot sem o campo volta ao dia', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { luz: NOITE }))
    expect(connection.getState().luz).toEqual(NOITE)
    socket.receive(snapshot(2))
    expect(connection.getState().luz).toBeUndefined()
  })

  it('pacote forjado: campo a mais não fica guardado', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { luz: { ...NOITE, periodoFixo: 'noite', acesaEm: ['noite'], hora: 22 } }))
    expect(connection.getState().luz).toEqual(NOITE)
  })

  it('malformado descarta a mensagem inteira', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { luz: NOITE }))
    socket.receive(snapshot(2, { luz: { ...NOITE, periodo: 'meia-noite' } }))
    socket.receive(snapshot(3, { luz: { ...NOITE, forca: 3 } }))
    socket.receive(snapshot(4, { luz: 'noite' }))
    expect(connection.getState().rev).toBe(1)
    expect(connection.getState().luz).toEqual(NOITE)
  })

  it('o relógio de mestre antigo é ignorado: nada de hora guardada', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { relogio: { periodo: 'noite', escuro: true } }))
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().luz).toBeUndefined()
    expect('relogio' in connection.getState()).toBe(false)
  })
})
