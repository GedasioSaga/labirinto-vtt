/**
 * ESPIAR PELA PASSAGEM no cliente do jogador: o pedido só sai de pino que dá
 * vista, o recorte vira `state.pinPeek` por alguns segundos e some sozinho — sem
 * tocar no mapa, na névoa nem na memória que a tela guarda.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { ESPIADA_MAX_FICHAS, type Espiada } from '../lib/espiar'
import type { MapData, Pin } from '../types/map'
import { createPlayerConnection, PEEK_NOTICE_TTL_MS, PEEK_WAIT_TIMEOUT_MS, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(data: string): void {
    const message: unknown = JSON.parse(data)
    // Host vivo responde ao ping (a prova de vida da conexão): a espera da
    // espiada passa do prazo de silêncio sem derrubar o socket. O ping não
    // entra em `sent`, que guarda só o que o jogador pediu.
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'ping') {
      this.receive({ type: 'pong' })
      return
    }
    this.sent.push(message)
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

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 200, y: 200, kind: 'viagem', description: '', image: null, ...extra }
}

const MAPA: MapData = {
  ...createEmptyMap('m1', '', 10, 10, 50),
  pins: [pino('grade', { daVista: 3 }), pino('porta'), pino('bau', { kind: 'exclamacao', daVista: 3 })],
}

const VISTA: Espiada = {
  raio: 150,
  grid: 50,
  vision: [
    [
      { x: -150, y: 0 },
      { x: 0, y: -150 },
      { x: 150, y: 0 },
    ],
  ],
  walls: [],
  doors: [],
  tokens: [{ x: 0, y: -80, size: 1, color: '#c0392b' }],
  concealed: [],
  roofs: [],
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
  socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.sent = []
  return { connection, socket, sockets }
}

describe('playerConnection: espiar pela passagem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pede pelo pino que dá vista e espera', () => {
    const { connection, socket } = jogando()
    expect(connection.peek('grade')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'pin.peek', pinId: 'grade' }])
    expect(connection.getState().pinPeek).toMatchObject({ phase: 'waiting', pinId: 'grade' })
  })

  it('pino sem "Dá vista", que não é de viagem ou que não está no mapa: nada sai', () => {
    const { connection, socket } = jogando()
    expect(connection.peek('porta')).toBe(false)
    expect(connection.peek('bau')).toBe(false)
    expect(connection.peek('sumiu')).toBe(false)
    expect(socket.sent).toEqual([])
    expect(connection.getState().pinPeek).toBeUndefined()
  })

  it('o recorte aparece e some sozinho no tempo do host, sem mexer no mapa nem na névoa', () => {
    const { connection, socket } = jogando()
    connection.peek('grade')
    const antes = connection.getState()
    socket.receive({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: VISTA })
    const vendo = connection.getState()
    expect(vendo.pinPeek).toMatchObject({ phase: 'showing', pinId: 'grade', view: VISTA, durationMs: 4000 })
    expect(vendo.map).toBe(antes.map)
    expect(vendo.vision).toBe(antes.vision)
    expect(vendo.explored).toBe(antes.explored)
    vi.advanceTimersByTime(3999)
    expect(connection.getState().pinPeek?.phase).toBe('showing')
    vi.advanceTimersByTime(1)
    expect(connection.getState().pinPeek).toBeUndefined()
  })

  it('recorte que ninguém pediu (ou de outro pino) é ignorado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: VISTA })
    expect(connection.getState().pinPeek).toBeUndefined()
    connection.peek('grade')
    socket.receive({ type: 'pin.peek.view', pinId: 'outro', durationMs: 4000, view: VISTA })
    expect(connection.getState().pinPeek?.phase).toBe('waiting')
  })

  it('a recusa vira aviso curto, que some sozinho', () => {
    const { connection, socket } = jogando()
    connection.peek('grade')
    socket.receive({ type: 'pin.peek.rejected', pinId: 'grade', reason: 'unavailable' })
    expect(connection.getState().pinPeek).toMatchObject({ phase: 'rejected', reason: 'unavailable' })
    vi.advanceTimersByTime(PEEK_NOTICE_TTL_MS)
    expect(connection.getState().pinPeek).toBeUndefined()
  })

  it('fechar na mão, trocar de cena ou voltar à espera tiram o recorte da tela', () => {
    const { connection, socket } = jogando()
    connection.peek('grade')
    socket.receive({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: VISTA })
    connection.dismissPeek()
    expect(connection.getState().pinPeek).toBeUndefined()

    vi.advanceTimersByTime(4000)
    connection.peek('grade')
    socket.receive({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: VISTA })
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().pinPeek).toBeUndefined()

    socket.receive({ type: 'snapshot', rev: 2, map: MAPA, vision: [], ownTokens: [], concealed: [] })
    connection.peek('grade')
    socket.receive({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: VISTA })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().pinPeek).toBeUndefined()
  })

  it('recorte ilegível (acima dos tetos) para o pedido em curso: sai do "Olhando…" com aviso, e dá para pedir de novo', () => {
    const { connection, socket } = jogando()
    connection.peek('grade')
    const multidao = Array.from({ length: ESPIADA_MAX_FICHAS + 1 }, () => ({ x: 0, y: 0, size: 1, color: '#ffffff' }))
    socket.receive({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: { ...VISTA, tokens: multidao } })
    expect(connection.getState().pinPeek).toMatchObject({ phase: 'rejected', pinId: 'grade', reason: 'failed' })
    vi.advanceTimersByTime(PEEK_NOTICE_TTL_MS)
    expect(connection.getState().pinPeek).toBeUndefined()
    expect(connection.peek('grade')).toBe(true)
  })

  it('sem resposta do host: o "Olhando…" desiste sozinho no tempo-limite', () => {
    const { connection } = jogando()
    connection.peek('grade')
    vi.advanceTimersByTime(PEEK_WAIT_TIMEOUT_MS - 1)
    expect(connection.getState().pinPeek?.phase).toBe('waiting')
    vi.advanceTimersByTime(1)
    expect(connection.getState().pinPeek).toMatchObject({ phase: 'rejected', pinId: 'grade', reason: 'failed' })
    expect(connection.peek('grade')).toBe(true)
  })

  it('reconectar com a espiada esperando ou na tela limpa a espiada: nada fica preso nem volta sem fim', () => {
    const { connection, socket, sockets } = jogando()
    connection.peek('grade')
    connection.reconnect()
    expect(connection.getState().pinPeek).toBeUndefined()

    const novo = voltar(connection, sockets)
    expect(novo).not.toBe(socket)
    // A resposta ao pedido de antes ia para a conexão velha: pedir de novo precisa valer.
    expect(connection.peek('grade')).toBe(true)
    novo.receive({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: VISTA })
    expect(connection.getState().pinPeek?.phase).toBe('showing')
    connection.reconnect()
    expect(connection.getState().pinPeek).toBeUndefined()
    voltar(connection, sockets)
    expect(connection.getState().pinPeek).toBeUndefined()
  })
})

/** Termina a reconexão: o socket mais novo abre e o host devolve a sessão. */
function voltar(connection: ReturnType<typeof jogando>['connection'], sockets: readonly FakeSocket[]): FakeSocket {
  const socket = sockets[sockets.length - 1]
  if (socket === undefined) throw new Error('socket não criado')
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
  socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando de novo')
  return socket
}
