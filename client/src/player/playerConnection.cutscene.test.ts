import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'
import { createPlayerConnection, ESPERA_DO_MAPA_DA_TRANSICAO_MAX_MS, TABLE_SCREEN_NAME, type SocketLike } from './playerConnection'

/**
 * CUTSCENES no cliente do jogador e da TV (09/11/2026): a tela que carrega a
 * abertura avisa o mestre que está viva, o pedido de aquecer fica no estado
 * para a tela pré-compilar, e a cena da travessia espera o mapa novo chegar
 * (ou o teto) antes de tocar.
 */

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

const PORTA: Pin = { id: 'porta', x: 100, y: 100, kind: 'viagem', description: '', image: null, transicao: { id: 'porta' } }
const mapa = (id: string) => ({ ...createEmptyMap(id, 'Mapa', 10, 10, 50), pins: [PORTA] })

function conectado(papel: 'jogador' | 'mesa' = 'jogador') {
  const sockets: FakeSocket[] = []
  const base = {
    url: 'ws://host/ws',
    code: 'ABC123',
    storage: null,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  }
  const connection = papel === 'mesa' ? createPlayerConnection({ ...base, name: TABLE_SCREEN_NAME, role: 'table', tableKey: 'chave' }) : createPlayerConnection({ ...base, name: 'Ana' })
  const socket = sockets[0]
  if (!socket) throw new Error('socket não criado')
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
  socket.receive({ type: 'snapshot', rev: 1, map: mapa('m1'), vision: [], ownTokens: [], concealed: [] })
  const batidas = () => socket.sent.filter((msg) => typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'cutscene.carregando')
  return { connection, socket, batidas }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('playerConnection: a tela que carrega a abertura avisa que está viva', () => {
  it('com a batida pedida pelo mestre, a primeira sai ao receber o aviso; sem ela (mestre anterior), nada sai', () => {
    const { connection, socket, batidas } = conectado()
    socket.receive({ type: 'batalha.iniciada', transicao: 'espadas-cruzadas', preparo: 7, batidaMs: 1000 })
    expect(batidas()).toEqual([{ type: 'cutscene.carregando', preparo: 7 }])
    expect(connection.getState().batalhaIniciada).toMatchObject({ preparo: 7, batidaMs: 1000 })
    socket.receive({ type: 'batalha.iniciada', transicao: 'espadas-cruzadas', preparo: 8 })
    expect(batidas()).toHaveLength(1)
    expect(connection.getState().batalhaIniciada?.batidaMs).toBeUndefined()
  })

  it('a tela da mesa também bate (a TV toca a abertura, e a mesa espera por ela)', () => {
    const { connection, batidas } = conectado('mesa')
    expect(connection.informarCutsceneCarregando(3)).toBe(true)
    expect(batidas()).toEqual([{ type: 'cutscene.carregando', preparo: 3 }])
  })
})

describe('playerConnection: aquecer pela intenção', () => {
  it('o pedido de aquecer fica no estado, para a tela pré-compilar; pedido torto é ignorado', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'cutscene.aquecer', abertura: 'tiro-na-tela' })
    expect(connection.getState().aberturaParaAquecer).toBe('tiro-na-tela')
    socket.receive({ type: 'cutscene.aquecer', abertura: 'duas\nlinhas' })
    socket.receive({ type: 'cutscene.aquecer' })
    expect(connection.getState().aberturaParaAquecer).toBe('tiro-na-tela')
    // Aquecer não toca nada.
    expect(connection.getState().batalhaIniciada).toBeUndefined()
  })
})

describe('playerConnection: a cena da travessia espera o mapa novo', () => {
  it('o mapa novo chegou: quem esperava é solto, sem esperar o teto', async () => {
    vi.useFakeTimers()
    const { connection, socket } = conectado()
    connection.requestTravel('porta')
    await vi.advanceTimersByTimeAsync(2000)
    socket.receive({ type: 'scene.changed' })
    let chegou = false
    void connection.getState().transicao?.mapaNovo?.then(() => {
      chegou = true
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(chegou).toBe(false)
    socket.receive({ type: 'snapshot', rev: 2, map: mapa('m2'), vision: [], ownTokens: [], concealed: [] })
    await vi.advanceTimersByTimeAsync(0)
    expect(chegou).toBe(true)
  })

  it('o mapa novo não veio (rede travada): o teto solta a cena, que toca assim mesmo', async () => {
    vi.useFakeTimers()
    const { connection, socket } = conectado()
    connection.requestTravel('porta')
    await vi.advanceTimersByTimeAsync(2000)
    socket.receive({ type: 'scene.changed' })
    let solta = false
    void connection.getState().transicao?.mapaNovo?.then(() => {
      solta = true
    })
    await vi.advanceTimersByTimeAsync(ESPERA_DO_MAPA_DA_TRANSICAO_MAX_MS - 1)
    expect(solta).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(solta).toBe(true)
  })
})
