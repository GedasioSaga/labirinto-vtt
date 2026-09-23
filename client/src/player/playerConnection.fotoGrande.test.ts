/**
 * FOTO GRANDE NÃO DERRUBA O JOGADOR: o servidor da mesa fecha o socket de quem
 * manda mensagem acima de 64 KiB. O cliente recusa ANTES de enviar — a tela
 * não troca a foto, e o jogador continua na mesa.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { TOKEN_PHOTO_SEND_MAX_CHARS } from '../lib/tokenPhoto'
import { createPlayerConnection, type SocketLike } from './playerConnection'

const FOTO_PEQUENA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

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

/** Jogador na mesa, dono do token 'meu' (sem foto). */
function jogandoComToken() {
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
  const map = {
    ...createEmptyMap('m1', '', 10, 10, 50),
    tokens: [{ id: 'meu', characterId: null, name: 'Herói', x: 100, y: 100, size: 1, image: null, imageData: null }],
  }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: ['meu'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.enviadas.length = 0
  return { connection, socket }
}

function fotoDoMeuToken(connection: ReturnType<typeof jogandoComToken>['connection']) {
  return connection.getState().map?.tokens.find((t) => t.id === 'meu')?.imageData
}

describe('foto do próprio token — tamanho que o servidor aceita', () => {
  it('foto com a forma certa mas acima do teto de envio NÃO sai pelo socket e não troca a foto na tela', () => {
    const { connection, socket } = jogandoComToken()
    const grande = `data:image/png;base64,${'A'.repeat(100_000)}`

    expect(connection.setOwnTokenPhoto('meu', grande)).toBe(false)
    expect(socket.enviadas).toEqual([])
    expect(fotoDoMeuToken(connection)).toBeNull()
  })

  it('um caractere acima do teto de envio já é recusado', () => {
    const { connection, socket } = jogandoComToken()
    const prefixo = 'data:image/webp;base64,'
    const justaMaisUm = `${prefixo}${'A'.repeat(TOKEN_PHOTO_SEND_MAX_CHARS - prefixo.length + 1)}`

    expect(connection.setOwnTokenPhoto('meu', justaMaisUm)).toBe(false)
    expect(socket.enviadas).toEqual([])
  })

  it('CONTROLE: foto no teto de envio sai, uma mensagem só, e aparece na tela', () => {
    const { connection, socket } = jogandoComToken()
    const prefixo = 'data:image/webp;base64,'
    const noTeto = `${prefixo}${'A'.repeat(TOKEN_PHOTO_SEND_MAX_CHARS - prefixo.length)}`

    expect(connection.setOwnTokenPhoto('meu', noTeto)).toBe(true)
    expect(socket.enviadas).toHaveLength(1)
    expect(fotoDoMeuToken(connection)).toBe(noTeto)
  })

  it('CONTROLE: foto pequena continua saindo como antes', () => {
    const { connection, socket } = jogandoComToken()
    expect(connection.setOwnTokenPhoto('meu', FOTO_PEQUENA)).toBe(true)
    expect(socket.enviadas.map((m) => JSON.parse(m))).toEqual([{ type: 'token.edit', tokenId: 'meu', image: FOTO_PEQUENA }])
  })
})
