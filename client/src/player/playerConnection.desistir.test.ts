/**
 * DESISTIR DO PEDIDO no cliente do jogador: `cancelTravel` manda
 * `pin.travel.cancel` só enquanto um pedido espera o mestre, e o aviso marca
 * que está desistindo. Quem fecha o assunto é o host: `pin.travel.cancelled`
 * vira o aviso "retirado" (também quando o pedido caiu porque a ficha se
 * afastou), e a partir dele dá para pedir de novo.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { TRAVEL_REQUEST_MIN_INTERVAL_MS } from '../net/protocol'
import type { Pin } from '../types/map'
import { createPlayerConnection, TRAVEL_PACE_MARGIN_MS, type SocketLike } from './playerConnection'

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
  enviados(tipo: string): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === tipo)
  }
}

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 100, y: 100, kind: 'viagem', description: '', image: null, ...extra }
}

/** Jogando, com um pino que pede ao mestre e um pino livre. */
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
  const map = { ...createEmptyMap('m1', '', 10, 10, 50), pins: [pino('porta'), pino('livre', { passagem: 'livre' })] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('desistir do pedido no cliente do jogador', () => {
  it('esperando o mestre, "Desistir" manda só o tipo e o aviso passa a "desistindo"', () => {
    const { connection, socket } = jogando()
    expect(connection.requestTravel('porta')).toBe(true)
    expect(connection.cancelTravel()).toBe(true)
    expect(socket.enviados('pin.travel.cancel')).toEqual([{ type: 'pin.travel.cancel' }])
    expect(connection.getState().travel).toMatchObject({ phase: 'waiting', direct: false, cancelling: true })
    // Um toque só: o segundo não manda de novo.
    expect(connection.cancelTravel()).toBe(false)
    expect(socket.enviados('pin.travel.cancel')).toHaveLength(1)
  })

  it('sem pedido esperando, ou no pino livre, não há do que desistir', () => {
    const { connection, socket } = jogando()
    expect(connection.cancelTravel()).toBe(false)
    expect(connection.requestTravel('livre')).toBe(true)
    expect(connection.cancelTravel()).toBe(false)
    expect(socket.enviados('pin.travel.cancel')).toEqual([])
  })

  it('o host confirma: o aviso vira "retirado" e o próximo pedido sai', () => {
    // PEDIR DE NOVO ESPERA O LIMITE DO HOST (junção): o segundo pedido no mesmo
    // pino sai depois do intervalo, em vez de voltar "too_soon". O relógio é o do teste.
    vi.useFakeTimers()
    try {
      const { connection, socket } = jogando()
      connection.requestTravel('porta')
      connection.cancelTravel()
      socket.receive({ type: 'pin.travel.cancelled', reason: 'player' })
      expect(connection.getState().travel).toMatchObject({ phase: 'cancelled', reason: 'player' })
      expect(connection.requestTravel('porta')).toBe(true)
      vi.advanceTimersByTime(TRAVEL_REQUEST_MIN_INTERVAL_MS + TRAVEL_PACE_MARGIN_MS)
      expect(socket.enviados('pin.travel.request')).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('o pedido cai sozinho porque a ficha se afastou: o aviso diz o motivo "far"', () => {
    const { connection, socket } = jogando()
    connection.requestTravel('porta')
    socket.receive({ type: 'pin.travel.cancelled', reason: 'far' })
    expect(connection.getState().travel).toMatchObject({ phase: 'cancelled', reason: 'far' })
  })

  it('o mestre respondeu antes de a desistência chegar: vale a resposta dele', () => {
    const { connection, socket } = jogando()
    connection.requestTravel('porta')
    connection.cancelTravel()
    socket.receive({ type: 'pin.travel.denied' })
    expect(connection.getState().travel).toMatchObject({ phase: 'denied' })
  })

  it('motivo desconhecido não vira aviso', () => {
    const { connection, socket } = jogando()
    connection.requestTravel('porta')
    socket.receive({ type: 'pin.travel.cancelled', reason: 'Cripta Rubra' })
    expect(connection.getState().travel).toMatchObject({ phase: 'waiting' })
  })
})
