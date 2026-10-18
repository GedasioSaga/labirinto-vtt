/**
 * MINIGAME DE PESCA no cliente do jogador: o que chega do mestre vira
 * `state.pesca` (convite, estado, pausa, encerra), e as ações mandam pedido,
 * Pronto, vivo, lances e cesto só quando valem — conferidos como o host
 * conferiria. Mensagem de outra sessão cai; sair da sala limpa a pesca.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import type { PeixeNoCesto, PescaConviteMessage } from '../net/protocoloDaPesca'
import type { Pin } from '../types/map'
import { pescaAceitaPronto, pescaNaAgua, receberPesca, registrarLance } from './estadoDaPesca'
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

const CONVITE: PescaConviteMessage = {
  type: 'pesca.convite',
  sessao: 's1',
  pinId: 'pino-pesca',
  npc: 'Bento, o barqueiro',
  fala: 'Joga a linha.',
  lago: 'Poço Afogado',
  lances: 2,
  permitida: 'normal',
  premio: { texto: 'A chave da comporta.' },
  consequencia: { texto: 'O barqueiro conta.' },
  participantes: [{ playerId: 'p1', nome: 'Ana' }],
}
const TRUTA: PeixeNoCesto = { peixe: 'truta', cm: 31, estrelas: 2, perfeito: false, bau: false }

function pino(minigameVisivel: Pin['minigameVisivel']): Pin {
  return { ...buildPin('pino-pesca', { x: 100, y: 100 }, 'minigame'), minigame: undefined, minigameVisivel }
}

function conectado(pins: Pin[] = [pino({ jogo: 'pesca', entrada: 'pino' })]) {
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
  socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', 'Lago', 500, 500, 50), pins }, vision: [], ownTokens: [], concealed: [] })
  socket.sent = []
  return { connection, socket, pesca: () => connection.getState().pesca }
}

describe('pesca no cliente do jogador', () => {
  let agora = 1000
  beforeEach(() => {
    agora = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => agora)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pedir: só no pino de pesca "Jogador toca no pino", e só sem outra pesca aberta', () => {
    const { connection, socket } = conectado([pino({ jogo: 'pesca', entrada: 'pino' }), { ...pino({ jogo: 'pesca', entrada: 'mestre' }), id: 'pino-mestre' }, { ...pino({ jogo: 'danca', entrada: 'mestre' }), id: 'pino-danca' }])
    expect(connection.getState().status).toBe('playing')
    expect(connection.pedirPesca('pino-mestre')).toBe(false)
    expect(connection.pedirPesca('pino-danca')).toBe(false)
    expect(connection.pedirPesca('nao-existe')).toBe(false)
    expect(connection.pedirPesca('pino-pesca')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'pesca.pedir', pinId: 'pino-pesca' }])
    socket.receive(CONVITE)
    expect(connection.pedirPesca('pino-pesca')).toBe(false)
  })

  it('o convite vira estado; Pronto só com a dificuldade permitida, uma vez', () => {
    const { connection, socket, pesca } = conectado()
    socket.receive(CONVITE)
    expect(pesca()).toMatchObject({ sessao: 's1', pausada: false, cesto: [], fimEnviado: false })
    expect(pesca()?.convite.lago).toBe('Poço Afogado')
    expect(connection.prontoPesca('extremo')).toBe(false)
    expect(connection.prontoPesca('normal')).toBe(true)
    expect(connection.prontoPesca('normal')).toBe(false)
    expect(socket.sent).toEqual([{ type: 'pesca.pronto', sessao: 's1', dificuldade: 'normal' }])
  })

  it('vivo no máximo a cada 250 ms; lances uma vez cada; o fim leva o cesto e fecha', () => {
    const { connection, socket, pesca } = conectado()
    socket.receive(CONVITE)
    // Antes do Pronto nada sai.
    expect(connection.vivoPesca({ fase: 'lance', lance: 1, medidor: 0 })).toBe(false)
    expect(connection.lancePesca({ lance: 1, resultado: 'escapou' })).toBe(false)
    connection.prontoPesca('normal')
    socket.sent = []
    expect(connection.vivoPesca({ fase: 'puxada', lance: 1, medidor: 0.3 })).toBe(true)
    agora += 100
    expect(connection.vivoPesca({ fase: 'puxada', lance: 1, medidor: 0.5 })).toBe(false)
    agora += 200
    expect(connection.vivoPesca({ fase: 'puxada', lance: 1, medidor: 0.9 })).toBe(true)
    // Medidor fora da faixa: a conferência do host barra antes de sair.
    agora += 300
    expect(connection.vivoPesca({ fase: 'puxada', lance: 1, medidor: 2 })).toBe(false)
    expect(connection.lancePesca({ lance: 1, resultado: 'pegou', peixe: TRUTA })).toBe(true)
    expect(connection.lancePesca({ lance: 1, resultado: 'escapou' })).toBe(false)
    expect(connection.lancePesca({ lance: 3, resultado: 'escapou' })).toBe(false)
    expect(connection.lancePesca({ lance: 2, resultado: 'fugiu' })).toBe(true)
    expect(pesca()?.cesto).toEqual([TRUTA])
    expect(connection.fimPesca()).toBe(true)
    expect(connection.fimPesca()).toBe(false)
    expect(socket.sent).toEqual([
      { type: 'pesca.vivo', sessao: 's1', fase: 'puxada', lance: 1, de: 2, medidor: 0.3 },
      { type: 'pesca.vivo', sessao: 's1', fase: 'puxada', lance: 1, de: 2, medidor: 0.9 },
      { type: 'pesca.lance', sessao: 's1', lance: 1, resultado: 'pegou', peixe: TRUTA },
      { type: 'pesca.lance', sessao: 's1', lance: 2, resultado: 'fugiu' },
      { type: 'pesca.fim', sessao: 's1', cesto: [TRUTA] },
    ])
  })

  it('fechar no meio da pesca manda o cesto que tem; fechar no convite não manda nada', () => {
    const { connection, socket, pesca } = conectado()
    socket.receive(CONVITE)
    connection.fecharPesca()
    expect(socket.sent).toEqual([])
    expect(pesca()).toBeUndefined()
    socket.receive(CONVITE)
    connection.prontoPesca('normal')
    connection.lancePesca({ lance: 1, resultado: 'pegou', peixe: TRUTA })
    socket.sent = []
    connection.fecharPesca()
    expect(socket.sent).toEqual([{ type: 'pesca.fim', sessao: 's1', cesto: [TRUTA] }])
    expect(pesca()).toBeUndefined()
  })

  it('pausa, retoma, estado e encerra; mensagem de outra sessão cai; encerrada não pesca mais', () => {
    const { connection, socket, pesca } = conectado()
    socket.receive(CONVITE)
    connection.prontoPesca('normal')
    socket.receive({ type: 'pesca.pausa', sessao: 's1' })
    expect(pesca()).toMatchObject({ pausada: true, pausaMudouEm: 1000 })
    socket.receive({ type: 'pesca.retoma', sessao: 'outra' })
    expect(pesca()?.pausada).toBe(true)
    socket.receive({ type: 'pesca.retoma', sessao: 's1' })
    expect(pesca()?.pausada).toBe(false)
    socket.receive({ type: 'pesca.estado', sessao: 's1', fase: 'aberta', participantes: [{ playerId: 'p1', nome: 'Ana', status: 'pescando' }] })
    expect(pesca()?.estado?.participantes[0]?.status).toBe('pescando')
    socket.receive({ type: 'pesca.encerra', sessao: 's1', motivo: 'mestre' })
    expect(pesca()?.encerrada).toBe('mestre')
    expect(connection.lancePesca({ lance: 1, resultado: 'escapou' })).toBe(false)
    // Mensagem torta cai inteira.
    socket.receive({ ...CONVITE, sessao: 's2', lances: 9 })
    expect(pesca()?.sessao).toBe('s1')
  })

  it('sair da sala limpa a pesca', () => {
    const { socket, pesca } = conectado()
    socket.receive(CONVITE)
    socket.receive({ type: 'kicked' })
    expect(pesca()).toBeUndefined()
  })
})

describe('estadoDaPesca (puro)', () => {
  const base = receberPesca(undefined, CONVITE, 0)

  it('convite novo recomeça; o mesmo convite de novo guarda o que já houve', () => {
    if (base === undefined) throw new Error('o convite devia virar estado')
    const pescando = registrarLance({ ...base, pronto: 'normal' }, { lance: 1, resultado: 'pegou', peixe: TRUTA })
    if (pescando === null) throw new Error('o lance devia valer')
    expect(receberPesca(pescando, CONVITE, 5)).toMatchObject({ pronto: 'normal', cesto: [TRUTA] })
    expect(receberPesca(pescando, { ...CONVITE, sessao: 's2' }, 5)).toMatchObject({ sessao: 's2', cesto: [], lances: [] })
  })

  it('Pronto e água: o que vale em cada momento', () => {
    expect(pescaAceitaPronto(undefined)).toBe(false)
    expect(pescaAceitaPronto(base)).toBe(true)
    expect(pescaNaAgua(base)).toBe(false)
    if (base === undefined) return
    expect(pescaNaAgua({ ...base, pronto: 'normal' })).toBe(true)
    expect(pescaNaAgua({ ...base, pronto: 'normal', fimEnviado: true })).toBe(false)
    expect(pescaAceitaPronto({ ...base, encerrada: 'mestre' })).toBe(false)
  })
})
