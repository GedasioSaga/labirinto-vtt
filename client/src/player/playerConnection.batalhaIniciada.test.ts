import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, type SocketLike } from './playerConnection'

/**
 * MODO BATALHA (B5): o `batalha.iniciada` do mestre chega ao jogador (e à TV,
 * que usa a mesma conexão) com a abertura e o nome; o `AberturaDeBatalhaOverlay`
 * toca a partir de `state.batalhaIniciada`. E o `batalha: true` do snapshot
 * liga a grade de batalha (`PlayerView` prop `batalha`).
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
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', 'Mapa', 10, 10, 50), vision: [] })
  return { connection, socket }
}

describe('playerConnection: batalha.iniciada (B5)', () => {
  it('leva a transição e o texto para o estado, com id novo a cada aviso', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'batalha.iniciada', transicao: 'espadas-cruzadas', texto: 'Royals' })
    const primeira = connection.getState().batalhaIniciada
    expect(primeira).toMatchObject({ transicao: 'espadas-cruzadas', texto: 'Royals' })
    socket.receive({ type: 'batalha.iniciada', transicao: 'espadas-cruzadas', texto: 'Royals' })
    const segunda = connection.getState().batalhaIniciada
    expect(segunda?.id).not.toBe(primeira?.id)
  })

  it('"Nenhuma": sem transição, o estado também não tem (o overlay não aparece)', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'batalha.iniciada', texto: 'Royals' })
    const aviso = connection.getState().batalhaIniciada
    expect(aviso).toBeDefined()
    expect(aviso?.transicao).toBeUndefined()
    expect(aviso?.texto).toBe('Royals')
  })

  it('aviso torto (texto com quebra de linha) não muda nada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'batalha.iniciada', transicao: 'espadas-cruzadas', texto: 'Roy\nals' })
    expect(connection.getState().batalhaIniciada).toBeUndefined()
  })

  it('snapshot com `batalha: true` liga a batalha; sem o campo, desliga', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m1', 'Mapa', 10, 10, 50), vision: [], batalha: true })
    expect(connection.getState().batalha).toBe(true)
    socket.receive({ type: 'snapshot', rev: 3, map: createEmptyMap('m1', 'Mapa', 10, 10, 50), vision: [] })
    expect(connection.getState().batalha).toBeUndefined()
  })
})
