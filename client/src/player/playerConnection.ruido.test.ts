/**
 * RUÍDO NO MAPA no cliente do jogador: `noise` vira `state.noise` (id e
 * direção, nada mais), que some sozinho depois de `NOISE_CUE_TTL_MS`. Forma
 * errada cai inteira; campo a mais (posição) nunca chega ao estado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { NOISE_CUE_TTL_MS } from '../lib/noise'
import { parseNoiseMessage } from '../net/protocol'
import { createPlayerConnection, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
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

function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return mesa
}

describe('parseNoiseMessage', () => {
  it('aceita id e direção conhecida, e devolve só esses campos', () => {
    expect(parseNoiseMessage({ type: 'noise', id: 'r1', dir: 'ne', x: 10, y: 20, source: 'Carnical' })).toEqual({ type: 'noise', id: 'r1', dir: 'ne' })
  })

  it('direção desconhecida, id vazio ou tipo errado: recusa', () => {
    expect(parseNoiseMessage({ type: 'noise', id: 'r1', dir: 'norte' })).toBeNull()
    expect(parseNoiseMessage({ type: 'noise', id: '', dir: 'n' })).toBeNull()
    expect(parseNoiseMessage({ type: 'noise', id: 'r1' })).toBeNull()
    expect(parseNoiseMessage({ type: 'signal', id: 'r1', dir: 'n' })).toBeNull()
    expect(parseNoiseMessage(null)).toBeNull()
  })
})

describe('noise no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('jogando: vira state.noise só com id e direção', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'noise', id: 'r1', dir: 'w', x: 999, y: 111 })
    expect(connection.getState().noise).toEqual({ id: 'r1', dir: 'w' })
    expect(JSON.stringify(connection.getState())).not.toContain('999')
  })

  it('some sozinho depois do prazo; ruído novo toma o lugar e renova o prazo', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'noise', id: 'r1', dir: 'n' })
    vi.advanceTimersByTime(NOISE_CUE_TTL_MS - 100)
    socket.receive({ type: 'noise', id: 'r2', dir: 's' })
    expect(connection.getState().noise).toEqual({ id: 'r2', dir: 's' })
    vi.advanceTimersByTime(200)
    // O prazo do primeiro venceu, mas o segundo continua na tela.
    expect(connection.getState().noise).toEqual({ id: 'r2', dir: 's' })
    vi.advanceTimersByTime(NOISE_CUE_TTL_MS)
    expect(connection.getState().noise).toBeUndefined()
  })

  it('fora do jogo ou com forma errada: nada muda', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'noise', id: 'r1', dir: 'n' })
    expect(connection.getState().noise).toBeUndefined()
    const mesa = jogando()
    mesa.socket.receive({ type: 'noise', id: 'r1', dir: 'cima' })
    expect(mesa.connection.getState().noise).toBeUndefined()
  })

  it('trocar de cena ou voltar a esperar apaga o ruído da cena de antes', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'noise', id: 'r1', dir: 'e' })
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().noise).toBeUndefined()
    socket.receive({ type: 'noise', id: 'r2', dir: 'e' })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().noise).toBeUndefined()
  })
})
