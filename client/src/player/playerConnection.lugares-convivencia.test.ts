/**
 * LUGARES no cliente do jogador convivendo com o que auto/int-jogador já tem:
 * a marca "vamos para cá" (marca-olhem-aqui) e as rolagens da mesa
 * (dado-na-sala). O snapshot que traz `place`/`places` não apaga a marca nem
 * as rolagens, e as mensagens delas não mexem nos lugares.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, markRings } from '../lib/exploration'
import { createPlayerConnection, type SocketLike } from './playerConnection'

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

function conectado() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Eva',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Eva' })
  return { connection, socket }
}

function explorado() {
  const exp = createExploration({ width: 500, height: 500, grid: 50 })
  markRings(exp, [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  ])
  return encodeExploration(exp)
}

function snapshot(rev: number, mapId: string, place: string, places: string[]) {
  return { type: 'snapshot', rev, map: createEmptyMap(mapId, '', 10, 10, 50), vision: [], explored: explorado(), ownTokens: [], concealed: [], place, places }
}

const MARCA = { x: 200, y: 300, from: 'Eva', color: '#3cff00', mine: true }
const ROLAGEM = { id: 'r1', from: 'Bruno', count: 1, sides: 20, modifier: 0, results: [7], total: 7, at: 1 }

describe('Lugares com a marca "vamos para cá" e o dado da mesa', () => {
  it('rolagem e marca que chegam não mexem nos lugares; o snapshot seguinte mantém rolagem e marca', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, 'm-a', 'l1', ['l1']))
    socket.receive({ type: 'destinations', marks: [MARCA] })
    socket.receive({ type: 'dice.rolled', roll: ROLAGEM })

    const antes = connection.getState()
    expect(antes.place).toBe('l1')
    expect((antes.places ?? []).map((p) => p.id)).toEqual(['l1'])
    expect(antes.destinations).toEqual([MARCA])
    expect(antes.diceRolls).toEqual([ROLAGEM])

    // Um passo na mesma cena: novo recorte, mesmo lugar.
    socket.receive(snapshot(2, 'm-a', 'l1', ['l1']))
    const depois = connection.getState()
    expect(depois.place).toBe('l1')
    expect((depois.places ?? []).map((p) => p.id)).toEqual(['l1'])
    expect(depois.destinations).toEqual([MARCA])
    expect(depois.diceRolls).toEqual([ROLAGEM])
  })

  it('trocar de lugar guarda os dois e a rolagem da mesa continua (é do jogador, não da cena)', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, 'm-a', 'l1', ['l1']))
    socket.receive({ type: 'dice.rolled', roll: ROLAGEM })
    socket.receive(snapshot(2, 'm-b', 'l2', ['l1', 'l2']))
    const state = connection.getState()
    expect(state.place).toBe('l2')
    expect((state.places ?? []).map((p) => p.id)).toEqual(['l1', 'l2'])
    expect(state.diceRolls).toEqual([ROLAGEM])
  })

  it('pedir rolagem e marcar destino continuam saindo com lugares ligados', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, 'm-a', 'l1', ['l1']))
    const antes = socket.sent.length
    expect(connection.rollDice({ count: 2, sides: 6, modifier: 1 })).toBe(true)
    expect(connection.markDestination(200, 300)).toBe(true)
    expect(socket.sent.slice(antes)).toEqual([
      { type: 'dice.roll', count: 2, sides: 6, modifier: 1 },
      { type: 'destination', x: 200, y: 300 },
    ])
    expect(connection.getState().place).toBe('l1')
  })
})
