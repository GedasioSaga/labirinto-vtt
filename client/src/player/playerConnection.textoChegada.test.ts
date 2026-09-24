/**
 * TEXTO DE CHEGADA DA CENA no cliente do jogador: o `scene.changed` que traz
 * `chegada` abre o cartão (`state.arrival`), que fica até ele fechar. Chegar
 * noutra cena sem texto tira o cartão da cena de antes; forma errada não abre
 * nada; o snapshot seguinte não reabre.
 */
import { describe, expect, it } from 'vitest'
import { ARRIVAL_TEXT_MAX_LENGTH } from '../lib/arrivalText'
import { createEmptyMap } from '../lib/mapFactory'
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
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('texto de chegada no cliente do jogador', () => {
  it('scene.changed com chegada abre o cartão; dismissArrival fecha', () => {
    const { connection, socket } = jogando()
    expect(connection.getState().arrival).toBeUndefined()
    socket.receive({ type: 'scene.changed', chegada: 'Frio e silêncio.' })
    expect(connection.getState().arrival?.text).toBe('Frio e silêncio.')
    // O aviso de viagem de sempre continua saindo junto.
    expect(connection.getState().travel?.phase).toBe('arrived')
    connection.dismissArrival()
    expect(connection.getState().arrival).toBeUndefined()
  })

  it('levado pelo mestre ou reunido: o texto vem igual', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed', by: 'master', chegada: 'Cripta.' })
    expect(connection.getState().arrival?.text).toBe('Cripta.')
    socket.receive({ type: 'scene.changed', by: 'gather', chegada: 'Torre.' })
    expect(connection.getState().arrival?.text).toBe('Torre.')
  })

  it('o snapshot seguinte não reabre o cartão fechado (uma vez só)', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed', chegada: 'Frio.' })
    connection.dismissArrival()
    socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m2', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    expect(connection.getState().rev).toBe(2)
    expect(connection.getState().arrival).toBeUndefined()
  })

  it('chegar noutra cena sem texto tira o cartão da cena de antes', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed', chegada: 'Cripta.' })
    socket.receive({ type: 'scene.changed', by: 'master' })
    expect(connection.getState().travel?.phase).toBe('moved')
    expect(connection.getState().arrival).toBeUndefined()
  })

  it('chegada fora da forma não abre cartão: não-texto, vazio, acima do teto', () => {
    const { connection, socket } = jogando()
    for (const chegada of [42, '', '   ', 'x'.repeat(ARRIVAL_TEXT_MAX_LENGTH + 1), { text: 'oi' }]) {
      socket.receive({ type: 'scene.changed', chegada })
      expect(connection.getState().travel?.phase, JSON.stringify(chegada)).toBe('arrived')
      expect(connection.getState().arrival, JSON.stringify(chegada)).toBeUndefined()
    }
  })

  it('volta à espera e reconexão tiram o cartão', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.changed', chegada: 'Cripta.' })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().status).toBe('waiting')
    expect(connection.getState().arrival).toBeUndefined()

    const outra = jogando()
    outra.socket.receive({ type: 'scene.changed', chegada: 'Cripta.' })
    outra.connection.reconnect()
    expect(outra.connection.getState().status).toBe('connecting')
    expect(outra.connection.getState().arrival).toBeUndefined()
  })
})
