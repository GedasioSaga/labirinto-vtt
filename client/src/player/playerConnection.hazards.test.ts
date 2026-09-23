/**
 * ZONA DE PERIGO no cliente do jogador: `snapshot.hazards` vira
 * `state.hazards` (o que a tela pinta), e `hazard.entered` vira o aviso
 * `state.hazardNotice`, que some sozinho. Forma errada: a mensagem cai.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { HAZARD_NOTICE_TTL_MS, hazardNoticeText } from '../lib/hazards'
import { createPlayerConnection, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
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
  return { connection, socket }
}

const QUADRADO = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

function snapshot(rev: number, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [], ...extra }
}

describe('zona de perigo no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o snapshot com perigo vira state.hazards; o seguinte sem o campo apaga', () => {
    const { connection, socket } = jogando()
    socket.receive(snapshot(1, { hazards: [{ kind: 'fogo', points: QUADRADO }] }))
    expect(connection.getState().hazards).toEqual([{ kind: 'fogo', points: QUADRADO }])
    socket.receive(snapshot(2))
    expect(connection.getState().hazards).toEqual([])
  })

  it('perigo malformado derruba o snapshot inteiro (o anterior fica)', () => {
    const { connection, socket } = jogando()
    socket.receive(snapshot(1, { hazards: [{ kind: 'fogo', points: QUADRADO }] }))
    socket.receive(snapshot(2, { hazards: [{ kind: 'lava', points: QUADRADO }] }))
    socket.receive(snapshot(3, { hazards: [{ kind: 'fogo', points: 'x' }] }))
    socket.receive(snapshot(4, { hazards: 'fogo' }))
    expect(connection.getState().rev).toBe(1)
  })

  it('hazard.entered mostra o aviso do tipo certo, e ele some sozinho', () => {
    const { connection, socket } = jogando()
    socket.receive(snapshot(1))
    socket.receive({ type: 'hazard.entered', kind: 'fumaca' })
    const aviso = connection.getState().hazardNotice
    expect(aviso?.kind).toBe('fumaca')
    expect(hazardNoticeText('fumaca')).toContain('fumaça')
    vi.advanceTimersByTime(HAZARD_NOTICE_TTL_MS)
    expect(connection.getState().hazardNotice).toBeUndefined()
  })

  it('tipo desconhecido, ou fora do jogo, não vira aviso', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'hazard.entered', kind: 'fogo' })
    expect(connection.getState().hazardNotice).toBeUndefined()
    socket.receive(snapshot(1))
    socket.receive({ type: 'hazard.entered', kind: 'lava' })
    expect(connection.getState().hazardNotice).toBeUndefined()
  })
})
