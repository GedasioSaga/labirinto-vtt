/**
 * DADO ROLADO NA SALA no cliente do jogador: `rollDice` só PEDE ao host (o
 * resultado não nasce aqui), e cada `dice.rolled` que chega entra na lista de
 * rolagens da tela — a dele e a dos outros, iguais. Rolagem torta não entra.
 */
import { describe, expect, it } from 'vitest'
import { DICE_FEED_MAX } from '../lib/dice'
import { createEmptyMap } from '../lib/mapFactory'
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
  return { connection, socket }
}

const rolagem = (id: string, from: string, total: number) => ({ id, from, count: 1, sides: 20, modifier: 0, results: [total], total, at: 1 })

describe('dado do jogador: pedido', () => {
  it('rollDice manda só o pedido ao host, sem resultado', () => {
    const { connection, socket } = conectado()
    const antes = socket.sent.length
    expect(connection.rollDice({ count: 2, sides: 6, modifier: 3 })).toBe(true)
    expect(socket.sent.slice(antes)).toEqual([{ type: 'dice.roll', count: 2, sides: 6, modifier: 3 }])
    // O resultado só aparece quando o host devolve: nada foi inventado aqui.
    expect(connection.getState().diceRolls ?? []).toEqual([])
  })

  it('pedido fora da faixa nem sai', () => {
    const { connection, socket } = conectado()
    const antes = socket.sent.length
    expect(connection.rollDice({ count: 0, sides: 6, modifier: 0 })).toBe(false)
    expect(socket.sent.length).toBe(antes)
  })
})

describe('dado do jogador: rolagens que chegam', () => {
  it('a rolagem da mesa entra na lista, a mais nova no fim', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'dice.rolled', roll: rolagem('r1', 'Bruno', 7) })
    socket.receive({ type: 'dice.rolled', roll: { ...rolagem('r2', 'Mestre', 15), master: true } })
    expect(connection.getState().diceRolls).toEqual([rolagem('r1', 'Bruno', 7), { ...rolagem('r2', 'Mestre', 15), master: true }])
  })

  it('rolagem torta (total que não bate) não entra', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'dice.rolled', roll: { ...rolagem('r1', 'Bruno', 7), total: 30 } })
    expect(connection.getState().diceRolls ?? []).toEqual([])
  })

  it('a lista guarda só as últimas', () => {
    const { connection, socket } = conectado()
    for (let i = 0; i < DICE_FEED_MAX + 3; i += 1) socket.receive({ type: 'dice.rolled', roll: rolagem(`r${i}`, 'Bruno', 5) })
    const rolls = connection.getState().diceRolls ?? []
    expect(rolls).toHaveLength(DICE_FEED_MAX)
    expect(rolls[0]?.id).toBe('r3')
    expect(rolls.at(-1)?.id).toBe(`r${DICE_FEED_MAX + 2}`)
  })
})
