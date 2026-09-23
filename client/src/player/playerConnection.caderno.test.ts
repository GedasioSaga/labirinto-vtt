/**
 * CADERNO DE RECADOS no cliente do jogador: todo recado que chega fica em
 * `state.notebook` (o cartão pode fechar, o recado continua), o caderno que o
 * host manda na entrada (`notes.book`) substitui o local, e o ponto de "recado
 * novo" acende quando há recado que o jogador ainda não viu fora do cartão.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { NOTEBOOK_MAX_NOTES, NOTE_MAX_LENGTH, parseNotebook } from '../net/protocol'
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

function conectado() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Fabio',
    storage: null,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const primeiro = sockets[0]
  if (!primeiro) throw new Error('socket não criado')
  primeiro.open()
  primeiro.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Fabio' })
  return { connection, socket: primeiro, sockets }
}

function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return mesa
}

const AS_20_30 = new Date(2026, 8, 22, 20, 30).getTime()

afterEach(() => {
  vi.useRealTimers()
})

describe('parseNotebook', () => {
  it('aceita a lista e devolve cópia só com id, texto e hora', () => {
    expect(parseNotebook({ type: 'notes.book', notes: [{ id: 'n1', text: 'oi', at: AS_20_30, sceneId: 's-x' }], extra: 1 })).toEqual({
      type: 'notes.book',
      notes: [{ id: 'n1', text: 'oi', at: AS_20_30 }],
    })
    expect(parseNotebook({ type: 'notes.book', notes: [] })).toEqual({ type: 'notes.book', notes: [] })
  })

  it('um item ruim, lista grande demais ou forma errada recusam a mensagem inteira', () => {
    const ok = { id: 'n1', text: 'oi', at: AS_20_30 }
    expect(parseNotebook({ type: 'notes.book', notes: [ok, { id: 'n2', text: '', at: 1 }] })).toBeNull()
    expect(parseNotebook({ type: 'notes.book', notes: [ok, { id: 'n2', text: 'x'.repeat(NOTE_MAX_LENGTH + 1), at: 1 }] })).toBeNull()
    expect(parseNotebook({ type: 'notes.book', notes: [{ id: 'n1', text: 'oi', at: Number.NaN }] })).toBeNull()
    expect(parseNotebook({ type: 'notes.book', notes: [{ id: 'n1', text: 'oi' }] })).toBeNull()
    expect(parseNotebook({ type: 'notes.book', notes: Array.from({ length: NOTEBOOK_MAX_NOTES + 1 }, (_, i) => ({ id: `n${i}`, text: 'x', at: i })) })).toBeNull()
    expect(parseNotebook({ type: 'notes.book', notes: 'oi' })).toBeNull()
    expect(parseNotebook({ type: 'scene.note', notes: [] })).toBeNull()
  })
})

describe('caderno no cliente do jogador', () => {
  it('Fábio fecha o recado e ele continua no caderno, com a hora do mestre', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'o baú tem fundo falso', at: AS_20_30 })
    connection.dismissNote()
    expect(connection.getState().note).toBeUndefined()
    expect(connection.getState().notebook).toEqual([{ id: 'n1', text: 'o baú tem fundo falso', at: AS_20_30 }])
  })

  it('recado novo não apaga o anterior do caderno; o mesmo id não duplica', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'primeiro', at: 1 })
    socket.receive({ type: 'scene.note', id: 'n2', text: 'segundo', at: 2 })
    socket.receive({ type: 'scene.note', id: 'n2', text: 'segundo', at: 2 })
    expect(connection.getState().notebook?.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(connection.getState().note).toEqual({ id: 'n2', text: 'segundo' })
  })

  it('mestre antigo (sem `at`): a hora é a da chegada', () => {
    vi.useFakeTimers()
    vi.setSystemTime(AS_20_30)
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'sem hora' })
    expect(connection.getState().notebook).toEqual([{ id: 'n1', text: 'sem hora', at: AS_20_30 }])
  })

  it('guarda no máximo NOTEBOOK_MAX_NOTES: sai o mais antigo', () => {
    const { connection, socket } = jogando()
    for (let i = 0; i < NOTEBOOK_MAX_NOTES + 3; i += 1) socket.receive({ type: 'scene.note', id: `n${i}`, text: `r${i}`, at: i })
    const caderno = connection.getState().notebook ?? []
    expect(caderno).toHaveLength(NOTEBOOK_MAX_NOTES)
    expect(caderno[0]?.id).toBe('n3')
  })

  it('notes.book (entrada ou volta) substitui o caderno, inclusive aguardando; malformado não apaga nada', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'lobby.waiting' })
    socket.receive({ type: 'notes.book', notes: [{ id: 'n1', text: 'guardado', at: AS_20_30 }] })
    expect(connection.getState().notebook).toEqual([{ id: 'n1', text: 'guardado', at: AS_20_30 }])
    socket.receive({ type: 'notes.book', notes: [{ id: 'n2', text: '', at: 1 }] })
    expect(connection.getState().notebook).toEqual([{ id: 'n1', text: 'guardado', at: AS_20_30 }])
    // Voltar a aguardar (perdeu a ficha) não apaga o caderno: os recados são dele.
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().notebook).toHaveLength(1)
  })

  it('Bruno volta: o caderno chega, o recado da cena reabre o cartão e não duplica', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'notes.book', notes: [{ id: 'n1', text: 'o baú tem fundo falso', at: AS_20_30 }] })
    socket.receive({ type: 'scene.note', id: 'n1', text: 'o baú tem fundo falso', at: AS_20_30 })
    expect(connection.getState().note).toEqual({ id: 'n1', text: 'o baú tem fundo falso' })
    expect(connection.getState().notebook).toHaveLength(1)
    // Recado que ele já tinha não é "novo".
    connection.dismissNote()
    expect(hasUnreadNotes(connection.getState())).toBe(false)
  })

  it('reconnect esvazia o caderno local: quem manda o caderno de volta é o host', () => {
    const { connection, socket, sockets } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'oi', at: 1 })
    connection.reconnect()
    expect(connection.getState().notebook).toBeUndefined()
    expect(sockets).toHaveLength(2)
  })
})

describe('ponto de recado novo', () => {
  it('recado aberto no cartão não acende o ponto; fechar o cartão também não', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'lido no cartão', at: 1 })
    expect(hasUnreadNotes(connection.getState())).toBe(false)
    connection.dismissNote()
    expect(hasUnreadNotes(connection.getState())).toBe(false)
  })

  it('recado que chegou por cima de outro aberto deixa o anterior sem ler: o ponto acende até abrir o caderno', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'primeiro', at: 1 })
    socket.receive({ type: 'scene.note', id: 'n2', text: 'segundo', at: 2 })
    expect(hasUnreadNotes(connection.getState())).toBe(true)
    connection.dismissNote()
    expect(hasUnreadNotes(connection.getState())).toBe(true)
    connection.markNotebookRead()
    expect(hasUnreadNotes(connection.getState())).toBe(false)
  })

  it('caderno recebido na entrada não conta como novo', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'notes.book', notes: [{ id: 'n1', text: 'velho', at: 1 }, { id: 'n2', text: 'velho 2', at: 2 }] })
    expect(hasUnreadNotes(connection.getState())).toBe(false)
  })
})
