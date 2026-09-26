/**
 * CONFRONTO no cliente do jogador: o `confronto` do snapshot vira
 * `state.confronto`; snapshot sem ele apaga a faixa (o mestre encerrou, ou o
 * jogador foi para outra cena); forma torta derruba o snapshot inteiro, como
 * todo campo aditivo presente e malformado. A recusa nova vira frase.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { parsePlayerConfronto } from '../lib/confronto'
import { createPlayerConnection, type SocketLike } from './playerConnection'
import { moveNoticeText } from './moveNotice'

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
  return { connection, socket }
}

const MAPA = { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [{ id: 'ana', characterId: null, name: 'Ana', x: 75, y: 75, size: 1, image: null }] }
const FAIXA = { fila: ['rato', 'ana'], vez: 'ana', suaVez: true, passo: 6, restam: 4 }

function snapshot(rev: number, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map: MAPA, vision: [], ownTokens: ['ana'], concealed: [], ...extra }
}

describe('parsePlayerConfronto', () => {
  it('aceita a forma certa e devolve só os campos conhecidos', () => {
    expect(parsePlayerConfronto({ ...FAIXA, turno: 9 })).toEqual(FAIXA)
    expect(parsePlayerConfronto({ fila: [], vez: null, suaVez: false, passo: 1, restam: null })).toEqual({ fila: [], vez: null, suaVez: false, passo: 1, restam: null })
  })

  it('recusa forma torta', () => {
    expect(parsePlayerConfronto({ ...FAIXA, fila: 'ana' })).toBeNull()
    expect(parsePlayerConfronto({ ...FAIXA, fila: [3] })).toBeNull()
    expect(parsePlayerConfronto({ ...FAIXA, vez: 7 })).toBeNull()
    expect(parsePlayerConfronto({ ...FAIXA, suaVez: 'sim' })).toBeNull()
    expect(parsePlayerConfronto({ ...FAIXA, passo: 0 })).toBeNull()
    expect(parsePlayerConfronto({ ...FAIXA, restam: -1 })).toBeNull()
    expect(parsePlayerConfronto(null)).toBeNull()
  })
})

describe('confronto no estado do jogador', () => {
  it('o snapshot com confronto mostra a faixa; o seguinte sem ele apaga', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { confronto: FAIXA }))
    expect(connection.getState().confronto).toEqual(FAIXA)
    socket.receive(snapshot(2))
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().confronto).toBeUndefined()
  })

  it('confronto torto derruba o snapshot inteiro (o estado anterior fica)', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { confronto: FAIXA }))
    socket.receive(snapshot(2, { confronto: { ...FAIXA, fila: 'x' } }))
    expect(connection.getState().rev).toBe(1)
    expect(connection.getState().confronto).toEqual(FAIXA)
  })

  it('recusa "not_your_turn" e "too_far" viram aviso com frase', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { confronto: FAIXA }))
    connection.requestMove('ana', 500, 75)
    const pedido = JSON.parse(socket.sent.at(-1) ?? '{}') as { reqId?: string }
    socket.receive({ type: 'token.move.rejected', reqId: pedido.reqId, reason: 'too_far' })
    expect(connection.getState().moveNotice?.reason).toBe('too_far')
    expect(moveNoticeText('too_far')).toBe('Além do seu passo')
    expect(moveNoticeText('not_your_turn')).toBe('Espere sua vez')
  })
})
