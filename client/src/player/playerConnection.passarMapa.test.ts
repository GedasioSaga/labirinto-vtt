/**
 * PASSAR O MAPA no cliente do jogador: "Mostrar meu mapa a…" pede a lista de
 * quem está na cena (o mesmo `clue.peers` das pistas), manda `map.share` pelo
 * nome e acompanha a resposta. Quem recebe vê o aviso "Ana te mostrou o mapa"
 * por alguns segundos; o mapa novo em si vem no snapshot seguinte.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, MAP_SHARED_NOTICE_TTL_MS, type SocketLike } from './playerConnection'

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
  socket.sent.length = 0
  return { connection, socket }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Mostrar meu mapa a… — quem mostra', () => {
  it('pede os colegas da cena, mostra ao escolhido e lê o "mostrado"', () => {
    const { connection, socket } = jogando()
    expect(connection.askMapPeers()).toBe(true)
    expect(socket.sent).toEqual([{ type: 'clue.peers' }])
    expect(connection.getState().mapPeers).toEqual({ phase: 'loading' })

    socket.receive({ type: 'clue.peers', names: ['Bruno', 'Carla'] })
    expect(connection.getState().mapPeers).toEqual({ phase: 'ready', names: ['Bruno', 'Carla'] })
    // A lista era do mapa, não de um cartão de pista.
    expect(connection.getState().cluePeers).toBeUndefined()

    expect(connection.shareMap('Bruno')).toBe(true)
    expect(socket.sent[1]).toEqual({ type: 'map.share', to: 'Bruno' })
    expect(connection.getState().mapShare).toEqual({ to: 'Bruno', phase: 'sending' })

    socket.receive({ type: 'map.share.result', to: 'Bruno', ok: true })
    expect(connection.getState().mapShare).toEqual({ to: 'Bruno', phase: 'ok' })
  })

  it('recusa comum vira failed; too_soon vira too_soon; resposta de outro nome é ignorada', () => {
    const { connection, socket } = jogando()
    connection.shareMap('Bruno')
    socket.receive({ type: 'map.share.result', to: 'Carla', ok: true })
    expect(connection.getState().mapShare).toEqual({ to: 'Bruno', phase: 'sending' })
    socket.receive({ type: 'map.share.result', to: 'Bruno', ok: false, reason: 'too_soon' })
    expect(connection.getState().mapShare).toEqual({ to: 'Bruno', phase: 'too_soon' })
    connection.shareMap('Bruno')
    socket.receive({ type: 'map.share.result', to: 'Bruno', ok: false })
    expect(connection.getState().mapShare).toEqual({ to: 'Bruno', phase: 'failed' })
  })

  it('resetMapShare fecha a lista e o resultado; trocar de cena também', () => {
    const { connection, socket } = jogando()
    connection.askMapPeers()
    socket.receive({ type: 'clue.peers', names: ['Bruno'] })
    connection.resetMapShare()
    expect(connection.getState().mapPeers).toBeUndefined()
    expect(connection.getState().mapShare).toBeUndefined()

    connection.askMapPeers()
    socket.receive({ type: 'clue.peers', names: ['Bruno'] })
    connection.shareMap('Bruno')
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().mapPeers).toBeUndefined()
    expect(connection.getState().mapShare).toBeUndefined()
  })

  it('a lista pedida pelo cartão de pista não abre a do mapa', () => {
    const { connection, socket } = jogando()
    connection.askCluePeers()
    socket.receive({ type: 'clue.peers', names: ['Bruno'] })
    expect(connection.getState().cluePeers).toEqual({ phase: 'ready', names: ['Bruno'] })
    expect(connection.getState().mapPeers).toBeUndefined()
  })
})

describe('Mostrar meu mapa a… — quem recebe', () => {
  it('map.shared abre o aviso com o nome de quem mostrou, e ele some sozinho', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'map.shared', from: 'Bruno', sceneName: 'Cripta' })
    const aviso = connection.getState().mapShared
    expect(aviso?.from).toBe('Bruno')
    expect(aviso).toEqual({ id: expect.any(Number), from: 'Bruno' })
    vi.advanceTimersByTime(MAP_SHARED_NOTICE_TTL_MS)
    expect(connection.getState().mapShared).toBeUndefined()
  })

  it('aguardando sem ficha, o aviso não abre (não há mapa na tela)', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'lobby.waiting' })
    socket.receive({ type: 'map.shared', from: 'Bruno' })
    expect(connection.getState().mapShared).toBeUndefined()
    expect(connection.getState().status).toBe('waiting')
  })

  it('mensagem malformada não abre nada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'map.shared', from: 42 })
    expect(connection.getState().mapShared).toBeUndefined()
    expect(connection.getState().status).toBe('playing')
  })
})
