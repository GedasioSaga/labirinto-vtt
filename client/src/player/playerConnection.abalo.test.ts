/**
 * ABALO POR DISTÂNCIA no cliente do jogador: `abalo` vira o cartão de recado
 * (`state.note`) com a seta e o "forte", e entra no Caderno. Forma errada ou
 * texto acima do teto: a mensagem inteira cai.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { NOTE_MAX_LENGTH, parseAbalo } from '../net/protocol'
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
  return { connection, socket }
}

function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return mesa
}

describe('parseAbalo', () => {
  it('aceita a forma certa e devolve só os campos conhecidos (ponto e cena ficam para trás)', () => {
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: 'treme', at: 5, forte: true, seta: 'ne', x: 10, sceneId: 's' })).toEqual({
      type: 'abalo',
      id: 'a1',
      text: 'treme',
      at: 5,
      forte: true,
      seta: 'ne',
    })
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: 'longe', at: 5, forte: false })).toEqual({ type: 'abalo', id: 'a1', text: 'longe', at: 5, forte: false })
  })

  it('seta que este jogador não conhece (mestre mais novo) cai, o texto fica', () => {
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: 'treme', at: 5, forte: true, seta: 'nne' })).toEqual({ type: 'abalo', id: 'a1', text: 'treme', at: 5, forte: true })
  })

  it('forma errada recusa inteiro', () => {
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: 'x'.repeat(NOTE_MAX_LENGTH + 1), at: 5, forte: true })).toBeNull()
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: '', at: 5, forte: true })).toBeNull()
    expect(parseAbalo({ type: 'abalo', id: '', text: 'oi', at: 5, forte: true })).toBeNull()
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: 'oi', at: -1, forte: true })).toBeNull()
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: 'oi', at: 5, forte: 'sim' })).toBeNull()
    expect(parseAbalo({ type: 'abalo', id: 'a1', text: 'oi', at: 5 })).toBeNull()
    expect(parseAbalo({ type: 'scene.note', id: 'a1', text: 'oi', at: 5, forte: true })).toBeNull()
    expect(parseAbalo(null)).toBeNull()
  })
})

describe('abalo no cliente', () => {
  it('abre o cartão com seta e forte, e guarda no Caderno como recado novo', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'abalo', id: 'a1', text: 'O chão treme.', at: 7, forte: true, seta: 'l' })
    const state = connection.getState()
    expect(state.note).toEqual({ id: 'a1', text: 'O chão treme.', seta: 'l', forte: true })
    expect(state.notebook).toEqual([{ id: 'a1', text: 'O chão treme.', at: 7 }])
    expect(state.unreadNotes).toEqual(['a1'])
  })

  it('longe: cartão sem seta e sem forte', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'abalo', id: 'a2', text: 'Um ronco distante.', at: 7, forte: false })
    expect(connection.getState().note).toEqual({ id: 'a2', text: 'Um ronco distante.' })
  })

  it('malformado não abre nada; quem aguarda não tem cartão', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'abalo', id: 'a3', text: '', at: 7, forte: true })
    expect(connection.getState().note).toBeUndefined()

    const espera = conectado()
    espera.socket.receive({ type: 'lobby.waiting' })
    espera.socket.receive({ type: 'abalo', id: 'a4', text: 'treme', at: 7, forte: true })
    expect(espera.connection.getState().note).toBeUndefined()
  })
})
