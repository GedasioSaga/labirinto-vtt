/**
 * NPC EMPRESTADO na conexão do jogador: a ficha que chega com `emprestada`
 * (NPC do mestre dado ao jogador) anda, mas a tela nem tenta renomear nem
 * trocar a foto — nada sai pelo socket e o nome na tela não muda. A ficha
 * própria continua editável.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, type SocketLike } from './playerConnection'

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

class FakeSocket implements SocketLike {
  readyState = 0
  enviadas: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(data: string): void {
    this.enviadas.push(data)
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

/** Gui na mesa com a própria espada e o menino (NPC emprestado pelo mestre). */
function guiComMenino() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'NPCEMP',
    name: 'Gui',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gui' })
  const map = {
    ...createEmptyMap('m1', '', 10, 10, 50),
    tokens: [
      { id: 'espada', characterId: null, name: 'Espada', x: 100, y: 100, size: 1, image: null, imageData: null },
      { id: 'menino', characterId: null, name: 'Menino', x: 200, y: 100, size: 1, image: null, imageData: null, emprestada: true },
    ],
  }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: ['espada', 'menino'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.enviadas.length = 0
  return { connection, socket }
}

function fichaNaTela(connection: ReturnType<typeof guiComMenino>['connection'], id: string) {
  return connection.getState().map?.tokens.find((t) => t.id === id)
}

describe('NPC emprestado: a tela do jogador não edita', () => {
  it('renomear o menino não sai pelo socket e o nome na tela continua o do mestre', () => {
    const { connection, socket } = guiComMenino()
    expect(connection.setOwnTokenName('menino', 'Pedrinho')).toBe(false)
    expect(socket.enviadas).toEqual([])
    expect(fichaNaTela(connection, 'menino')?.name).toBe('Menino')
  })

  it('trocar a foto do menino não sai pelo socket e a foto na tela não muda', () => {
    const { connection, socket } = guiComMenino()
    expect(connection.setOwnTokenPhoto('menino', FOTO)).toBe(false)
    expect(socket.enviadas).toEqual([])
    expect(fichaNaTela(connection, 'menino')?.imageData).toBeNull()
  })

  it('CONTROLE: a espada, ficha própria, continua renomeável', () => {
    const { connection, socket } = guiComMenino()
    expect(connection.setOwnTokenName('espada', 'Lâmina')).toBe(true)
    expect(socket.enviadas.map((m) => JSON.parse(m))).toEqual([{ type: 'token.edit', tokenId: 'espada', name: 'Lâmina' }])
    expect(fichaNaTela(connection, 'espada')?.name).toBe('Lâmina')
  })
})
