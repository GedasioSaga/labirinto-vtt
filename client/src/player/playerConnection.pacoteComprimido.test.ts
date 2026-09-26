// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { comprimirPacote } from '../net/pacoteComprimido'
import { createPlayerConnection } from './playerConnection'
import type { SocketLike, StorageLike } from './playerConnection'

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
  // Sem o evento: no ambiente node não existe `CloseEvent`, e a conexão não o lê.
  onclose: (() => void) | null = null
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
  /** O mestre derrubou a conexão (net_kick, dropReplaced): o `close` chega. */
  serverClose(): void {
    this.readyState = 3
    this.onclose?.()
  }
}

class MemoryStorage implements StorageLike {
  items = new Map<string, string>()
  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
  removeItem(key: string): void {
    this.items.delete(key)
  }
}

function setup(aceitaGzip?: boolean, storage: StorageLike | null = null) {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Ana',
    storage,
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
    // BROADCAST SÓ O QUE MUDOU (outra feature): logo depois do join sai o aviso
    // `view.patches`, na mesma conexão. O join em si continua o que se prova.
    expect(socket.sent).toEqual([{ type: 'join', code: 'ABC123', name: 'Ana', accept: ['gzip'] }, { type: 'view.patches' }])
  })

  it('sem a opção, o join é o de sempre (mestre manda texto)', () => {
    const { socket } = setup()
    socket.open()
    expect(socket.sent).toEqual([{ type: 'join', code: 'ABC123', name: 'Ana' }, { type: 'view.patches' }])
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

  describe('a última palavra do mestre antes de derrubar o socket, atrás de um pacote ainda abrindo', () => {
    /** Já na sala (welcome comum), com resume guardado; depois um snapshot grande comprimido. */
    async function naSalaComPacoteAbrindo() {
      const storage = new MemoryStorage()
      const { connection, socket, sockets } = setup(true, storage)
      socket.open()
      socket.rawReceive(JSON.stringify({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' }))
      expect(connection.getState().playerId).toBe('p1')
      expect(storage.items.size).toBe(1)
      socket.rawReceive(await welcomeComprimido('p1'))
      return { connection, socket, sockets, storage }
    }

    it('kicked seguido do close: o jogador fica expulso, sem resume e sem reconectar', async () => {
      const { connection, socket, sockets, storage } = await naSalaComPacoteAbrindo()
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
      try {
        socket.rawReceive(JSON.stringify({ type: 'kicked' }))
        socket.serverClose()
        await vi.waitFor(() => expect(connection.getState().status).toBe('kicked'))
        expect(storage.items.size).toBe(0)
        // Nenhuma volta sozinha: o expulso não reentra como jogador novo.
        await vi.advanceTimersByTimeAsync(60_000)
        expect(connection.getState().status).toBe('kicked')
        expect(connection.getState().reconnecting).toBeUndefined()
        expect(sockets).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('session.replaced seguido do close: a aba velha fica substituída e não toma a sessão de volta', async () => {
      const { connection, socket, sockets, storage } = await naSalaComPacoteAbrindo()
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
      try {
        socket.rawReceive(JSON.stringify({ type: 'session.replaced' }))
        socket.serverClose()
        await vi.waitFor(() => expect(connection.getState().status).toBe('replaced'))
        // O resume fica: é o mesmo da aba nova.
        expect(storage.items.size).toBe(1)
        await vi.advanceTimersByTimeAsync(60_000)
        expect(connection.getState().status).toBe('replaced')
        expect(connection.getState().reconnecting).toBeUndefined()
        expect(sockets).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('queda sem aviso atrás do pacote: o pacote é lido e só então o jogador volta sozinho', async () => {
      const { connection, socket } = await naSalaComPacoteAbrindo()
      socket.serverClose()
      // A queda espera a fila: enquanto o pacote abre, ainda não é queda.
      expect(connection.getState().reconnecting).toBeUndefined()
      await vi.waitFor(() => expect(connection.getState().reconnecting).toBeDefined())
      expect(connection.getState().playerId).toBe('p1')
      connection.close()
    })

    it('sem pacote na frente, o close é tratado na hora, como antes', () => {
      const { connection, socket } = setup(true)
      socket.open()
      socket.rawReceive(JSON.stringify({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' }))
      socket.serverClose()
      expect(connection.getState().reconnecting).toBeDefined()
      connection.close()
    })
  })
})
