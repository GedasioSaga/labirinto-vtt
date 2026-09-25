/**
 * ESCONDER-SE no cliente do jogador: `requestHide` manda o pedido e mostra
 * "aguardando o mestre"; a recusa vira aviso que some sozinho; o snapshot com
 * a própria ficha já oculta (`secret`) encerra a espera — é assim que o
 * jogador sabe que o mestre deixou.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { createPlayerConnection, HIDE_NOTICE_TTL_MS, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(data: string): void {
    const message: unknown = JSON.parse(data)
    this.sent.push(message)
    // Host vivo responde ao ping: a espera do aviso não derruba a conexão.
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'ping') this.receive({ type: 'pong' })
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
    name: 'Duda',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Duda' })
  return { connection, socket }
}

const minha = (extra: Partial<Token> = {}): Token => ({ id: 'ficha-duda', characterId: null, name: 'Duda', x: 100, y: 100, size: 1, image: null, ...extra })

function snapshotCom(rev: number, tokens: Token[]) {
  return { type: 'snapshot', rev, map: { ...createEmptyMap('m1', '', 10, 10, 50), tokens }, vision: [], ownTokens: tokens.map((t) => t.id), concealed: [] }
}

function snapshot(rev: number, token: Token) {
  return snapshotCom(rev, [token])
}

describe('esconder-se no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('requestHide manda o pedido da própria ficha e fica aguardando o mestre', () => {
    const { connection, socket } = conectado()
    expect(connection.requestHide('ficha-duda')).toBe(false) // ainda sem mapa
    socket.receive(snapshot(1, minha()))
    expect(connection.requestHide('ficha-de-outro')).toBe(false)
    expect(connection.requestHide('ficha-duda')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'token.hide.request', tokenId: 'ficha-duda' })
    expect(connection.getState().hide?.phase).toBe('waiting')
    // Esperando, um segundo toque não manda de novo.
    const enviados = socket.sent.length
    expect(connection.requestHide('ficha-duda')).toBe(false)
    expect(socket.sent.length).toBe(enviados)
  })

  it('ficha já escondida: não há o que pedir', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, minha({ secret: true })))
    const enviados = socket.sent.length
    expect(connection.requestHide('ficha-duda')).toBe(false)
    expect(socket.sent.length).toBe(enviados)
    expect(connection.getState().hide).toBeUndefined()
  })

  it('"Não" do mestre vira aviso, que some sozinho; motivo desconhecido é ignorado', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, minha()))
    connection.requestHide('ficha-duda')
    socket.receive({ type: 'token.hide.rejected', reason: 'denied' })
    expect(connection.getState().hide).toMatchObject({ phase: 'rejected', reason: 'denied' })
    vi.advanceTimersByTime(HIDE_NOTICE_TTL_MS)
    expect(connection.getState().hide).toBeUndefined()
    socket.receive({ type: 'token.hide.rejected', reason: 'outro' })
    expect(connection.getState().hide).toBeUndefined()
  })

  it('o snapshot com a própria ficha oculta encerra a espera', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, minha()))
    connection.requestHide('ficha-duda')
    socket.receive(snapshot(2, minha()))
    expect(connection.getState().hide?.phase).toBe('waiting')
    socket.receive(snapshot(3, minha({ secret: true })))
    expect(connection.getState().hide).toBeUndefined()
  })

  it('só a ficha pedida encerra a espera: outra ficha própria já oculta não conta', () => {
    const { connection, socket } = conectado()
    // Duda tem duas fichas; o Cavalo o mestre já tinha deixado oculto.
    const cavalo: Token = { id: 'ficha-cavalo', characterId: null, name: 'Cavalo', x: 200, y: 100, size: 1, image: null, secret: true }
    socket.receive(snapshotCom(1, [minha(), cavalo]))
    expect(connection.requestHide('ficha-duda')).toBe(true)
    // Qualquer movimento na mesa: o snapshot comum ainda traz o Cavalo oculto.
    socket.receive(snapshotCom(2, [minha({ x: 150 }), cavalo]))
    expect(connection.getState().hide?.phase).toBe('waiting')
    // O mestre deixou: agora é a ficha pedida que chega oculta.
    socket.receive(snapshotCom(3, [minha({ x: 150, secret: true }), cavalo]))
    expect(connection.getState().hide).toBeUndefined()
  })

  it('a ficha pedida muda de dono: a espera acaba e o Cavalo, que ficou, pode pedir', () => {
    const { connection, socket } = conectado()
    const cavalo: Token = { id: 'ficha-cavalo', characterId: null, name: 'Cavalo', x: 200, y: 100, size: 1, image: null }
    socket.receive(snapshotCom(1, [minha(), cavalo]))
    expect(connection.requestHide('ficha-duda')).toBe(true)
    // O mestre passa a ficha-duda para o Enzo: ela some do ownTokens (e do mapa) da Duda.
    socket.receive(snapshotCom(2, [cavalo]))
    expect(connection.getState().ownTokens).toEqual(['ficha-cavalo'])
    expect(connection.getState().hide).toBeUndefined()
    expect(connection.requestHide('ficha-cavalo')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'token.hide.request', tokenId: 'ficha-cavalo' })
  })

  it('a recusa "unavailable" do host também encerra a espera, antes mesmo do snapshot', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, minha()))
    connection.requestHide('ficha-duda')
    socket.receive({ type: 'token.hide.rejected', reason: 'unavailable' })
    expect(connection.getState().hide).toMatchObject({ phase: 'rejected', reason: 'unavailable' })
    vi.advanceTimersByTime(HIDE_NOTICE_TTL_MS)
    expect(connection.getState().hide).toBeUndefined()
  })

  it('reconectar esquece a espera: o host já esqueceu o pedido', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, minha()))
    connection.requestHide('ficha-duda')
    expect(connection.getState().hide?.phase).toBe('waiting')
    connection.reconnect()
    expect(connection.getState().hide).toBeUndefined()
  })
})
