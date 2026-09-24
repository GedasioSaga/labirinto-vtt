/**
 * LASER DO JOGADOR no cliente: `laserMove` manda o primeiro ponto na hora e os
 * seguintes em lote; `laserOff` fecha o gesto. O laser de OUTRO jogador vira
 * um rastro próprio (`playerLasers`), na cor que o host mandou, que some
 * sozinho — e nunca se mistura ao laser do mestre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LASER_SEND_INTERVAL_MS, LASER_TRAIL_MS, REMOTE_LASER_IDLE_MS } from '../lib/laser'
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
  lasers(): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && Reflect.get(m, 'type') === 'laser')
  }
}

function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Caio',
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
  socket.receive({ type: 'welcome', playerId: 'p3', resumeToken: 'tok', name: 'Caio' })
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('laser do jogador: envio', () => {
  it('primeiro ponto sai na hora, os seguintes juntos na janela; off manda o resto e fecha', () => {
    const { connection, socket } = jogando()
    expect(connection.laserMove(10.4, 20.6)).toBe(true)
    expect(socket.lasers()).toEqual([{ type: 'laser', points: [{ x: 10, y: 21 }] }])
    connection.laserMove(30, 40)
    connection.laserMove(50, 60)
    expect(socket.lasers()).toHaveLength(1)
    vi.advanceTimersByTime(LASER_SEND_INTERVAL_MS)
    expect(socket.lasers()[1]).toEqual({ type: 'laser', points: [{ x: 30, y: 40 }, { x: 50, y: 60 }] })
    connection.laserMove(70, 80)
    connection.laserOff()
    expect(socket.lasers().slice(2)).toEqual([{ type: 'laser', points: [{ x: 70, y: 80 }] }, { type: 'laser', off: true }])
  })

  it('off sem gesto não sai; fora do jogo o laser não sai', () => {
    const { connection, socket } = jogando()
    connection.laserOff()
    expect(socket.lasers()).toEqual([])
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.laserMove(1, 1)).toBe(false)
    expect(socket.lasers()).toEqual([])
  })
})

describe('laser do jogador: recebido de outro jogador', () => {
  it('vira um rastro por jogador, na cor mandada, sem mexer no laser do mestre', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'laser', points: [{ x: 100, y: 100 }, { x: 150, y: 100 }], from: 'Ana', color: '#3cff00' })
    const lasers = connection.getState().playerLasers ?? []
    expect(lasers).toHaveLength(1)
    expect(lasers[0]).toMatchObject({ key: 'Ana', label: 'Ana', color: '#3cff00', trail: { on: true } })
    expect(lasers[0]?.trail.points.map((p) => [p.x, p.y])).toEqual([[100, 100], [150, 100]])
    expect(connection.getState().laser).toBeUndefined()
  })

  it('soltou: o rastro some sozinho em poucos segundos', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'laser', points: [{ x: 100, y: 100 }], from: 'Ana', color: '#3cff00' })
    socket.receive({ type: 'laser', off: true, from: 'Ana', color: '#3cff00' })
    expect(connection.getState().playerLasers?.[0]?.trail.on).toBe(false)
    vi.advanceTimersByTime(LASER_TRAIL_MS * 2)
    expect(connection.getState().playerLasers).toBeUndefined()
  })

  it('o off se perdeu (caiu, trocou de cena): a ponta apaga sozinha depois do silêncio', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'laser', points: [{ x: 100, y: 100 }], from: 'Ana', color: '#3cff00' })
    vi.advanceTimersByTime(REMOTE_LASER_IDLE_MS + LASER_TRAIL_MS * 2)
    expect(connection.getState().playerLasers).toBeUndefined()
  })

  it('cor ou nome malformados: a mensagem cai inteira', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'laser', points: [{ x: 1, y: 1 }], from: 'Ana', color: 'javascript:alert(1)' })
    socket.receive({ type: 'laser', points: [{ x: 1, y: 1 }], from: 'Ana' })
    expect(connection.getState().playerLasers).toBeUndefined()
    expect(connection.getState().laser).toBeUndefined()
  })

  it('duas fichas de mesmo nome (ou sem nome) viram dois rastros: quem separa é a key, não o nome', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'laser', points: [{ x: 100, y: 100 }], from: 'Guarda', key: 'laser-1', color: '#9ca3af' })
    socket.receive({ type: 'laser', points: [{ x: 900, y: 100 }], from: 'Guarda', key: 'laser-2', color: '#9ca3af' })
    socket.receive({ type: 'laser', points: [{ x: 500, y: 500 }], from: '', key: 'laser-3', color: '#9ca3af' })
    const lasers = connection.getState().playerLasers ?? []
    expect(lasers.map((l) => [l.key, l.label])).toEqual([['laser-1', 'Guarda'], ['laser-2', 'Guarda'], ['laser-3', '']])
    expect(lasers[0]?.trail.points.map((p) => [p.x, p.y])).toEqual([[100, 100]])
    socket.receive({ type: 'laser', off: true, from: 'Guarda', key: 'laser-1', color: '#9ca3af' })
    expect(connection.getState().playerLasers?.map((l) => l.trail.on)).toEqual([true, true, false])
  })

  it('mudou de cena: os lasers da cena de antes saem da tela', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'laser', points: [{ x: 100, y: 100 }], from: 'Ana', color: '#3cff00' })
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().playerLasers).toBeUndefined()
  })
})
