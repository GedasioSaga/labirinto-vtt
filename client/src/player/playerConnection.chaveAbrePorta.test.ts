/**
 * CHAVE ABRE PORTA no cliente do jogador: o "Trancada" de quem tem a chave
 * guarda o nome dela, e "Usar" manda só a porta — o host confere a mochila.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
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

function jogando() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Diego',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Diego' })
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('chave na mochila no cliente do jogador', () => {
  it('"Trancada" com chave guarda o nome dela; sem chave, o aviso vem sem nome', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked', key: 'Chave do Escudo' })
    expect(connection.getState().doorNotice).toMatchObject({ reason: 'locked', wallId: 'escritorio', key: 'Chave do Escudo' })
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked' })
    const semChave = connection.getState().doorNotice
    expect(semChave).toMatchObject({ reason: 'locked', wallId: 'escritorio' })
    expect(semChave !== undefined && 'key' in semChave).toBe(false)
  })

  it('nome de chave que não é texto, ou numa recusa que não é "Trancada", é descartado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked', key: { nome: 'x' } })
    expect(connection.getState().doorNotice?.key).toBeUndefined()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'far', key: 'Chave do Escudo' })
    expect(connection.getState().doorNotice?.key).toBeUndefined()
    expect(connection.getState().doorNotice?.reason).toBe('far')
  })

  it('"Usar Chave do Escudo" manda só a porta e fecha o aviso', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'door.toggle.rejected', wallId: 'escritorio', reason: 'locked', key: 'Chave do Escudo' })
    expect(connection.useDoorKey('escritorio')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'door.useKey', wallId: 'escritorio' })
    expect(connection.getState().doorNotice).toBeUndefined()
  })
})
