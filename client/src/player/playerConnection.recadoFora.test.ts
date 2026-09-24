/**
 * RECADO PARA QUEM ESTÁ FORA no cliente do jogador: o `notes.away` da volta
 * vira o cartão "Enquanto você esteve fora" (`state.awayNotes`), os recados
 * entram no Caderno e ficam novos até ele fechar o cartão. Forma errada não
 * mostra nada pela metade.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { AWAY_NOTES_MAX, NOTE_MAX_LENGTH, parseNotesAway } from '../net/protocol'
import { createPlayerConnection, hasUnreadNotes, type SocketLike } from './playerConnection'

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
    name: 'Bruno',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Bruno' })
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

const AS_20_30 = new Date(2026, 8, 24, 20, 30).getTime()
const UM = { id: 'n1', text: 'a guarda troca à meia-noite', at: AS_20_30 }
const DOIS = { id: 'n2', text: 'a chave está no balde', at: AS_20_30 + 60_000 }

describe('parseNotesAway', () => {
  it('aceita a lista e devolve cópia só com id, texto e hora', () => {
    expect(parseNotesAway({ type: 'notes.away', notes: [{ ...UM, sceneId: 's-x' }], extra: 1 })).toEqual({ type: 'notes.away', notes: [UM] })
  })

  it('lista vazia, item ruim, lista grande demais ou forma errada recusam a mensagem inteira', () => {
    expect(parseNotesAway({ type: 'notes.away', notes: [] })).toBeNull()
    expect(parseNotesAway({ type: 'notes.away', notes: [UM, { id: 'n2', text: '', at: 1 }] })).toBeNull()
    expect(parseNotesAway({ type: 'notes.away', notes: [UM, { id: 'n2', text: 'x'.repeat(NOTE_MAX_LENGTH + 1), at: 1 }] })).toBeNull()
    expect(parseNotesAway({ type: 'notes.away', notes: Array.from({ length: AWAY_NOTES_MAX + 1 }, (_, i) => ({ id: `n${i}`, text: 'x', at: i })) })).toBeNull()
    expect(parseNotesAway({ type: 'notes.book', notes: [UM] })).toBeNull()
    expect(parseNotesAway({ type: 'notes.away' })).toBeNull()
  })
})

describe('recado para quem está fora (jogador)', () => {
  it('a volta com dois recados abre o cartão com os dois, em ordem, e eles ficam no Caderno', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'notes.book', notes: [UM, DOIS] })
    socket.receive({ type: 'notes.away', notes: [UM, DOIS] })
    const state = connection.getState()
    expect(state.awayNotes).toEqual([UM, DOIS])
    expect(state.notebook).toEqual([UM, DOIS])
    // Estão no cartão aberto: não acendem o ponto de "recado novo".
    expect(hasUnreadNotes(state)).toBe(false)
  })

  it('sem o caderno antes (mestre que só manda a fila), os recados entram no Caderno sem repetir', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'notes.book', notes: [UM] })
    socket.receive({ type: 'notes.away', notes: [UM, DOIS] })
    expect(connection.getState().notebook).toEqual([UM, DOIS])
  })

  it('fechar o cartão tira os recados da tela e eles deixam de ser novos; o Caderno continua com eles', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'notes.away', notes: [UM, DOIS] })
    connection.dismissAwayNotes()
    const state = connection.getState()
    expect(state.awayNotes).toBeUndefined()
    expect(state.notebook).toEqual([UM, DOIS])
    expect(state.unreadNotes ?? []).toEqual([])
    expect(hasUnreadNotes(state)).toBe(false)
  })

  it('fila com forma errada não abre cartão nem mexe no Caderno', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'notes.away', notes: [UM, { id: 'n2', text: '' }] })
    expect(connection.getState().awayNotes).toBeUndefined()
    expect(connection.getState().notebook).toBeUndefined()
  })

  it('chega aguardando (a ficha saiu dele enquanto estava fora): o cartão espera, guardado', () => {
    const sockets: FakeSocket[] = []
    const connection = createPlayerConnection({
      url: 'ws://host/ws',
      code: 'ABC123',
      name: 'Bruno',
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
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Bruno' })
    socket.receive({ type: 'lobby.waiting' })
    socket.receive({ type: 'notes.away', notes: [UM] })
    expect(connection.getState().status).toBe('waiting')
    expect(connection.getState().awayNotes).toEqual([UM])
  })
})
