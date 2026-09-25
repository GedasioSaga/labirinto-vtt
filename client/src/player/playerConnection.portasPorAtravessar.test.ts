/**
 * PORTAS POR ATRAVESSAR no cliente do jogador: `snapshot.porAtravessar` é
 * aditivo — ausente, nenhuma marca; presente e malformado, a mensagem inteira
 * é descartada. Id que não é de porta do mapa recebido não fica guardado.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Wall } from '../types/map'
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
  return { connection, socket }
}

function parede(id: string, door: Wall['door']): Wall {
  return { id, x1: 0, y1: 200, x2: 50, y2: 200, blocksLight: true, blocksMove: true, door }
}

const patio: MapData = {
  ...createEmptyMap('m-patio', '', 20, 10, 50),
  walls: [parede('pa', { open: false, locked: false, kind: 'normal' }), parede('muro', null)],
  tokens: [{ id: 'heroi', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }],
}

function snapshot(rev: number, porAtravessar?: unknown) {
  return { type: 'snapshot', rev, map: patio, vision: [], ownTokens: ['heroi'], concealed: [], ...(porAtravessar === undefined ? {} : { porAtravessar }) }
}

describe('playerConnection: portas por atravessar', () => {
  it('guarda as portas marcadas do mapa recebido', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, ['pa']))
    expect(connection.getState().porAtravessar).toEqual(['pa'])
  })

  it('sem o campo: nenhuma marca (a marca de antes some)', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, ['pa']))
    socket.receive(snapshot(2))
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().porAtravessar).toEqual([])
  })

  it('id que não é porta do mapa recebido (parede comum, id desconhecido) não fica guardado', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, ['pa', 'muro', 'fantasma']))
    expect(connection.getState().porAtravessar).toEqual(['pa'])
  })

  it('recorte sem paredes nenhuma (o campo nem veio): a marca não tem porta onde ficar, e nada quebra', () => {
    const { connection, socket } = conectado()
    const { walls: _semParedes, ...semWalls } = patio
    socket.receive({ ...snapshot(1, ['pa']), map: semWalls })
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().porAtravessar).toEqual([])
  })

  it('malformado descarta a mensagem inteira', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, ['pa']))
    socket.receive(snapshot(2, 'pa'))
    socket.receive(snapshot(3, [7]))
    expect(connection.getState().rev).toBe(1)
    expect(connection.getState().porAtravessar).toEqual(['pa'])
  })
})
