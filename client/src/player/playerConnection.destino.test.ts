import { describe, expect, it } from 'vitest'
import { createEmptyMap, addToken } from '../lib/mapFactory'
import { MAX_DESTINATION_MARKS } from '../lib/signals'
import { parseDestinationsMessage, parsePlayerMessage } from '../net/protocol'
import type { MapData } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

/**
 * MARCA "VAMOS PARA CÁ" no cliente do jogador: pedir e tirar a própria marca,
 * e guardar as marcas que o host mandou (sem prazo: ficam até o host mandar
 * outra lista). O que vem torto do host não entra na tela.
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

function mapa(): MapData {
  return addToken(createEmptyMap('m1', 'Mapa', 10, 10, 50), { id: 't1', characterId: null, name: 'Aria', x: 10, y: 10, size: 1, image: null })
}

function setup() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Elisa',
    storage: null,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (socket === undefined) throw new Error('socket não criado')
  return { connection, socket }
}

const MARCA = { x: 200, y: 300, from: 'Elisa', color: '#3cff00', mine: true }

describe('playerConnection: marca de destino', () => {
  it('marcar e tirar só saem jogando e com socket aberto; o ponto vai arredondado', () => {
    const { connection, socket } = setup()
    socket.open()
    expect(connection.markDestination(10, 10)).toBe(false)
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [] })
    expect(connection.markDestination(200.4, 299.6)).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'destination', x: 200, y: 300 })
    expect(connection.markDestination(Number.NaN, 1)).toBe(false)
    expect(connection.clearDestination()).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'destination', clear: true })
  })

  it('a lista do host entra no estado e fica (sem prazo); lista nova substitui; torta é descartada', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'destinations', marks: [MARCA] })
    // Fora do jogo não há mapa onde desenhar.
    expect(connection.getState().destinations).toBeUndefined()
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [] })
    socket.receive({ type: 'destinations', marks: [MARCA, { x: 5, y: 6, from: 'Caio', color: '#2255ff', mine: false }] })
    expect(connection.getState().destinations).toEqual([MARCA, { x: 5, y: 6, from: 'Caio', color: '#2255ff', mine: false }])
    socket.receive({ type: 'destinations', marks: [{ ...MARCA, color: 'red; background:url(x)' }] })
    expect(connection.getState().destinations).toHaveLength(2)
    socket.receive({ type: 'destinations', marks: [] })
    expect(connection.getState().destinations).toEqual([])
  })

  it('lobby.waiting e reconnect limpam as marcas', () => {
    const { connection, socket } = setup()
    socket.open()
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [] })
    socket.receive({ type: 'destinations', marks: [MARCA] })
    expect(connection.getState().destinations).toHaveLength(1)
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().destinations).toBeUndefined()
    socket.receive({ type: 'snapshot', rev: 2, map: mapa(), vision: [] })
    socket.receive({ type: 'destinations', marks: [MARCA] })
    connection.reconnect()
    expect(connection.getState().destinations).toBeUndefined()
  })
})

describe('protocol: marca de destino', () => {
  it('o host aceita marcar (ponto finito) e tirar; o resto do que o jogador mandar cai fora', () => {
    expect(parsePlayerMessage({ type: 'destination', x: 1, y: 2, from: 'Outro', color: '#000000' })).toEqual({ type: 'destination', x: 1, y: 2 })
    expect(parsePlayerMessage({ type: 'destination', clear: true })).toEqual({ type: 'destination', clear: true })
    expect(parsePlayerMessage({ type: 'destination', x: '1', y: 2 })).toBeNull()
    expect(parsePlayerMessage({ type: 'destination', clear: 'sim' })).toBeNull()
  })

  it('a lista do host: cópia só com os campos conhecidos; teto, nome e cor fora da forma recusam tudo', () => {
    expect(parseDestinationsMessage({ type: 'destinations', marks: [{ ...MARCA, sceneId: 's-x' }] })).toEqual({ type: 'destinations', marks: [MARCA] })
    const demais = Array.from({ length: MAX_DESTINATION_MARKS + 1 }, () => MARCA)
    expect(parseDestinationsMessage({ type: 'destinations', marks: demais })).toBeNull()
    expect(parseDestinationsMessage({ type: 'destinations', marks: [{ ...MARCA, from: '' }] })).toBeNull()
    expect(parseDestinationsMessage({ type: 'destinations', marks: [{ ...MARCA, mine: 'sim' }] })).toBeNull()
    expect(parseDestinationsMessage({ type: 'destinations', marks: 'x' })).toBeNull()
  })
})
