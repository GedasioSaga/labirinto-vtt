/**
 * "ME AVISE QUANDO DER" no cliente do jogador: marcar um pino trancado guarda
 * a vontade AQUI (nada sai pela rede — o host não precisa saber). Quando um
 * snapshot traz o mesmo pino já aberto, chega o aviso e a marca sai. Trocar
 * de cena apaga as marcas: o id do pino era da cena de antes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin } from '../types/map'
import { createPlayerConnection, PASSAGE_OPENED_NOTICE_TTL_MS, type SocketLike } from './playerConnection'

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

function caracol(passagem: Pin['passagem']): Pin {
  return { id: 'caracol', x: 50, y: 50, kind: 'viagem', description: 'Escada', image: null, passagem, motivo: passagem === 'trancada' ? 'desabou' : undefined }
}

function mapa(pins: Pin[]): MapData {
  return { ...createEmptyMap('m', '', 10, 10, 50), pins }
}

let rev = 1
function snapshot(socket: FakeSocket, pins: Pin[]): void {
  rev += 1
  socket.receive({ type: 'snapshot', rev, map: mapa(pins), vision: [], ownTokens: [], concealed: [] })
}

function jogando(pins: Pin[]) {
  const socket = new FakeSocket()
  const conn = createPlayerConnection({ url: 'ws://x', code: 'AB12CD', name: 'Carla', createSocket: () => socket, storage: null })
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'r1', name: 'Carla' })
  snapshot(socket, pins)
  socket.sent.length = 0
  return { conn, socket }
}

describe('me avise quando der a passagem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('marcar o pino trancado guarda a marca e não manda nada ao host', () => {
    const { conn, socket } = jogando([caracol('trancada')])
    expect(conn.watchPassage('caracol', true)).toBe(true)
    expect(conn.getState().passageWatch).toEqual(['caracol'])
    expect(socket.sent).toEqual([])
    expect(conn.watchPassage('caracol', false)).toBe(true)
    expect(conn.getState().passageWatch ?? []).toEqual([])
  })

  it('pino aberto ou fora do mapa não aceita a marca', () => {
    const { conn } = jogando([caracol('pede')])
    expect(conn.watchPassage('caracol', true)).toBe(false)
    expect(conn.watchPassage('nao-existe', true)).toBe(false)
    expect(conn.getState().passageWatch ?? []).toEqual([])
  })

  it('o mestre abre: o snapshot seguinte traz o aviso, a marca sai e o aviso some sozinho', () => {
    const { conn, socket } = jogando([caracol('trancada')])
    conn.watchPassage('caracol', true)
    // Ainda trancado (outro snapshot qualquer): nada de aviso.
    snapshot(socket, [caracol('trancada')])
    expect(conn.getState().passageOpened).toBeUndefined()
    snapshot(socket, [caracol('livre')])
    expect(conn.getState().passageOpened?.id).toBeGreaterThan(0)
    expect(conn.getState().passageWatch ?? []).toEqual([])
    vi.advanceTimersByTime(PASSAGE_OPENED_NOTICE_TTL_MS)
    expect(conn.getState().passageOpened).toBeUndefined()
  })

  it('pino que sai do recorte (névoa, mestre escondeu) não dispara aviso e a marca fica', () => {
    const { conn, socket } = jogando([caracol('trancada')])
    conn.watchPassage('caracol', true)
    snapshot(socket, [])
    expect(conn.getState().passageOpened).toBeUndefined()
    expect(conn.getState().passageWatch).toEqual(['caracol'])
  })

  it('trocar de cena apaga as marcas: um pino de mesmo id na cena nova não avisa', () => {
    const { conn, socket } = jogando([caracol('trancada')])
    conn.watchPassage('caracol', true)
    socket.receive({ type: 'scene.changed', by: 'master' })
    expect(conn.getState().passageWatch ?? []).toEqual([])
    snapshot(socket, [caracol('livre')])
    expect(conn.getState().passageOpened).toBeUndefined()
  })
})
