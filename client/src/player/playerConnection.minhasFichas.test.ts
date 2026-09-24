/**
 * MINHAS FICHAS EM OUTRAS CENAS no cliente do jogador: o snapshot traz a lista
 * (`elsewhere`), o estado a guarda, e `switchView` pede ao mestre para olhar
 * por uma delas — só por ficha que está na lista.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createPlayerConnection, FREE_PASSAGE_BEAT_MS, type SocketLike } from './playerConnection'

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

describe('switchView com pedido de passagem no ar', () => {
  const PEDE: Pin = { id: 'escada', x: 150, y: 100, kind: 'viagem', description: 'Escada', image: null, destino: { sceneId: 's-b', pinId: 'escada-b' } }
  const LIVRE: Pin = { ...PEDE, id: 'portao', passagem: 'livre' }

  function comPinos(): MapData {
    return { ...mapa(), pins: [PEDE, LIVRE] }
  }

  it('esperando o mestre: o aviso de retirado do host troca o cartão, o snapshot novo não o apaga, e pedir de novo volta a valer', () => {
    const { conn, socket } = jogando()
    socket.receive({ type: 'snapshot', rev: 1, map: comPinos(), vision: [], ownTokens: ['heroi'], concealed: [], elsewhere: [BATEDOR] })
    expect(conn.requestTravel('escada')).toBe(true)
    expect(conn.getState().travel).toMatchObject({ phase: 'waiting', direct: false })
    expect(conn.switchView('batedor')).toBe(true)
    socket.receive({ type: 'pin.travel.cancelled', reason: 'player' })
    socket.receive({ type: 'snapshot', rev: 2, map: comPinos(), vision: [], ownTokens: ['batedor'], concealed: [], elsewhere: [{ tokenId: 'heroi', name: 'Heroi', room: '' }] })
    expect(conn.getState().travel).toMatchObject({ phase: 'cancelled', reason: 'player' })
    expect(conn.requestTravel('escada')).toBe(true)
    expect(conn.getState().travel).toMatchObject({ phase: 'waiting' })
  })

  it('pino livre na pausa antes de sair: trocar de cena desiste, o pedido nunca sai e o "Passando…" some', () => {
    vi.useFakeTimers()
    try {
      const { conn, socket } = jogando()
      socket.receive({ type: 'snapshot', rev: 1, map: comPinos(), vision: [], ownTokens: ['heroi'], concealed: [], elsewhere: [BATEDOR] })
      expect(conn.requestTravel('portao')).toBe(true)
      expect(conn.getState().travel).toMatchObject({ phase: 'waiting', direct: true })
      const antes = socket.sent.length
      expect(conn.switchView('batedor')).toBe(true)
      vi.advanceTimersByTime(FREE_PASSAGE_BEAT_MS * 2)
      expect(socket.sent.slice(antes)).toEqual([{ type: 'view.switch', tokenId: 'batedor' }])
      expect(conn.getState().travel).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
