/**
 * ANDAR ATÉ AQUI no cliente do jogador: o caminho sai em TRECHOS, um de cada
 * vez, e o próximo só sai depois que o host aceitou o anterior (e a ficha
 * teve tempo de deslizar até a esquina). Recusa do host, ou o jogador mexendo
 * a ficha com o dedo, param a caminhada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, WALK_LEG_PAUSE_MS, type SocketLike } from './playerConnection'

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
  moves(): { reqId: string; x: number; y: number }[] {
    return this.sent.flatMap((m) => {
      if (typeof m !== 'object' || m === null || !('type' in m) || m.type !== 'token.move') return []
      if (!('reqId' in m) || !('x' in m) || !('y' in m)) return []
      const { reqId, x, y } = m
      return typeof reqId === 'string' && typeof x === 'number' && typeof y === 'number' ? [{ reqId, x, y }] : []
    })
  }
}

const ENZO = { id: 'enzo', characterId: null, name: 'Enzo', x: 300, y: 300, size: 1, image: null }
const CAMINHO = [
  { x: 350, y: 120 },
  { x: 650, y: 120 },
  { x: 700, y: 300 },
]

function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Enzo',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Enzo' })
  socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('capital', '', 20, 12, 50), tokens: [ENZO] }, vision: [], ownTokens: ['enzo'], concealed: [] })
  return { connection, socket }
}

function aceita(socket: FakeSocket, indice: number): void {
  const move = socket.moves()[indice]
  if (!move) throw new Error(`trecho ${indice} não saiu`)
  socket.receive({ type: 'token.move.accepted', reqId: move.reqId, x: move.x, y: move.y })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('requestWalk: andar até aqui em trechos validados pelo host', () => {
  it('manda só o primeiro trecho; o seguinte sai depois do aceite e da pausa do deslize', () => {
    const { connection, socket } = jogando()
    expect(connection.requestWalk('enzo', CAMINHO)).toBe(true)
    expect(socket.moves().map(({ x, y }) => ({ x, y }))).toEqual([{ x: 350, y: 120 }])
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 350, y: 120 })

    aceita(socket, 0)
    expect(socket.moves()).toHaveLength(1)
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS)
    expect(socket.moves().map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 350, y: 120 },
      { x: 650, y: 120 },
    ])

    aceita(socket, 1)
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS)
    aceita(socket, 2)
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS * 3)
    expect(socket.moves().map(({ x, y }) => ({ x, y }))).toEqual(CAMINHO)
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 700, y: 300 })
  })

  it('recusa do host para a caminhada: a ficha volta à última esquina aceita e o aviso aparece', () => {
    const { connection, socket } = jogando()
    connection.requestWalk('enzo', CAMINHO)
    aceita(socket, 0)
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS)
    const segundo = socket.moves()[1]
    if (!segundo) throw new Error('segundo trecho não saiu')
    socket.receive({ type: 'token.move.rejected', reqId: segundo.reqId, reason: 'wall' })
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS * 3)
    expect(socket.moves()).toHaveLength(2)
    expect(connection.getState().map?.tokens[0]).toMatchObject({ x: 350, y: 120 })
    expect(connection.getState().moveNotice?.reason).toBe('wall')
  })

  it('o jogador arrasta a ficha no meio do caminho: a caminhada para e o arrasto vale', () => {
    const { connection, socket } = jogando()
    connection.requestWalk('enzo', CAMINHO)
    expect(connection.requestMove('enzo', 330, 200)).toBe(true)
    aceita(socket, 0)
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS * 3)
    expect(socket.moves().map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 350, y: 120 },
      { x: 330, y: 200 },
    ])
  })

  it('troca de cena no meio: o resto do caminho (da cena velha) não sai', () => {
    const { connection, socket } = jogando()
    connection.requestWalk('enzo', CAMINHO)
    aceita(socket, 0)
    socket.receive({ type: 'snapshot', rev: 2, map: { ...createEmptyMap('porto', '', 20, 12, 50), tokens: [ENZO] }, vision: [], ownTokens: ['enzo'], concealed: [] })
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS * 3)
    expect(socket.moves()).toHaveLength(1)
  })

  it('caminho vazio, ficha que não está no mapa ou ponto inválido: nada sai', () => {
    const { connection, socket } = jogando()
    expect(connection.requestWalk('enzo', [])).toBe(false)
    expect(connection.requestWalk('bruno', CAMINHO)).toBe(false)
    expect(connection.requestWalk('enzo', [{ x: Number.NaN, y: 10 }])).toBe(false)
    expect(socket.moves()).toEqual([])
  })
})
