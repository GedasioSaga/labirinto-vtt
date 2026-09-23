/**
 * AÇÕES NO PONTO no cliente do jogador: o pedido sai com o ponto arredondado,
 * a espera aparece na hora, e a resposta do mestre vira o aviso que o jogador
 * lê, com o nome da ação ("Procurar: você não encontrou nada"). Com vários
 * pedidos esperando ao mesmo tempo, a espera dos que sobram volta à tela.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { POINT_NOTICE_TTL_MS, pointNoticeText } from '../lib/pointActions'
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

function conectado() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Fabi',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Fabi' })
  return { connection, socket }
}

function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return mesa
}

function textoDoAviso(connection: ReturnType<typeof conectado>['connection']): string | null {
  const notice = connection.getState().pointNotice
  return notice === undefined ? null : pointNoticeText(notice)
}

describe('ações no ponto (jogador)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Procurar envia o pedido com o ponto e mostra a espera', () => {
    const { connection, socket } = jogando()
    expect(connection.sendPointAction('procurar', 120.4, 130.6)).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'point.action', action: 'procurar', x: 120, y: 131 })
    expect(textoDoAviso(connection)).toBe('Procurar: esperando o mestre')
  })

  it('"Nada aqui" do mestre: Fabi lê "Procurar: você não encontrou nada", que some sozinho', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('procurar', 120, 130)
    socket.receive({ type: 'point.action.answer', action: 'procurar', answer: 'nothing' })
    expect(textoDoAviso(connection)).toBe('Procurar: você não encontrou nada')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  it('"Feito" do mestre: Fabi lê "Escutar: o mestre viu"', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('escutar', 120, 130)
    socket.receive({ type: 'point.action.answer', action: 'escutar', answer: 'seen' })
    expect(textoDoAviso(connection)).toBe('Escutar: o mestre viu')
  })

  // O host aceita até MAX_PENDING_POINT_ACTIONS_PER_PLAYER pedidos esperando:
  // a resposta de um não pode apagar a espera dos outros, nem ficar sem dono.
  it('dois pedidos esperando: a resposta nomeia a ação e a espera do outro volta', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('procurar', 120, 130)
    vi.advanceTimersByTime(1000)
    connection.sendPointAction('escutar', 200, 130)
    expect(textoDoAviso(connection)).toBe('Procurar e Escutar: esperando o mestre')
    socket.receive({ type: 'point.action.answer', action: 'procurar', answer: 'nothing' })
    expect(textoDoAviso(connection)).toBe('Procurar: você não encontrou nada')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(textoDoAviso(connection)).toBe('Escutar: esperando o mestre')
    // A espera que voltou fica até a resposta, sem prazo.
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS * 3)
    expect(textoDoAviso(connection)).toBe('Escutar: esperando o mestre')
    socket.receive({ type: 'point.action.answer', action: 'escutar', answer: 'seen' })
    expect(textoDoAviso(connection)).toBe('Escutar: o mestre viu')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  it('três esperando, respondidos fora de ordem: cada resposta tira só o seu', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('procurar', 120, 130)
    connection.sendPointAction('escutar', 200, 130)
    connection.sendPointAction('espiar', 300, 130)
    expect(textoDoAviso(connection)).toBe('Procurar, Escutar e Espiar: esperando o mestre')
    socket.receive({ type: 'point.action.answer', action: 'escutar', answer: 'seen' })
    expect(textoDoAviso(connection)).toBe('Escutar: o mestre viu')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(textoDoAviso(connection)).toBe('Procurar e Espiar: esperando o mestre')
  })

  it('o mesmo pedido duas vezes: a espera continua até a segunda resposta', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('procurar', 120, 130)
    connection.sendPointAction('procurar', 200, 130)
    expect(textoDoAviso(connection)).toBe('Procurar: esperando o mestre')
    socket.receive({ type: 'point.action.answer', action: 'procurar', answer: 'nothing' })
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(textoDoAviso(connection)).toBe('Procurar: esperando o mestre')
    socket.receive({ type: 'point.action.answer', action: 'procurar', answer: 'seen' })
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  // O host recusa na hora, na ordem em que recebe: a recusa é do pedido mais
  // novo, e o que já estava esperando continua esperando.
  it('recusa do segundo pedido não apaga a espera do primeiro', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('procurar', 120, 130)
    connection.sendPointAction('escutar', 200, 130)
    socket.receive({ type: 'point.action.rejected', reason: 'too_soon' })
    expect(textoDoAviso(connection)).toBe('Espere um instante para pedir de novo')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(textoDoAviso(connection)).toBe('Procurar: esperando o mestre')
  })

  it('voltar ao lobby esquece os pedidos: resposta tardia não traz espera velha', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('procurar', 120, 130)
    connection.sendPointAction('escutar', 200, 130)
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().pointNotice).toBeUndefined()
    socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    socket.receive({ type: 'point.action.answer', action: 'procurar', answer: 'nothing' })
    expect(textoDoAviso(connection)).toBe('Procurar: você não encontrou nada')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  it('recusa do host vira aviso de espera, sem mentir que o pedido foi', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('espiar', 120, 130)
    socket.receive({ type: 'point.action.rejected', reason: 'too_soon' })
    expect(textoDoAviso(connection)).toBe('Espere um instante para pedir de novo')
    socket.receive({ type: 'point.action.rejected', reason: 'pending' })
    expect(textoDoAviso(connection)).toBe('Espere o mestre responder seus pedidos')
  })

  it('resposta malformada é ignorada e não apaga a espera', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('revistar', 120, 130)
    socket.receive({ type: 'point.action.answer', action: 'roubar', answer: 'nothing' })
    socket.receive({ type: 'point.action.answer', action: 'revistar', answer: 'talvez' })
    socket.receive({ type: 'point.action.rejected', reason: 'outro' })
    expect(textoDoAviso(connection)).toBe('Revistar: esperando o mestre')
  })

  it('ponto fora do mapa não sai e não deixa "esperando o mestre" na tela', () => {
    // O mapa de `jogando()` tem 10 x 10 casas de 50 px: 0..500 nos dois eixos.
    const { connection, socket } = jogando()
    expect(connection.sendPointAction('procurar', -10, 100)).toBe(false)
    expect(connection.sendPointAction('procurar', 100, 520)).toBe(false)
    expect(socket.sent.some((m) => JSON.stringify(m).includes('point.action'))).toBe(false)
    expect(connection.getState().pointNotice).toBeUndefined()
    // A borda ainda é do mapa.
    expect(connection.sendPointAction('procurar', 500, 0)).toBe(true)
  })

  it('recusa "fora do mapa" do host troca a espera por um aviso que some sozinho', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('procurar', 120, 130)
    socket.receive({ type: 'point.action.rejected', reason: 'out_of_map' })
    expect(textoDoAviso(connection)).toBe('Esse ponto fica fora do mapa')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  it('fora do jogo não envia, e ponto não finito não sai', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.sendPointAction('procurar', 1, 1)).toBe(false)
    const mesa = jogando()
    expect(mesa.connection.sendPointAction('procurar', Number.NaN, 1)).toBe(false)
    expect(mesa.socket.sent.some((m) => JSON.stringify(m).includes('point.action'))).toBe(false)
  })
})
