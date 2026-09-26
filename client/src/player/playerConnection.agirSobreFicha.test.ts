/**
 * AGIR SOBRE UMA FICHA no cliente do jogador: o pedido sai só para ficha alheia
 * que está no mapa dele, espera o mestre, e a resposta que chega com o `reqId`
 * dele vira o aviso. Resposta com outro `reqId` (ou fora de forma) não mexe em nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { TOKEN_ACTION_REPLY_MAX_LENGTH } from '../lib/tokenActions'
import { parseTokenActionHostMessage } from '../net/protocol'
import type { Token } from '../types/map'
import { createPlayerConnection, TOKEN_ACTION_NOTICE_TTL_MS, type SocketLike } from './playerConnection'

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

function ficha(id: string, x: number, y: number, name: string): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function jogando() {
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
  const map = { ...createEmptyMap('m1', '', 10, 10, 50), tokens: [ficha('lanterna', 100, 100, 'Ana'), ficha('severa', 200, 100, 'Mulher de capuz')] }
  socket.receive({ type: 'snapshot', rev: 1, map, vision: [], ownTokens: ['lanterna'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  socket.sent = []
  return { connection, socket }
}

describe('parseTokenActionHostMessage', () => {
  it('fica só com reqId e veredito; o que viesse junto (nome, cena) cai', () => {
    expect(parseTokenActionHostMessage({ type: 'token.action.answer', reqId: 'a1', accepted: true, name: 'Severa', sceneId: 's' })).toEqual({
      type: 'token.action.answer',
      reqId: 'a1',
      accepted: true,
    })
    expect(parseTokenActionHostMessage({ type: 'token.action.rejected', reqId: 'a1', reason: 'motivo-novo' })).toEqual({ type: 'token.action.rejected', reqId: 'a1', reason: 'unavailable' })
    expect(parseTokenActionHostMessage({ type: 'token.action.answer', reqId: 'a1', accepted: 'sim' })).toBeNull()
    expect(parseTokenActionHostMessage({ type: 'token.action.answer', accepted: true })).toBeNull()
  })

  it('a resposta em texto do mestre vem aparada; fora de forma ou acima do teto cai, e o veredito fica', () => {
    expect(parseTokenActionHostMessage({ type: 'token.action.answer', reqId: 'a1', accepted: true, reply: '  Subiu ontem.  ' })).toEqual({
      type: 'token.action.answer',
      reqId: 'a1',
      accepted: true,
      reply: 'Subiu ontem.',
    })
    expect(parseTokenActionHostMessage({ type: 'token.action.answer', reqId: 'a1', accepted: false, reply: 42 })).toEqual({ type: 'token.action.answer', reqId: 'a1', accepted: false })
    expect(parseTokenActionHostMessage({ type: 'token.action.answer', reqId: 'a1', accepted: true, reply: 'x'.repeat(TOKEN_ACTION_REPLY_MAX_LENGTH + 1) })).toEqual({
      type: 'token.action.answer',
      reqId: 'a1',
      accepted: true,
    })
    expect(parseTokenActionHostMessage({ type: 'token.action.answer', reqId: 'a1', accepted: true, reply: '   ' })).toEqual({ type: 'token.action.answer', reqId: 'a1', accepted: true })
  })
})

describe('pedido de ação sobre ficha no cliente', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('manda o pedido da ficha alheia e fica aguardando o mestre', () => {
    const { connection, socket } = jogando()
    expect(connection.requestTokenAction('severa', 'falar', ' Oi ')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'token.action', reqId: expect.any(String), tokenId: 'severa', action: 'falar', text: 'Oi' }])
    expect(connection.getState().tokenAction).toEqual({ id: expect.any(Number), phase: 'waiting', action: 'falar', targetName: 'Mulher de capuz' })
  })

  it('sem texto, o campo nem vai; a própria ficha, ficha que não está no mapa e pedido em espera não saem', () => {
    const { connection, socket } = jogando()
    expect(connection.requestTokenAction('lanterna', 'empurrar')).toBe(false)
    expect(connection.requestTokenAction('fantasma', 'empurrar')).toBe(false)
    expect(socket.sent).toEqual([])
    expect(connection.requestTokenAction('severa', 'empurrar', '   ')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'token.action', reqId: expect.any(String), tokenId: 'severa', action: 'empurrar' }])
    expect(connection.requestTokenAction('severa', 'oferecer')).toBe(false)
    expect(socket.sent).toHaveLength(1)
  })

  it('a resposta com o reqId dele vira o aviso, e o aviso some sozinho', () => {
    const { connection, socket } = jogando()
    connection.requestTokenAction('severa', 'empurrar')
    const pedido = socket.sent[0]
    const reqId = typeof pedido === 'object' && pedido !== null && 'reqId' in pedido ? pedido.reqId : null
    // Resposta de outro pedido (atrasada, ou de outra aba): não é desta espera.
    socket.receive({ type: 'token.action.answer', reqId: 'outro', accepted: true })
    expect(connection.getState().tokenAction?.phase).toBe('waiting')
    socket.receive({ type: 'token.action.answer', reqId, accepted: true })
    expect(connection.getState().tokenAction).toEqual({ id: expect.any(Number), phase: 'accepted', action: 'empurrar', targetName: 'Mulher de capuz' })
    vi.advanceTimersByTime(TOKEN_ACTION_NOTICE_TTL_MS)
    expect(connection.getState().tokenAction).toBeUndefined()
    // Livre de novo: o próximo pedido sai.
    expect(connection.requestTokenAction('severa', 'falar', 'Obrigada')).toBe(true)
  })

  it('recusa do mestre e recusa do host viram avisos diferentes', () => {
    const { connection, socket } = jogando()
    connection.requestTokenAction('severa', 'oferecer', 'uma moeda')
    const first = socket.sent[0]
    const reqId = typeof first === 'object' && first !== null && 'reqId' in first ? first.reqId : null
    socket.receive({ type: 'token.action.answer', reqId, accepted: false })
    expect(connection.getState().tokenAction).toMatchObject({ phase: 'refused', action: 'oferecer' })
    vi.advanceTimersByTime(TOKEN_ACTION_NOTICE_TTL_MS)
    connection.requestTokenAction('severa', 'empurrar')
    // O prazo do aviso (5 s) passa por pings do batimento (a cada 2 s): o segundo pedido é o segundo `token.action`, não o segundo envio.
    const second = socket.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'token.action')[1]
    expect(second).toBeDefined()
    const reqId2 = typeof second === 'object' && second !== null && 'reqId' in second ? second.reqId : null
    socket.receive({ type: 'token.action.rejected', reqId: reqId2, reason: 'unavailable' })
    expect(connection.getState().tokenAction).toMatchObject({ phase: 'rejected', reason: 'unavailable', action: 'empurrar' })
  })

  it('com o texto do mestre, a resposta fica na tela até o jogador fechar', () => {
    const { connection, socket } = jogando()
    connection.requestTokenAction('severa', 'falar', 'Você viu o Lemos?')
    const pedido = socket.sent[0]
    const reqId = typeof pedido === 'object' && pedido !== null && 'reqId' in pedido ? pedido.reqId : null
    socket.receive({ type: 'token.action.answer', reqId, accepted: true, reply: 'Ela aponta a torre: "Subiu ontem."' })
    expect(connection.getState().tokenAction).toEqual({
      id: expect.any(Number),
      phase: 'accepted',
      action: 'falar',
      targetName: 'Mulher de capuz',
      reply: 'Ela aponta a torre: "Subiu ontem."',
    })
    // Texto se lê no tempo de quem lê: o prazo do aviso curto não o apaga.
    vi.advanceTimersByTime(TOKEN_ACTION_NOTICE_TTL_MS * 10)
    expect(connection.getState().tokenAction?.phase).toBe('accepted')
    connection.dismissTokenAction()
    expect(connection.getState().tokenAction).toBeUndefined()
  })

  it('fechar não apaga a espera: o pedido ainda aguardando o mestre continua na tela', () => {
    const { connection } = jogando()
    connection.requestTokenAction('severa', 'empurrar')
    connection.dismissTokenAction()
    expect(connection.getState().tokenAction?.phase).toBe('waiting')
  })

  it('voltar à espera do lobby apaga o pedido da tela', () => {
    const { connection, socket } = jogando()
    connection.requestTokenAction('severa', 'empurrar')
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().tokenAction).toBeUndefined()
  })
})
