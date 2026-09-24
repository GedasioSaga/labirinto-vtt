/**
 * MAPA DE PAPEL no cliente do jogador: `map.given` diz só que o MESTRE deu um
 * mapa — nada de cena, Sala ou posição. O aviso abre por alguns segundos e as
 * Salas em si chegam no `explored` do snapshot seguinte, como sempre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { parseMapShareMessage } from '../net/protocol'
import { createPlayerConnection, MAP_SHARED_NOTICE_TTL_MS, type SocketLike } from './playerConnection'
import { mapSharedNoticeText } from './PlayerMapShare'

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
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('map.given no fio', () => {
  it('sai só o tipo: cena, Salas e título inventados no caminho são jogados fora', () => {
    expect(parseMapShareMessage({ type: 'map.given' })).toEqual({ type: 'map.given' })
    expect(parseMapShareMessage({ type: 'map.given', sceneName: 'Cripta', rooms: ['Pombal'], sceneId: 's-cripta' })).toEqual({ type: 'map.given' })
  })
})

describe('Mapa de papel — quem recebe', () => {
  it('map.given abre o aviso do mestre, sem nome de cena, e ele some sozinho', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'map.given', sceneName: 'Cripta Funda' })
    const aviso = connection.getState().mapShared
    expect(aviso).toEqual({ id: expect.any(Number), from: null })
    const texto = mapSharedNoticeText(null)
    expect(texto).toContain('mestre')
    expect(texto).not.toContain('Cripta')
    vi.advanceTimersByTime(MAP_SHARED_NOTICE_TTL_MS)
    expect(connection.getState().mapShared).toBeUndefined()
  })

  it('aguardando sem ficha, o aviso não abre (não há mapa na tela)', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'lobby.waiting' })
    socket.receive({ type: 'map.given' })
    expect(connection.getState().mapShared).toBeUndefined()
    expect(connection.getState().status).toBe('waiting')
  })

  it('o aviso de colega continua com o nome de quem mostrou', () => {
    expect(mapSharedNoticeText('Bruno')).toBe('Bruno mostrou o próprio mapa a você. O trecho explorado já aparece no seu.')
  })
})
