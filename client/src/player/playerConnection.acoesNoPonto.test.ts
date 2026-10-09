/**
 * CHAMAR O MESTRE AQUI no cliente do jogador: o pedido sai com o ponto arredondado,
 * a espera aparece na hora, e a resposta do mestre vira o aviso que o jogador
 * lê ("Chamado: nada aqui, diz o mestre"). Com vários chamados esperando ao
 * mesmo tempo, a espera dos que sobram volta à tela.
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
    const message = JSON.parse(data) as { type?: unknown }
    this.sent.push(message)
    // Host vivo responde ao ping: sem isso, a espera longa dos avisos passaria
    // do prazo de silêncio e a conexão cairia no meio do teste.
    if (message.type === 'ping') this.receive({ type: 'pong' })
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

describe('chamar o mestre aqui (jogador)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('"Chamar o mestre aqui" envia o pedido com o ponto e mostra a espera', () => {
    const { connection, socket } = jogando()
    expect(connection.sendPointAction('chamar', 120.4, 130.6)).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'point.action', action: 'chamar', x: 120, y: 131 })
    expect(textoDoAviso(connection)).toBe('Chamado: esperando o mestre')
  })

  it('"Nada aqui" do mestre: Fabi lê "Chamado: nada aqui, diz o mestre", que some sozinho', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    socket.receive({ type: 'point.action.answer', action: 'chamar', answer: 'nothing' })
    expect(textoDoAviso(connection)).toBe('Chamado: nada aqui, diz o mestre')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  it('"Visto" do mestre: Fabi lê "Chamado: o mestre viu"', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    socket.receive({ type: 'point.action.answer', action: 'chamar', answer: 'seen' })
    expect(textoDoAviso(connection)).toBe('Chamado: o mestre viu')
  })

  // O host aceita até MAX_PENDING_POINT_ACTIONS_PER_PLAYER chamados esperando:
  // a resposta de um não pode apagar a espera dos outros.
  it('dois chamados esperando: a espera continua até a segunda resposta', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    vi.advanceTimersByTime(1000)
    connection.sendPointAction('chamar', 200, 130)
    expect(textoDoAviso(connection)).toBe('Chamado: esperando o mestre')
    socket.receive({ type: 'point.action.answer', action: 'chamar', answer: 'nothing' })
    expect(textoDoAviso(connection)).toBe('Chamado: nada aqui, diz o mestre')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(textoDoAviso(connection)).toBe('Chamado: esperando o mestre')
    // A espera que voltou fica até a resposta, sem prazo.
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS * 3)
    expect(textoDoAviso(connection)).toBe('Chamado: esperando o mestre')
    socket.receive({ type: 'point.action.answer', action: 'chamar', answer: 'seen' })
    expect(textoDoAviso(connection)).toBe('Chamado: o mestre viu')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  // O host recusa na hora, na ordem em que recebe: a recusa é do chamado mais
  // novo, e o que já estava esperando continua esperando.
  it('recusa do segundo chamado não apaga a espera do primeiro', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    connection.sendPointAction('chamar', 200, 130)
    socket.receive({ type: 'point.action.rejected', reason: 'too_soon' })
    expect(textoDoAviso(connection)).toBe('Espere um instante para pedir de novo')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(textoDoAviso(connection)).toBe('Chamado: esperando o mestre')
  })

  it('voltar ao lobby esquece os chamados: resposta tardia não traz espera velha', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    connection.sendPointAction('chamar', 200, 130)
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().pointNotice).toBeUndefined()
    socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    socket.receive({ type: 'point.action.answer', action: 'chamar', answer: 'nothing' })
    expect(textoDoAviso(connection)).toBe('Chamado: nada aqui, diz o mestre')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  it('recusa do host vira aviso de espera, sem mentir que o chamado foi', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    socket.receive({ type: 'point.action.rejected', reason: 'too_soon' })
    expect(textoDoAviso(connection)).toBe('Espere um instante para pedir de novo')
    socket.receive({ type: 'point.action.rejected', reason: 'pending' })
    expect(textoDoAviso(connection)).toBe('Espere o mestre responder seus pedidos')
  })

  it('resposta malformada, ou de uma ação que não existe mais (Revistar), é ignorada e não apaga a espera', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    socket.receive({ type: 'point.action.answer', action: 'revistar', answer: 'nothing' })
    socket.receive({ type: 'point.action.answer', action: 'chamar', answer: 'talvez' })
    socket.receive({ type: 'point.action.rejected', reason: 'outro' })
    expect(textoDoAviso(connection)).toBe('Chamado: esperando o mestre')
  })

  it('ponto fora do mapa não sai e não deixa "esperando o mestre" na tela', () => {
    // O mapa de `jogando()` tem 10 x 10 casas de 50 px: 0..500 nos dois eixos.
    const { connection, socket } = jogando()
    expect(connection.sendPointAction('chamar', -10, 100)).toBe(false)
    expect(connection.sendPointAction('chamar', 100, 520)).toBe(false)
    expect(socket.sent.some((m) => JSON.stringify(m).includes('point.action'))).toBe(false)
    expect(connection.getState().pointNotice).toBeUndefined()
    // A borda ainda é do mapa.
    expect(connection.sendPointAction('chamar', 500, 0)).toBe(true)
  })

  it('recusa "fora do mapa" do host troca a espera por um aviso que some sozinho', () => {
    const { connection, socket } = jogando()
    connection.sendPointAction('chamar', 120, 130)
    socket.receive({ type: 'point.action.rejected', reason: 'out_of_map' })
    expect(textoDoAviso(connection)).toBe('Esse ponto fica fora do mapa')
    vi.advanceTimersByTime(POINT_NOTICE_TTL_MS)
    expect(connection.getState().pointNotice).toBeUndefined()
  })

  it('fora do jogo não envia, e ponto não finito não sai', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.sendPointAction('chamar', 1, 1)).toBe(false)
    const mesa = jogando()
    expect(mesa.connection.sendPointAction('chamar', Number.NaN, 1)).toBe(false)
    expect(mesa.socket.sent.some((m) => JSON.stringify(m).includes('point.action'))).toBe(false)
  })
})
