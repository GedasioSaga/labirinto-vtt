/**
 * Quem chega escolhe a própria ficha, no cliente do jogador: `seat.options`
 * vira `state.seatOptions`, `claimSeat` manda o pedido e `seat.claim.state`
 * diz onde ele está. O mapa que chega com a ficha encerra o pedido.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createHostSession, type HostResult, type HostWorld } from '../net/hostSession'
import type { Token } from '../types/map'
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
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

function naEspera() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Hugo',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Hugo' })
  socket.receive({ type: 'lobby.waiting' })
  return { connection, socket }
}

const claims = (socket: FakeSocket) => socket.sent.filter((m) => JSON.stringify(m).includes('"seat.claim"'))

describe('escolher a ficha na espera', () => {
  it('seat.options vira state.seatOptions; lista malformada é ignorada e a anterior fica', () => {
    const { connection, socket } = naEspera()
    expect(connection.getState().seatOptions).toBeUndefined()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    expect(connection.getState().seatOptions).toEqual([{ tokenId: 't-kael', name: 'Kael' }])
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: '', name: 'Kael' }] })
    expect(connection.getState().seatOptions).toEqual([{ tokenId: 't-kael', name: 'Kael' }])
  })

  it('claimSeat manda o pedido de uma ficha da lista; fora da lista não manda nada', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    expect(connection.claimSeat('t-lira')).toBe(false)
    expect(claims(socket)).toEqual([])
    expect(connection.claimSeat('t-kael')).toBe(true)
    expect(claims(socket)).toEqual([{ type: 'seat.claim', tokenId: 't-kael' }])
    expect(connection.getState().seatClaim).toEqual({ id: expect.any(Number), phase: 'sent', tokenId: 't-kael', name: 'Kael' })
  })

  it('seat.claim.state muda a fase; estado desconhecido é ignorado', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    connection.claimSeat('t-kael')
    socket.receive({ type: 'seat.claim.state', state: 'pending' })
    expect(connection.getState().seatClaim?.phase).toBe('pending')
    socket.receive({ type: 'seat.claim.state', state: 'talvez' })
    expect(connection.getState().seatClaim?.phase).toBe('pending')
    socket.receive({ type: 'seat.claim.state', state: 'denied' })
    expect(connection.getState().seatClaim).toEqual({ id: expect.any(Number), phase: 'denied', tokenId: 't-kael', name: 'Kael' })
  })

  it('o mapa com a ficha encerra o pedido', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    connection.claimSeat('t-kael')
    socket.receive({ type: 'seat.claim.state', state: 'pending' })
    socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().seatClaim).toBeUndefined()
    // Jogando, não pede ficha.
    expect(connection.claimSeat('t-kael')).toBe(false)
  })

  it('com um pedido esperando o mestre, não manda outro', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }, { tokenId: 't-bruna', name: 'Bruna' }] })
    connection.claimSeat('t-kael')
    socket.receive({ type: 'seat.claim.state', state: 'pending' })
    expect(connection.claimSeat('t-bruna')).toBe(false)
    expect(claims(socket)).toHaveLength(1)
  })
})

describe('a lista velha não fica na tela de espera', () => {
  it('welcome novo (volta da queda, "É ela") apaga a lista: é a conexão nova, e o host manda a atual', () => {
    const { connection, socket } = naEspera()
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    expect(connection.getState().seatOptions).toEqual([{ tokenId: 't-kael', name: 'Kael' }])
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Hugo' })
    expect(connection.getState().seatOptions).toBeUndefined()
    expect(connection.getState().status).toBe('waiting')
  })

  it('ponta a ponta: Hugo joga com Kael, Zé ganha Bruna, o mestre desmarca Kael; na espera, Hugo não vê Bruna nem Kael', () => {
    const CODE = 'ABC123'
    const pc = (id: string, name: string, playerCharacter = true): Token => ({ id, characterId: null, name, x: 125, y: 125, size: 1, image: null, playerCharacter })
    const mundo = (kaelMarcado: boolean): HostWorld => ({
      open: { sceneId: null, name: 'Vila', map: { ...createEmptyMap('m1', 'Vila', 20, 10, 50), tokens: [pc('t-kael', 'Kael', kaelMarcado), pc('t-bruna', 'Bruna')] } },
      background: [],
    })
    let n = 0
    const host = createHostSession({ code: CODE, visionRadius: 300, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const { connection, socket } = naEspera()
    const paraHugo = (r: HostResult) => {
      for (const o of r.outbound) if (o.clientId === 'c-hugo') socket.receive(o.msg)
      return r
    }
    const entrou = paraHugo(host.handleMessage('c-hugo', { type: 'join', code: CODE, name: 'Hugo' }, mundo(true)))
    const hugo = entrou.outbound[0]?.msg.type === 'welcome' ? entrou.outbound[0].msg.playerId : ''
    expect(connection.getState().seatOptions).toEqual([{ tokenId: 't-bruna', name: 'Bruna' }, { tokenId: 't-kael', name: 'Kael' }])
    paraHugo(host.assignToken(hugo, 't-kael'))
    paraHugo(host.broadcast(mundo(true)))
    paraHugo(host.seatOptionsUpdates(mundo(true)))
    expect(connection.getState().status).toBe('playing')
    const ze = host.handleMessage('c-ze', { type: 'join', code: CODE, name: 'Zé' }, mundo(true)).outbound[0]?.msg
    host.assignToken(ze?.type === 'welcome' ? ze.playerId : '', 't-bruna')
    paraHugo(host.seatOptionsUpdates(mundo(true)))
    paraHugo(host.unassignToken(hugo, 't-kael'))
    paraHugo(host.seatOptionsUpdates(mundo(false)))
    expect(connection.getState().status).toBe('waiting')
    expect(connection.getState().seatOptions).toEqual([])
    expect(connection.claimSeat('t-bruna')).toBe(false)
  })
})
