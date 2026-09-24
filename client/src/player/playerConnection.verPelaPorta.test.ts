/**
 * VER PELA PORTA ABERTA no cliente do jogador: o snapshot traz a espiada
 * (`peek`: prédios espiados e a visão de quem está no vão), o estado a guarda
 * para a tela recortar o telhado, e o snapshot seguinte sem o campo a apaga.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
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

const HEROI: Token = { id: 'heroi', characterId: null, name: 'Heroi', x: 400, y: 630, size: 1, image: null }
const CONE = [
  { x: 400, y: 630 },
  { x: 380, y: 600 },
  { x: 250, y: 400 },
  { x: 550, y: 400 },
  { x: 420, y: 600 },
]

function mapa(): MapData {
  return { ...createEmptyMap('m-vila', '', 25, 25, 40), tokens: [HEROI] }
}

function jogando() {
  const socket = new FakeSocket()
  const conn = createPlayerConnection({ url: 'ws://x', code: 'AB12CD', name: 'Ana', createSocket: () => socket, storage: null })
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'r1', name: 'Ana' })
  return { conn, socket }
}

describe('ver pela porta aberta no jogador', () => {
  it('o snapshot com a espiada a guarda; o seguinte sem o campo a apaga', () => {
    const { conn, socket } = jogando()
    const peek = { roofIds: ['casa'], vision: [CONE] }
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [CONE], ownTokens: ['heroi'], concealed: [], peek })
    expect(conn.getState().peek).toEqual(peek)

    socket.receive({ type: 'snapshot', rev: 2, map: mapa(), vision: [CONE], ownTokens: ['heroi'], concealed: [] })
    expect(conn.getState().status).toBe('playing')
    expect(conn.getState().peek).toBe(undefined)
  })

  it('espiada malformada descarta o snapshot inteiro', () => {
    const { conn, socket } = jogando()
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [CONE], ownTokens: ['heroi'], concealed: [], peek: { roofIds: [3], vision: [CONE] } })
    expect(conn.getState().status).toBe('waiting')
    socket.receive({ type: 'snapshot', rev: 2, map: mapa(), vision: [CONE], ownTokens: ['heroi'], concealed: [], peek: { roofIds: ['casa'], vision: 'cone' } })
    expect(conn.getState().status).toBe('waiting')
    expect(conn.getState().peek).toBe(undefined)
  })
})
