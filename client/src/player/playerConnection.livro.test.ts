/**
 * LIVRO DE REGRAS no cliente do jogador: o resumo chega com o sistema; o
 * livro só quando ele pede, juntado das partes em qualquer ordem. Recusa,
 * parte torta, queda e prazo deixam o pedido como falho (a tela oferece
 * tentar de novo); sistema novo esquece o livro de antes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resumoDoLivro, sistemaSemLivro } from '../lib/livroDeRegras'
import { createEmptyMap } from '../lib/mapFactory'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { partesDoLivro } from '../net/protocoloDoLivro'
import { createPlayerConnection, LIVRO_PRAZO_MS, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: { type: string; reqId?: string; [chave: string]: unknown }[] = []
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

const SEM_LIVRO = sistemaSemLivro(SISTEMA_ONE_PIECE)
const PARTES = partesDoLivro(SISTEMA_ONE_PIECE) ?? []

function conectado(sistema: unknown = { type: 'rpg.sistema', sistema: SEM_LIVRO, livro: resumoDoLivro(SISTEMA_ONE_PIECE) }) {
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
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  socket.receive(sistema)
  const pedidos = () => socket.sent.filter((m) => m.type === 'livro.pedir')
  /** O host responde o último pedido com as partes, na ordem dada. */
  const responder = (ordem: readonly number[] = PARTES.map((_, i) => i)) => {
    const reqId = pedidos().at(-1)?.reqId
    for (const indice of ordem) socket.receive({ type: 'livro.parte', reqId, indice, total: PARTES.length, texto: PARTES[indice] })
  }
  return { connection, socket, pedidos, responder }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('livro do jogador: o pedido', () => {
  it('o resumo vem com o sistema; o livro não vem sem pedir', () => {
    const { connection, pedidos } = conectado()
    expect(connection.getState().resumoDoLivro).toEqual(resumoDoLivro(SISTEMA_ONE_PIECE))
    expect(connection.getState().sistemaDeRpg?.livro).toBeUndefined()
    expect(connection.getState().livroDeRegras).toBeUndefined()
    expect(pedidos()).toEqual([])
  })

  it('pedir manda o id do sistema; as partes, fora de ordem, viram o livro pronto', () => {
    const { connection, pedidos, responder } = conectado()
    expect(connection.pedirLivro()).toBe(true)
    expect(pedidos()).toEqual([{ type: 'livro.pedir', reqId: expect.any(String), sistemaId: SISTEMA_ONE_PIECE.id }])
    expect(connection.getState().livroDeRegras).toEqual({ estado: 'chegando' })
    responder([...PARTES.keys()].reverse())
    const livro = connection.getState().livroDeRegras
    expect(livro?.estado).toBe('pronto')
    if (livro?.estado !== 'pronto') return
    expect(livro.sistemaId).toBe(SISTEMA_ONE_PIECE.id)
    expect(livro.livro).toEqual(SISTEMA_ONE_PIECE.livro)
    expect(livro.catalogos).toEqual(SISTEMA_ONE_PIECE.catalogos)
  })

  it('chegando ou pronto, pedir de novo não manda outro pedido', () => {
    const { connection, pedidos, responder } = conectado()
    connection.pedirLivro()
    connection.pedirLivro()
    expect(pedidos()).toHaveLength(1)
    responder()
    connection.pedirLivro()
    expect(pedidos()).toHaveLength(1)
  })

  it('sistema sem livro (sem resumo): não pede', () => {
    const { connection, pedidos } = conectado({ type: 'rpg.sistema', sistema: SEM_LIVRO })
    expect(connection.pedirLivro()).toBe(false)
    expect(pedidos()).toEqual([])
  })
})

describe('livro do jogador: quando dá errado', () => {
  it('recusa do host: falhou, e pedir de novo manda outro pedido', () => {
    const { connection, socket, pedidos } = conectado()
    connection.pedirLivro()
    socket.receive({ type: 'livro.recusa', reqId: 'outro' })
    expect(connection.getState().livroDeRegras).toEqual({ estado: 'chegando' })
    socket.receive({ type: 'livro.recusa', reqId: pedidos()[0]?.reqId })
    expect(connection.getState().livroDeRegras).toEqual({ estado: 'falhou' })
    expect(connection.pedirLivro()).toBe(true)
    expect(pedidos()).toHaveLength(2)
  })

  it('parte com total diferente das outras: falhou', () => {
    const { connection, socket, pedidos } = conectado()
    connection.pedirLivro()
    const reqId = pedidos()[0]?.reqId
    socket.receive({ type: 'livro.parte', reqId, indice: 0, total: 3, texto: 'a' })
    socket.receive({ type: 'livro.parte', reqId, indice: 1, total: 4, texto: 'b' })
    expect(connection.getState().livroDeRegras).toEqual({ estado: 'falhou' })
  })

  it('partes que juntam em lixo: falhou', () => {
    const { connection, socket, pedidos } = conectado()
    connection.pedirLivro()
    socket.receive({ type: 'livro.parte', reqId: pedidos()[0]?.reqId, indice: 0, total: 1, texto: '{"sistemaId":' })
    expect(connection.getState().livroDeRegras).toEqual({ estado: 'falhou' })
  })

  it(`sem o livro inteiro em ${LIVRO_PRAZO_MS} ms: falhou`, () => {
    vi.useFakeTimers()
    const { connection } = conectado()
    connection.pedirLivro()
    vi.advanceTimersByTime(LIVRO_PRAZO_MS)
    expect(connection.getState().livroDeRegras).toEqual({ estado: 'falhou' })
  })

  it('sistema novo (ou o mesmo de novo, na volta) esquece o livro e as partes no ar', () => {
    const { connection, socket, responder } = conectado()
    connection.pedirLivro()
    responder()
    socket.receive({ type: 'rpg.sistema', sistema: SEM_LIVRO, livro: resumoDoLivro(SISTEMA_ONE_PIECE) })
    expect(connection.getState().livroDeRegras).toBeUndefined()
    // Parte atrasada do pedido de antes não ressuscita nada.
    socket.receive({ type: 'livro.parte', reqId: 'l1', indice: 0, total: 1, texto: '{}' })
    expect(connection.getState().livroDeRegras).toBeUndefined()
  })
})
