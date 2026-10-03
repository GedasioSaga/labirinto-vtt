/**
 * VEÍCULO no cliente do jogador: "Subir"/"Descer" mandam só os ids; a recusa
 * do host vira o aviso curto do rodapé ("Veículo cheio", "Chegue mais perto do
 * veículo"); e o passo de quem vai a bordo sem dirigir volta com "A bordo:
 * desça para andar".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { latestActionNotice } from './moveNotice'
import { createPlayerConnection, MOVE_NOTICE_TTL_MS, travelPhaseOfSceneChange, type SocketLike } from './playerConnection'
import { travelNoticeText } from './travelNoticeText'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(data: string): void {
    const message: unknown = JSON.parse(data)
    this.sent.push(message)
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'ping') this.receive({ type: 'pong' })
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
    name: 'Lia',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Lia' })
  return { connection, socket }
}

const ficha = (id: string, x: number, extra: Partial<Token> = {}): Token => ({ id, characterId: null, name: id, x, y: 100, size: 1, image: null, ...extra })

function snapshot(rev: number, tokens: Token[], own: string[]) {
  return { type: 'snapshot', rev, map: { ...createEmptyMap('m1', '', 10, 10, 50), tokens }, vision: [], ownTokens: own, concealed: [] }
}

const aviso = (connection: ReturnType<typeof conectado>['connection']) => latestActionNotice(connection.getState().doorNotice, connection.getState().moveNotice)?.text ?? null

describe('veículo no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('"Subir" e "Descer" mandam só os ids; sem mesa, nada sai', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, [ficha('lia', 100), ficha('cesto', 150, { embarcavel: true })], ['lia']))
    expect(connection.boardVehicle('lia', 'cesto')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'vehicle.board', tokenId: 'lia', vehicleId: 'cesto' })
    expect(connection.leaveVehicle('lia')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'vehicle.leave', tokenId: 'lia' })
    expect(connection.boardVehicle('', 'cesto')).toBe(false)
  })

  it('a recusa "cheio" e "longe" vira aviso curto que some sozinho; motivo desconhecido não vira frase', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, [ficha('lia', 100), ficha('cesto', 150, { embarcavel: true })], ['lia']))
    socket.receive({ type: 'vehicle.rejected', reason: 'cheio' })
    expect(aviso(connection)).toBe('Veículo cheio')
    vi.advanceTimersByTime(MOVE_NOTICE_TTL_MS)
    expect(aviso(connection)).toBeNull()
    socket.receive({ type: 'vehicle.rejected', reason: 'longe' })
    expect(aviso(connection)).toBe('Chegue mais perto do veículo')
    vi.advanceTimersByTime(MOVE_NOTICE_TTL_MS)
    socket.receive({ type: 'vehicle.rejected', reason: 'locked' })
    expect(aviso(connection)).toBe('O mestre segurou sua ficha')
    vi.advanceTimersByTime(MOVE_NOTICE_TTL_MS)
    socket.receive({ type: 'vehicle.rejected', reason: 'outra-coisa' })
    expect(aviso(connection)).toBeNull()
  })

  it('o passo de quem vai a bordo sem dirigir volta: a ficha fica e o aviso diz para descer', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, [ficha('lia', 100, { aBordo: { motorista: false } })], ['lia']))
    expect(connection.requestMove('lia', 150, 100)).toBe(true)
    const pedido = socket.sent.at(-1) as { type: string; reqId: string }
    expect(pedido.type).toBe('token.move')
    socket.receive({ type: 'token.move.rejected', reqId: pedido.reqId, reason: 'a_bordo' })
    expect(connection.getState().map?.tokens.find((t) => t.id === 'lia')?.x).toBe(100)
    expect(aviso(connection)).toBe('A bordo: desça para andar')
  })

  it('a bordo do veículo que outro jogador dirigiu: "Você viajou no veículo", não "O mestre levou você"', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, [ficha('lia', 100, { aBordo: { motorista: false } })], ['lia']))
    socket.receive({ type: 'scene.changed', by: 'veiculo' })
    const travel = connection.getState().travel
    expect(travel?.phase).toBe('rode')
    expect(travel === undefined ? null : travelNoticeText(travel)).toBe('Você viajou no veículo')
  })

  it('o "by" da troca de cena vira o aviso certo; valor desconhecido é a chegada de sempre', () => {
    expect(travelPhaseOfSceneChange(undefined)).toBe('arrived')
    expect(travelPhaseOfSceneChange('master')).toBe('moved')
    expect(travelPhaseOfSceneChange('gather')).toBe('gathered')
    expect(travelPhaseOfSceneChange('veiculo')).toBe('rode')
    expect(travelPhaseOfSceneChange('carroça')).toBe('arrived')
  })

  it('a recusa "a_bordo" da passagem usa a mesma frase do cartão do pino', () => {
    expect(travelNoticeText({ id: 1, phase: 'rejected', reason: 'a_bordo' })).toBe('A bordo: desça para viajar')
  })
})
