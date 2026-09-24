/**
 * MOSTRAR UM CAMINHO COM A RÉGUA no cliente do jogador. Quem mede pede a lista
 * de colegas da cena (a mesma de "Mostrar para…" das pistas) e manda o traço;
 * quem recebe (`route.shown`) ganha `state.sharedRoute`, que fica até ele
 * dispensar ou por 2 minutos, e some ao trocar de cena. Tudo o que chega passa
 * pelo parser: cor fora de `#rrggbb` e traço malformado não entram.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { parseRouteMessage } from '../net/protocol'
import { createPlayerConnection, SHARED_ROUTE_TTL_MS, type SocketLike } from './playerConnection'

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
    name: 'Caio',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Caio' })
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.sent = []
  return { connection, socket }
}

const TRACO = [{ x: 100, y: 100 }, { x: 300, y: 100 }]
const DO_GUI = { type: 'route.shown', from: 'Gui', color: '#3cff00', points: TRACO }

afterEach(() => {
  vi.useRealTimers()
})

describe('parseRouteMessage', () => {
  it('aceita o traço e o resultado, e devolve cópia só com os campos conhecidos', () => {
    expect(parseRouteMessage({ ...DO_GUI, sceneId: 's-casa', points: [{ x: 100, y: 100, sala: 'Cofre' }, { x: 300, y: 100 }] })).toEqual(DO_GUI)
    expect(parseRouteMessage({ type: 'route.show.result', to: 'Ana', ok: true })).toEqual({ type: 'route.show.result', to: 'Ana', ok: true })
    expect(parseRouteMessage({ type: 'route.show.result', to: 'Ana', ok: false, reason: 'too_soon' })).toEqual({
      type: 'route.show.result',
      to: 'Ana',
      ok: false,
      reason: 'too_soon',
    })
  })

  it('cor fora de #rrggbb, um ponto só, nome vazio ou forma errada recusam inteiro', () => {
    expect(parseRouteMessage({ ...DO_GUI, color: 'red; background:url(x)' })).toBeNull()
    expect(parseRouteMessage({ ...DO_GUI, points: [{ x: 1, y: 1 }] })).toBeNull()
    expect(parseRouteMessage({ ...DO_GUI, from: '' })).toBeNull()
    expect(parseRouteMessage({ type: 'route.show.result', to: 'Ana' })).toBeNull()
    expect(parseRouteMessage({ type: 'route.shown' })).toBeNull()
  })
})

describe('playerConnection: caminho da régua', () => {
  it('quem mede pede os colegas, manda o traço a um deles e lê a resposta do host', () => {
    const { connection, socket } = jogando()
    expect(connection.askRoutePeers()).toBe(true)
    expect(socket.sent).toEqual([{ type: 'clue.peers' }])
    expect(connection.getState().routePeers).toEqual({ phase: 'loading' })
    socket.receive({ type: 'clue.peers', names: ['Ana', 'Bia'] })
    expect(connection.getState().routePeers).toEqual({ phase: 'ready', names: ['Ana', 'Bia'] })
    // A lista de colegas das pistas não abre por causa da régua.
    expect(connection.getState().cluePeers).toBeUndefined()

    expect(connection.showRoute('Ana', TRACO)).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'route.show', to: 'Ana', points: TRACO })
    expect(connection.getState().routeShow).toEqual({ to: 'Ana', phase: 'sending' })
    socket.receive({ type: 'route.show.result', to: 'Ana', ok: true })
    expect(connection.getState().routeShow).toEqual({ to: 'Ana', phase: 'ok' })
  })

  it('recusa com motivo vira "espere"; sem motivo, "não chegou"', () => {
    const { connection, socket } = jogando()
    connection.showRoute('Ana', TRACO)
    socket.receive({ type: 'route.show.result', to: 'Ana', ok: false, reason: 'too_soon' })
    expect(connection.getState().routeShow).toEqual({ to: 'Ana', phase: 'too_soon' })
    connection.showRoute('Ana', TRACO)
    socket.receive({ type: 'route.show.result', to: 'Ana', ok: false })
    expect(connection.getState().routeShow).toEqual({ to: 'Ana', phase: 'failed' })
  })

  it('traço com menos de 2 pontos nem sai', () => {
    const { connection, socket } = jogando()
    expect(connection.showRoute('Ana', [{ x: 1, y: 1 }])).toBe(false)
    expect(socket.sent).toEqual([])
  })

  it('o traço de um colega entra no estado e sai ao dispensar', () => {
    const { connection, socket } = jogando()
    socket.receive(DO_GUI)
    expect(connection.getState().sharedRoute).toEqual({ id: expect.any(Number), from: 'Gui', color: '#3cff00', points: TRACO })
    connection.dismissSharedRoute()
    expect(connection.getState().sharedRoute).toBeUndefined()
  })

  it('o traço some sozinho depois de 2 minutos', () => {
    vi.useFakeTimers()
    const { connection, socket } = jogando()
    socket.receive(DO_GUI)
    vi.advanceTimersByTime(SHARED_ROUTE_TTL_MS - 1)
    expect(connection.getState().sharedRoute?.from).toBe('Gui')
    vi.advanceTimersByTime(1)
    expect(connection.getState().sharedRoute).toBeUndefined()
  })

  it('segurança: trocar de cena apaga o traço (os pontos eram do mapa de lá) e a lista de colegas', () => {
    const { connection, socket } = jogando()
    connection.askRoutePeers()
    socket.receive({ type: 'clue.peers', names: ['Ana'] })
    socket.receive(DO_GUI)
    socket.receive({ type: 'scene.changed' })
    expect(connection.getState().sharedRoute).toBeUndefined()
    expect(connection.getState().routePeers).toBeUndefined()
    expect(connection.getState().routeShow).toBeUndefined()
  })

  it('traço com cor malformada não entra', () => {
    const { connection, socket } = jogando()
    socket.receive({ ...DO_GUI, color: 'url(javascript:alert(1))' })
    expect(connection.getState().sharedRoute).toBeUndefined()
  })
})
