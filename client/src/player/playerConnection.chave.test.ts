/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 2): o servidor da sala manda, como PRIMEIRO frame de cada conexão,
 * `{type:'midia.chave', chave:'<64 hex>'}`. É a prova da conexão em
 * `/sons/<id>`. Vale só para o socket em que chegou: some na queda e nos fins
 * de sessão (kicked, room.closed, session.replaced), e nunca entra no estado
 * (que a tela lê e um log poderia imprimir).
 */
import { describe, expect, it } from 'vitest'
import { createPlayerConnection, TABLE_SCREEN_NAME, type SocketLike } from './playerConnection'

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
  cair(): void {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
  }
}

const CHAVE = '0123456789abcdef'.repeat(4)
const OUTRA = 'fedcba9876543210'.repeat(4)

function conectar(role?: 'table') {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: role === 'table' ? TABLE_SCREEN_NAME : 'Ana',
    storage: null,
    ...(role === 'table' ? { role, tableKey: 'chave-da-tv' } : {}),
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (socket === undefined) throw new Error('socket não criado')
  socket.open()
  return { connection, socket, sockets }
}

describe('playerConnection: a chave da mídia', () => {
  it('nasce sem chave; midia.chave com 64 hex vira a chave (maiúscula também serve)', () => {
    const { connection, socket } = conectar()
    expect(connection.chaveDaMidia()).toBeNull()
    socket.receive({ type: 'midia.chave', chave: CHAVE })
    expect(connection.chaveDaMidia()).toBe(CHAVE)
    socket.receive({ type: 'midia.chave', chave: OUTRA.toUpperCase() })
    expect(connection.chaveDaMidia()).toBe(OUTRA.toUpperCase())
  })

  it('chave torta é ignorada (e a boa de antes fica)', () => {
    const { connection, socket } = conectar()
    for (const torta of ['a'.repeat(63), 'a'.repeat(65), `${'g'.repeat(64)}`, 42, null, undefined, `${CHAVE}\n`, ` ${CHAVE}`]) socket.receive({ type: 'midia.chave', chave: torta })
    expect(connection.chaveDaMidia()).toBeNull()
    socket.receive({ type: 'midia.chave', chave: CHAVE })
    socket.receive({ type: 'midia.chave', chave: 'x'.repeat(64) })
    expect(connection.chaveDaMidia()).toBe(CHAVE)
  })

  it('a tela da mesa também recebe a chave', () => {
    const { connection, socket } = conectar('table')
    socket.receive({ type: 'midia.chave', chave: CHAVE })
    expect(connection.chaveDaMidia()).toBe(CHAVE)
  })

  it('nunca entra no estado da conexão', () => {
    const { connection, socket } = conectar()
    socket.receive({ type: 'midia.chave', chave: CHAVE })
    socket.receive({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok', name: 'Ana' })
    expect(JSON.stringify(connection.getState())).not.toContain(CHAVE)
  })
})

describe('playerConnection: a chave some com o socket e nos fins de sessão', () => {
  it('na queda (e a volta, num socket novo, só vale com a chave nova)', async () => {
    const { connection, socket, sockets } = conectar()
    socket.receive({ type: 'midia.chave', chave: CHAVE })
    socket.receive({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok', name: 'Ana' })
    socket.cair()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(connection.chaveDaMidia()).toBeNull()
    connection.reconnect()
    const novo = sockets.at(-1)
    if (novo === undefined || novo === socket) throw new Error('a volta deveria abrir outro socket')
    novo.open()
    expect(connection.chaveDaMidia()).toBeNull()
    novo.receive({ type: 'midia.chave', chave: OUTRA })
    expect(connection.chaveDaMidia()).toBe(OUTRA)
  })

  for (const fim of [{ type: 'kicked' }, { type: 'room.closed' }, { type: 'session.replaced' }]) {
    it(`em ${fim.type}`, () => {
      const { connection, socket } = conectar()
      socket.receive({ type: 'midia.chave', chave: CHAVE })
      socket.receive({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok', name: 'Ana' })
      socket.receive(fim)
      expect(connection.chaveDaMidia()).toBeNull()
    })
  }
})
