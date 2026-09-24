/**
 * TESTE SECRETO no cliente do jogador: `secret.check` vira `state.secretCheck`
 * (o cartão com o nome do teste); `answerSecretCheck` manda o resultado ao
 * mestre e fecha o cartão; `secret.check.closed` do mesmo id fecha também.
 * Forma errada: a mensagem inteira cai.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import {
  SECRET_CHECK_LABEL_MAX_LENGTH,
  SECRET_CHECK_RESULT_MAX,
  SECRET_CHECK_RESULT_MIN,
  parsePlayerMessage,
  parseSecretCheck,
  parseSecretCheckClosed,
} from '../net/protocol'
import { SECRET_CHECK_NOTICE_TTL_MS, createPlayerConnection, type SocketLike } from './playerConnection'

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

describe('protocolo do teste secreto', () => {
  it('parseSecretCheck aceita id e nome do teste, e devolve só os campos conhecidos', () => {
    expect(parseSecretCheck({ type: 'secret.check', id: 't1', label: 'Percepção', asked: ['Bruno'] })).toEqual({ type: 'secret.check', id: 't1', label: 'Percepção' })
    expect(parseSecretCheck({ type: 'secret.check', id: 't1', label: 'x'.repeat(SECRET_CHECK_LABEL_MAX_LENGTH) })?.label.length).toBe(SECRET_CHECK_LABEL_MAX_LENGTH)
  })

  it('parseSecretCheck recusa forma errada e nome acima do teto', () => {
    expect(parseSecretCheck({ type: 'secret.check', id: 't1', label: 'x'.repeat(SECRET_CHECK_LABEL_MAX_LENGTH + 1) })).toBeNull()
    expect(parseSecretCheck({ type: 'secret.check', id: 't1', label: '' })).toBeNull()
    expect(parseSecretCheck({ type: 'secret.check', id: '', label: 'Percepção' })).toBeNull()
    expect(parseSecretCheck({ type: 'secret.check', label: 'Percepção' })).toBeNull()
    expect(parseSecretCheck({ type: 'scene.note', id: 't1', label: 'Percepção' })).toBeNull()
    expect(parseSecretCheck(null)).toBeNull()
  })

  it('parseSecretCheckClosed exige id', () => {
    expect(parseSecretCheckClosed({ type: 'secret.check.closed', id: 't1', extra: 1 })).toEqual({ type: 'secret.check.closed', id: 't1' })
    expect(parseSecretCheckClosed({ type: 'secret.check.closed' })).toBeNull()
    expect(parseSecretCheckClosed({ type: 'secret.check', id: 't1' })).toBeNull()
  })

  it('a resposta do jogador só passa com inteiro dentro da faixa', () => {
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: 't1', result: 17, name: 'x' })).toEqual({ type: 'secret.check.answer', id: 't1', result: 17 })
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: 't1', result: SECRET_CHECK_RESULT_MIN })).toEqual({ type: 'secret.check.answer', id: 't1', result: SECRET_CHECK_RESULT_MIN })
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: 't1', result: SECRET_CHECK_RESULT_MAX })).toEqual({ type: 'secret.check.answer', id: 't1', result: SECRET_CHECK_RESULT_MAX })
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: 't1', result: SECRET_CHECK_RESULT_MAX + 1 })).toBeNull()
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: 't1', result: SECRET_CHECK_RESULT_MIN - 1 })).toBeNull()
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: 't1', result: 2.5 })).toBeNull()
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: 't1', result: '17' })).toBeNull()
    expect(parsePlayerMessage({ type: 'secret.check.answer', id: '', result: 17 })).toBeNull()
    expect(parsePlayerMessage({ type: 'secret.check.answer', result: 17 })).toBeNull()
  })
})

describe('teste secreto no cliente do jogador', () => {
  it('o pedido abre o cartão; responder manda só o id e o resultado, e fecha', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    expect(connection.getState().secretCheck).toEqual({ id: 't1', label: 'Percepção' })
    expect(connection.answerSecretCheck(14)).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'secret.check.answer', id: 't1', result: 14 })
    expect(connection.getState().secretCheck).toBeUndefined()
  })

  it('sem pedido aberto, ou com resultado fora da faixa, nada sai', () => {
    const { connection, socket } = jogando()
    const antes = socket.sent.length
    expect(connection.answerSecretCheck(10)).toBe(false)
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    expect(connection.answerSecretCheck(SECRET_CHECK_RESULT_MAX + 1)).toBe(false)
    expect(connection.answerSecretCheck(3.5)).toBe(false)
    expect(socket.sent.length).toBe(antes)
    // O cartão continua lá para ele corrigir.
    expect(connection.getState().secretCheck).toEqual({ id: 't1', label: 'Percepção' })
  })

  it('o mestre encerrou: o cartão do mesmo id fecha, o de outro id fica', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check', id: 't2', label: 'Vontade' })
    socket.receive({ type: 'secret.check.closed', id: 't1' })
    expect(connection.getState().secretCheck).toEqual({ id: 't2', label: 'Vontade' })
    socket.receive({ type: 'secret.check.closed', id: 't2' })
    expect(connection.getState().secretCheck).toBeUndefined()
  })

  it('pedido malformado não aparece nem apaga o aberto; fora do jogo é ignorado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    socket.receive({ type: 'secret.check', id: 't2', label: 'x'.repeat(SECRET_CHECK_LABEL_MAX_LENGTH + 1) })
    socket.receive({ type: 'secret.check', id: 7, label: 'y' })
    expect(connection.getState().secretCheck).toEqual({ id: 't1', label: 'Percepção' })

    const fora = conectado()
    fora.socket.receive({ type: 'lobby.waiting' })
    fora.socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    expect(fora.connection.getState().secretCheck).toBeUndefined()
  })

  it('voltar ao lobby fecha o cartão: não há tela onde responder', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().secretCheck).toBeUndefined()
  })
})

describe('aviso do teste secreto no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('responder confirma "enviado" e o aviso some sozinho', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    expect(connection.getState().secretCheckNotice).toBeUndefined()
    connection.answerSecretCheck(14)
    expect(connection.getState().secretCheckNotice?.kind).toBe('sent')
    vi.advanceTimersByTime(SECRET_CHECK_NOTICE_TTL_MS - 1)
    expect(connection.getState().secretCheckNotice?.kind).toBe('sent')
    vi.advanceTimersByTime(1)
    expect(connection.getState().secretCheckNotice).toBeUndefined()
  })

  it('o mestre encerrou o cartão aberto: avisa "encerrado"; encerramento de outro teste não avisa', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check.closed', id: 't9' })
    expect(connection.getState().secretCheckNotice).toBeUndefined()
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    socket.receive({ type: 'secret.check.closed', id: 't1' })
    expect(connection.getState().secretCheckNotice?.kind).toBe('closed')
  })

  it('resposta recusada (fora da faixa) não confirma nada', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    expect(connection.answerSecretCheck(SECRET_CHECK_RESULT_MAX + 1)).toBe(false)
    expect(connection.getState().secretCheckNotice).toBeUndefined()
    expect(connection.getState().secretCheck).toEqual({ id: 't1', label: 'Percepção' })
  })

  it('voltar ao lobby apaga o aviso', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'secret.check', id: 't1', label: 'Percepção' })
    connection.answerSecretCheck(3)
    expect(connection.getState().secretCheckNotice?.kind).toBe('sent')
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().secretCheckNotice).toBeUndefined()
  })
})
