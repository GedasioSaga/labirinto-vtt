/**
 * PINO NO MODO PASSE no cliente do jogador. O cliente não sabe se o jogador
 * tem o passe (o que abre a catraca nunca chega ao recorte), então o aviso
 * diz o mesmo que o cartão — "Conferindo o passe…" — e não "Aguardando o
 * mestre…". E o pedido sai depois da batida, como no livre: quem tem o passe
 * passa sem pedido, e sem a pausa a cena trocaria no mesmo quadro em que o
 * cartão fecha.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { MapData, PinPassage } from '../types/map'
import { createPlayerConnection, FREE_PASSAGE_BEAT_MS, type SocketLike } from './playerConnection'
import { PASS_CHECK_TEXT, travelNoticeText } from './travelNotice'

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

/** Mapa com um pino de viagem no modo pedido; `undefined` = pino antigo, sem o campo. */
function mapa(passagem: PinPassage | undefined): MapData {
  const catraca = { ...buildPin('catraca', { x: 100, y: 100 }, 'viagem'), passagem }
  return {
    ...createEmptyMap('m1', '', 10, 10, 50),
    pins: [catraca],
    tokens: [{ id: 'fabi', characterId: null, name: 'Fabi', x: 90, y: 100, size: 1, image: null }],
  }
}

function jogando(passagem: PinPassage | undefined) {
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
  socket.receive({ type: 'snapshot', rev: 1, map: mapa(passagem), vision: [], ownTokens: ['fabi'], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('pino no modo passe, no cliente do jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('o aviso diz "Conferindo o passe…", o mesmo texto do cartão, e não "Aguardando o mestre…"', () => {
    const { connection } = jogando('passe')
    expect(connection.requestTravel('catraca')).toBe(true)
    const notice = connection.getState().travel
    expect(notice).toMatchObject({ phase: 'waiting', passe: true })
    expect(notice && travelNoticeText(notice)).toBe('Conferindo o passe…')
    expect(PASS_CHECK_TEXT).toBe('Conferindo o passe…')
  })

  it('o pedido sai depois da batida, como no livre — não no mesmo toque', () => {
    const { connection, socket } = jogando('passe')
    const antes = socket.sent.length
    expect(connection.requestTravel('catraca')).toBe(true)
    expect(socket.sent.length).toBe(antes)
    // Na batida, um segundo toque não empilha outro pedido.
    expect(connection.requestTravel('catraca')).toBe(false)
    vi.advanceTimersByTime(FREE_PASSAGE_BEAT_MS)
    expect(socket.sent.slice(antes)).toEqual([{ type: 'pin.travel.request', pinId: 'catraca' }])
  })

  it('pino que pede ao mestre continua dizendo "Aguardando o mestre…", com o pedido na hora', () => {
    const { connection, socket } = jogando('pede')
    expect(connection.requestTravel('catraca')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'pin.travel.request', pinId: 'catraca' })
    const notice = connection.getState().travel
    expect(notice).toMatchObject({ phase: 'waiting', direct: false, passe: false })
    expect(notice && travelNoticeText(notice)).toBe('Aguardando o mestre…')
  })

  it('pino antigo, sem o campo de modo, também pede ao mestre na hora', () => {
    const { connection, socket } = jogando(undefined)
    expect(connection.requestTravel('catraca')).toBe(true)
    expect(socket.sent.at(-1)).toEqual({ type: 'pin.travel.request', pinId: 'catraca' })
    const notice = connection.getState().travel
    expect(notice && travelNoticeText(notice)).toBe('Aguardando o mestre…')
  })

  it('catraca barrada do outro lado (TRANCAR PASSAGEM): o host avisa que espera o mestre, e "Conferindo o passe…" vira "Aguardando o mestre…"', () => {
    const { connection, socket } = jogando('passe')
    expect(connection.requestTravel('catraca')).toBe(true)
    vi.advanceTimersByTime(FREE_PASSAGE_BEAT_MS)
    socket.receive({ type: 'pin.travel.pending' })
    const notice = connection.getState().travel
    expect(notice).toMatchObject({ phase: 'waiting', direct: false, passe: false })
    expect(notice && travelNoticeText(notice)).toBe('Aguardando o mestre…')
  })

  it('pino livre segue dizendo "Passando…"', () => {
    const { connection } = jogando('livre')
    expect(connection.requestTravel('catraca')).toBe(true)
    const notice = connection.getState().travel
    expect(notice).toMatchObject({ phase: 'waiting', direct: true, passe: false })
    expect(notice && travelNoticeText(notice)).toBe('Passando…')
  })
})
