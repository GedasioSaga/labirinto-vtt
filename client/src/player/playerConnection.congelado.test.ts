/**
 * CONGELAR FICHA no cliente do jogador: o host recusa com `congelado` e a
 * tela diz por quê — no passo (a ficha volta e o rodapé avisa) e na passagem
 * (o aviso de baixo troca "Aguardando…" pela recusa). O campo chega na
 * própria ficha pelo snapshot, como veio.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(data: string): void {
    this.sent.push(data)
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

const PORTA: Pin = { id: 'porta', x: 100, y: 75, kind: 'viagem', description: 'Porta', image: null }

function lanterna(extra: Partial<Token> = {}): Token {
  return { id: 'lanterna', characterId: null, name: 'Lanterna', x: 75, y: 75, size: 1, image: null, ...extra }
}

function conectado(ficha: Token) {
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
  socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [ficha], pins: [PORTA] }, vision: [], ownTokens: ['lanterna'], concealed: [] })
  return { connection, socket }
}

/** O `reqId` do último pedido de passo que a tela mandou. */
function ultimoReqId(socket: FakeSocket): string {
  const enviado: unknown = JSON.parse(socket.sent.at(-1) ?? '{}')
  if (typeof enviado !== 'object' || enviado === null || !('reqId' in enviado) || typeof enviado.reqId !== 'string') throw new Error('esperava um pedido de passo')
  return enviado.reqId
}

describe('cliente do jogador — ficha congelada', () => {
  it('o snapshot traz a própria ficha com `congelado`, como veio', () => {
    const { connection } = conectado(lanterna({ congelado: true }))
    expect(connection.getState().map?.tokens.find((t) => t.id === 'lanterna')?.congelado).toBe(true)
  })

  it('passo recusado com `congelado`: a ficha volta e o rodapé ganha o motivo', () => {
    const { connection, socket } = conectado(lanterna({ congelado: true }))
    connection.requestMove('lanterna', 175, 75)
    socket.receive({ type: 'token.move.rejected', reqId: ultimoReqId(socket), reason: 'congelado' })
    expect(connection.getState().map?.tokens.find((t) => t.id === 'lanterna')).toMatchObject({ x: 75, y: 75 })
    expect(connection.getState().moveNotice?.reason).toBe('congelado')
  })

  it('passagem recusada com `congelado`: o aviso de baixo leva o motivo', () => {
    const { connection, socket } = conectado(lanterna({ congelado: true }))
    expect(connection.requestTravel('porta')).toBe(true)
    socket.receive({ type: 'pin.travel.rejected', reason: 'congelado' })
    expect(connection.getState().travel).toMatchObject({ phase: 'rejected', reason: 'congelado' })
  })
})
