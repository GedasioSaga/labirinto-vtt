/**
 * COMPANHEIROS no cliente do jogador: `party.update` vira `state.party`. Lista
 * malformada cai inteira (não aparece meio grupo) e campo desconhecido — um
 * `sceneId` que viesse junto — não chega à tela.
 */
import { describe, expect, it } from 'vitest'
import { PARTY_MAX_MEMBERS, parsePartyUpdate } from '../net/protocol'
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

function conectado() {
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
  return { connection, socket, sockets }
}

describe('parsePartyUpdate', () => {
  it('aceita a lista e devolve só playerId, nome e onde', () => {
    const lista = { type: 'party.update', members: [{ playerId: 'p2', name: 'Bruno', where: 'longe', sceneId: 's-cripta', sceneName: 'Cripta Rubra' }] }
    expect(parsePartyUpdate(lista)).toEqual({ type: 'party.update', members: [{ playerId: 'p2', name: 'Bruno', where: 'longe' }] })
    expect(parsePartyUpdate({ type: 'party.update', members: [] })).toEqual({ type: 'party.update', members: [] })
  })

  it('recusa a lista inteira quando um membro vem malformado ou a lista passa do teto', () => {
    const ok = { playerId: 'p2', name: 'Bruno', where: 'aqui' }
    expect(parsePartyUpdate({ type: 'party.update', members: [ok, { ...ok, where: 'cripta' }] })).toBeNull()
    expect(parsePartyUpdate({ type: 'party.update', members: [ok, { ...ok, name: '' }] })).toBeNull()
    expect(parsePartyUpdate({ type: 'party.update', members: [ok, { ...ok, playerId: '' }] })).toBeNull()
    expect(parsePartyUpdate({ type: 'party.update', members: [ok, 'Bruno'] })).toBeNull()
    expect(parsePartyUpdate({ type: 'party.update', members: 'Bruno' })).toBeNull()
    expect(parsePartyUpdate({ type: 'party.update', members: Array.from({ length: PARTY_MAX_MEMBERS + 1 }, () => ok) })).toBeNull()
    expect(parsePartyUpdate({ type: 'scene.note', members: [ok] })).toBeNull()
  })
})

describe('party.update no cliente', () => {
  it('chega na espera do lobby e fica em state.party', () => {
    const { connection, socket } = conectado()
    expect(connection.getState().party).toBeUndefined()
    socket.receive({ type: 'party.update', members: [{ playerId: 'p2', name: 'Bruno', where: 'aqui' }] })
    expect(connection.getState().party).toEqual([{ playerId: 'p2', name: 'Bruno', where: 'aqui' }])
  })

  it('a lista nova substitui a velha; a malformada é ignorada e a anterior fica', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'party.update', members: [{ playerId: 'p2', name: 'Bruno', where: 'aqui' }] })
    socket.receive({ type: 'party.update', members: [{ playerId: 'p2', name: 'Bruno', where: 'fora' }] })
    expect(connection.getState().party).toEqual([{ playerId: 'p2', name: 'Bruno', where: 'fora' }])
    socket.receive({ type: 'party.update', members: [{ playerId: 'p2', name: 'Bruno', where: 'Cripta Rubra' }] })
    expect(connection.getState().party).toEqual([{ playerId: 'p2', name: 'Bruno', where: 'fora' }])
  })

  it('lobby.waiting não apaga a lista: o mestre só reenvia quando muda', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'party.update', members: [{ playerId: 'p2', name: 'Bruno', where: 'longe' }] })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().party).toEqual([{ playerId: 'p2', name: 'Bruno', where: 'longe' }])
  })
})
