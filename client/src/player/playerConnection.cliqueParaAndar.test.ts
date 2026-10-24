/**
 * CLICAR PARA ANDAR (CAMINHOS F2) no cliente do jogador: o clique no chão
 * calcula o caminho pelo que a tela conhece e manda trecho a trecho, cada um
 * MARCADO (`caminhada: true`); o destino fica no estado (a marca na tela) até
 * chegar ou parar. Chave da cena desligada: nada sai e o aviso diz por quê.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { createPlayerConnection, WALK_LEG_PAUSE_MS, type SocketLike } from './playerConnection'

interface Trecho {
  reqId: string
  x: number
  y: number
  caminhada: unknown
}

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
  moves(): Trecho[] {
    return this.sent.flatMap((m) => {
      if (typeof m !== 'object' || m === null || !('type' in m) || m.type !== 'token.move') return []
      if (!('reqId' in m) || !('x' in m) || !('y' in m)) return []
      const { reqId, x, y } = m
      const caminhada = 'caminhada' in m ? m.caminhada : undefined
      return typeof reqId === 'string' && typeof x === 'number' && typeof y === 'number' ? [{ reqId, x, y, caminhada }] : []
    })
  }
}

const ENZO = { id: 'enzo', characterId: null, name: 'Enzo', x: 125, y: 125, size: 1, image: null }
/** Ele vê a metade de cima do mapa (20 x 12 casas de 50). */
const VISAO = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 300 },
    { x: 0, y: 300 },
  ],
]
/** Um muro com a ponta em baixo: do Enzo ao outro lado, o caminho dobra uma esquina. */
const MURO = { id: 'muro', x1: 500, y1: 0, x2: 500, y2: 200, blocksLight: false, blocksMove: true, door: null }

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('capital', '', 20, 12, 50), walls: [MURO], tokens: [ENZO], ...extra }
}

function jogando(map: MapData = mapa()) {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Enzo',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Enzo' })
  socket.receive({ type: 'snapshot', rev: 1, map, vision: VISAO, ownTokens: ['enzo'], concealed: [] })
  return { connection, socket }
}

/** O host aceita, um por vez, cada trecho que sair, até a caminhada acabar. */
function aceitaTudo(socket: FakeSocket): void {
  for (let i = 0; i < 20; i += 1) {
    const move = socket.moves()[i]
    if (!move) return
    socket.receive({ type: 'token.move.accepted', reqId: move.reqId, x: move.x, y: move.y })
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('walkTo: clicar no chão para andar', () => {
  it('cada trecho sai marcado; a marca do destino fica até a ficha chegar e some na chegada', () => {
    const { connection, socket } = jogando()
    expect(connection.walkTo('enzo', 725, 125)).toBe(true)
    expect(connection.getState().caminhada).toEqual({ tokenId: 'enzo', destino: { x: 725, y: 125 } })
    expect(socket.moves()).toHaveLength(1)
    expect(socket.moves()[0]?.caminhada).toBe(true)
    aceitaTudo(socket)
    const trechos = socket.moves()
    // Dobrou a ponta do muro: mais de um trecho, todos marcados, o último no destino.
    expect(trechos.length).toBeGreaterThanOrEqual(2)
    expect(trechos.every((t) => t.caminhada === true)).toBe(true)
    expect(trechos.at(-1)).toMatchObject({ x: 725, y: 125 })
    expect(connection.getState().caminhada).toBeUndefined()
  })

  it('o "Andar até aqui" do menu também sai marcado e mostra a marca no último ponto', () => {
    const { connection, socket } = jogando()
    expect(connection.requestWalk('enzo', [{ x: 325, y: 125 }])).toBe(true)
    expect(socket.moves()[0]?.caminhada).toBe(true)
    expect(connection.getState().caminhada?.destino).toEqual({ x: 325, y: 125 })
  })

  it('o arrasto não leva a marca e cancela a caminhada (a marca some)', () => {
    const { connection, socket } = jogando()
    connection.walkTo('enzo', 725, 125)
    connection.requestMove('enzo', 175, 175)
    expect(socket.moves().at(-1)).toMatchObject({ x: 175, y: 175, caminhada: undefined })
    expect(connection.getState().caminhada).toBeUndefined()
  })

  it('novo clique troca o destino: a caminhada velha para e a nova sai do ponto de agora', () => {
    const { connection } = jogando()
    connection.walkTo('enzo', 725, 125)
    expect(connection.walkTo('enzo', 125, 225)).toBe(true)
    expect(connection.getState().caminhada?.destino).toEqual({ x: 125, y: 225 })
  })

  it('chave da cena desligada: nada sai, nada de marca, e o aviso diz por quê (clique e menu)', () => {
    const { connection, socket } = jogando(mapa({ cliqueParaAndar: false }))
    expect(connection.walkTo('enzo', 725, 125)).toBe(false)
    expect(connection.requestWalk('enzo', [{ x: 325, y: 125 }])).toBe(false)
    expect(socket.moves()).toEqual([])
    expect(connection.getState().caminhada).toBeUndefined()
    expect(connection.getState().moveNotice?.reason).toBe('caminhada_desligada')
  })

  it('clique no escuro: nada sai e o aviso diz que ele não conhece o caminho', () => {
    const { connection, socket } = jogando()
    expect(connection.walkTo('enzo', 125, 525)).toBe(false)
    expect(socket.moves()).toEqual([])
    expect(connection.getState().moveNotice?.reason).toBe('caminho_desconhecido')
  })

  it('o host recusa pela névoa: a caminhada para, a marca some e o aviso aparece', () => {
    const { connection, socket } = jogando()
    connection.walkTo('enzo', 725, 125)
    const primeiro = socket.moves()[0]
    if (!primeiro) throw new Error('nada saiu')
    socket.receive({ type: 'token.move.rejected', reqId: primeiro.reqId, reason: 'nevoa' })
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS * 3)
    expect(socket.moves()).toHaveLength(1)
    expect(connection.getState().caminhada).toBeUndefined()
    expect(connection.getState().moveNotice?.reason).toBe('nevoa')
  })

  it('o mestre congela a ficha no meio: a caminhada para já no snapshot, sem mandar o trecho seguinte', () => {
    const { connection, socket } = jogando()
    connection.walkTo('enzo', 725, 125)
    const primeiro = socket.moves()[0]
    if (!primeiro) throw new Error('nada saiu')
    socket.receive({ type: 'token.move.accepted', reqId: primeiro.reqId, x: primeiro.x, y: primeiro.y })
    socket.receive({ type: 'snapshot', rev: 2, map: mapa({ tokens: [{ ...ENZO, x: primeiro.x, y: primeiro.y, congelado: true }] }), vision: VISAO, ownTokens: ['enzo'], concealed: [] })
    vi.advanceTimersByTime(WALK_LEG_PAUSE_MS * 3)
    expect(socket.moves()).toHaveLength(1)
    expect(connection.getState().caminhada).toBeUndefined()
  })
})
