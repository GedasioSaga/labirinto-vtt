// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { comprimirPacote } from '../net/pacoteComprimido'
import { createPlayerConnection } from './playerConnection'
import type { SocketLike } from './playerConnection'

/**
 * PACOTE COMPRIMIDO pelo lado do jogador: quem sabe abrir gzip diz isso no
 * `join`; o envelope `{"gz":...}` que o mestre manda é aberto e lido como a
 * mensagem de dentro, e o que chega atrás dele espera — a ordem é a do mestre.
 */

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
  close(): void {
    this.readyState = 3
  }
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  rawReceive(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}

function setup(aceitaGzip?: boolean) {
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
    ...(aceitaGzip === undefined ? {} : { aceitaGzip }),
  })
  const socket = sockets[0]
  if (socket === undefined) throw new Error('socket não criado')
  return { connection, socket, sockets }
}

/** Welcome com nome comprido o bastante para passar do limite de compressão. */
async function welcomeComprimido(playerId: string): Promise<string> {
  const texto = JSON.stringify({ type: 'welcome', playerId, resumeToken: 'tok', name: 'Ana', enchimento: 'x'.repeat(40_000) })
  const pacote = await comprimirPacote(texto)
  if (pacote === null) throw new Error('deveria ir comprimido')
  return JSON.stringify(pacote)
}

describe('playerConnection: pacote comprimido', () => {
  it('quem sabe abrir gzip declara no join', () => {
    const { socket } = setup(true)
    socket.open()
    expect(socket.sent).toEqual([{ type: 'join', code: 'ABC123', name: 'Ana', accept: ['gzip'] }])
  })

  it('sem a opção, o join é o de sempre (mestre manda texto)', () => {
    const { socket } = setup()
    socket.open()
    expect(socket.sent).toEqual([{ type: 'join', code: 'ABC123', name: 'Ana' }])
  })

  it('o envelope é aberto e lido como a mensagem de dentro', async () => {
    const { connection, socket } = setup(true)
    socket.open()
    socket.rawReceive(await welcomeComprimido('p1'))
    await vi.waitFor(() => expect(connection.getState().playerId).toBe('p1'))
    expect(connection.getState().status).toBe('waiting')
  })

  it('a mensagem que chega atrás do pacote espera por ele: a última palavra é a do mestre', async () => {
    const { connection, socket } = setup(true)
    socket.open()
    const primeiro = await welcomeComprimido('p1')
    socket.rawReceive(primeiro)
    socket.rawReceive(JSON.stringify({ type: 'welcome', playerId: 'p2', resumeToken: 'tok2', name: 'Ana' }))
    // O pacote ainda está abrindo: a mensagem de trás não passou na frente.
    expect(connection.getState().playerId).toBeUndefined()
    await vi.waitFor(() => expect(connection.getState().playerId).toBe('p2'))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(connection.getState().playerId).toBe('p2')
  })

  it('pacote que chega depois de a conexão trocar de socket não é lido', async () => {
    const { connection, socket } = setup(true)
    socket.open()
    const pacote = await welcomeComprimido('p1')
    socket.rawReceive(pacote)
    connection.close()
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
    expect(connection.getState().playerId).toBeUndefined()
  })
})
