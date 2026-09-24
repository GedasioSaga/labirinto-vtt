/**
 * MINHAS FICHAS EM OUTRAS CENAS no cliente do jogador: o snapshot traz a lista
 * (`elsewhere`), o estado a guarda, e `switchView` pede ao mestre para olhar
 * por uma delas — só por ficha que está na lista.
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

const HEROI: Token = { id: 'heroi', characterId: null, name: 'Heroi', x: 100, y: 100, size: 1, image: null }
const BATEDOR = { tokenId: 'batedor', name: 'Batedor', room: 'Poço de corda' }

function mapa(): MapData {
  return { ...createEmptyMap('m-salao', '', 10, 10, 50), tokens: [HEROI] }
}

function jogando() {
  const socket = new FakeSocket()
  const conn = createPlayerConnection({ url: 'ws://x', code: 'AB12CD', name: 'Ana', createSocket: () => socket, storage: null })
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'r1', name: 'Ana' })
  return { conn, socket }
}

describe('minhas fichas em outras cenas no jogador', () => {
  it('o snapshot com a lista guarda as fichas de fora; sem o campo, a lista fica vazia', () => {
    const { conn, socket } = jogando()
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [], ownTokens: ['heroi'], concealed: [], elsewhere: [BATEDOR] })
    expect(conn.getState().elsewhere).toEqual([BATEDOR])
    socket.receive({ type: 'snapshot', rev: 2, map: mapa(), vision: [], ownTokens: ['heroi'], concealed: [] })
    expect(conn.getState().elsewhere).toEqual([])
  })

  it('lista malformada descarta o snapshot inteiro', () => {
    const { conn, socket } = jogando()
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [], ownTokens: ['heroi'], concealed: [], elsewhere: [{ tokenId: 'batedor', name: 3, room: '' }] })
    expect(conn.getState().status).toBe('waiting')
    expect(conn.getState().rev).toBe(-1)
  })

  it('switchView manda view.switch só para ficha que está na lista', () => {
    const { conn, socket } = jogando()
    socket.receive({ type: 'snapshot', rev: 1, map: mapa(), vision: [], ownTokens: ['heroi'], concealed: [], elsewhere: [BATEDOR] })
    const antes = socket.sent.length
    expect(conn.switchView('rival')).toBe(false)
    expect(conn.switchView('heroi')).toBe(false)
    expect(socket.sent.length).toBe(antes)
    expect(conn.switchView('batedor')).toBe(true)
    expect(socket.sent.slice(antes)).toEqual([{ type: 'view.switch', tokenId: 'batedor' }])
  })
})
