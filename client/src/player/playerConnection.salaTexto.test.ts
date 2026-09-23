/**
 * TEXTO DA SALA no cliente do jogador: `room.text` abre o cartão, "Fechar"
 * fecha, e tocar no rótulo de uma sala cujo texto já chegou reabre.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region } from '../types/map'
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
  close(): void {
    this.readyState = 3
  }
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(msg: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(msg) }))
  }
}

function cozinha(textoAoEntrar?: string): Region {
  return {
    id: 'cozinha',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
    room: textoAoEntrar === undefined ? { shape: 'rect', name: 'Cozinha' } : { shape: 'rect', name: 'Cozinha', textoAoEntrar },
  }
}

function mapa(regions: Region[]): MapData {
  return { ...createEmptyMap('m', '', 10, 10, 50), regions }
}

function jogando(map: MapData) {
  const socket = new FakeSocket()
  const conn = createPlayerConnection({ url: 'ws://x', code: 'AB12CD', name: 'Carla', createSocket: () => socket, storage: null })
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'r1', name: 'Carla' })
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: [], concealed: [] })
  return { conn, socket }
}

describe('texto da sala no jogador', () => {
  it('room.text abre o cartão com título e texto; fechar some', () => {
    const { conn, socket } = jogando(mapa([cozinha('Pão queimado.')]))
    socket.receive({ type: 'room.text', id: 'cozinha', title: 'Cozinha', text: 'Pão queimado.' })
    expect(conn.getState().roomText).toEqual({ id: 'cozinha', title: 'Cozinha', text: 'Pão queimado.' })
    conn.dismissRoomText()
    expect(conn.getState().roomText).toBeUndefined()
  })

  it('room.text malformado é ignorado', () => {
    const { conn, socket } = jogando(mapa([cozinha('x')]))
    socket.receive({ type: 'room.text', id: 'cozinha', title: 'Cozinha', text: '' })
    socket.receive({ type: 'room.text', id: 7, title: 'Cozinha', text: 'x' })
    socket.receive({ type: 'room.text', id: 'cozinha', text: 'x' })
    expect(conn.getState().roomText).toBeUndefined()
  })

  it('tocar no rótulo reabre o texto que já chegou no mapa; sala sem texto não abre nada', () => {
    const { conn } = jogando(mapa([cozinha('Pão queimado.'), { ...cozinha(), id: 'sala' }]))
    expect(conn.openRoomText('cozinha')).toBe(true)
    expect(conn.getState().roomText).toEqual({ id: 'cozinha', title: 'Cozinha', text: 'Pão queimado.' })
    conn.dismissRoomText()
    expect(conn.openRoomText('sala')).toBe(false)
    expect(conn.openRoomText('nao-existe')).toBe(false)
    expect(conn.getState().roomText).toBeUndefined()
  })
})
