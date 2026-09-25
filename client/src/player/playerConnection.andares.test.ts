/**
 * MAPA POR ANDARES no cliente do jogador: `snapshot.andares` é aditivo —
 * ausente, o jogador fica sem abas; presente e malformado, a mensagem inteira
 * é descartada, como os outros campos aditivos.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, isPointExplored, markRings } from '../lib/exploration'
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

const salao = { ...createEmptyMap('m-salao', '', 20, 10, 50), tokens: [{ id: 'heroi', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }] }
const porao = createEmptyMap('m-porao', '', 20, 10, 50)
const exploradoPorao = createExploration({ width: 1000, height: 500, grid: 50 })
markRings(exploradoPorao, [[{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }]])

function snapshot(rev: number, andares?: unknown) {
  return { type: 'snapshot', rev, map: salao, vision: [], ownTokens: ['heroi'], concealed: [], ...(andares === undefined ? {} : { andares }) }
}

const B1 = { rotulo: 'B1', map: porao, explored: encodeExploration(exploradoPorao), concealed: [] }

describe('playerConnection: andares do prédio', () => {
  it('guarda o andar atual e a memória decodificada de cada outro andar', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { atual: '1F', outros: [B1] }))
    const andares = connection.getState().andares
    expect(andares?.atual).toBe('1F')
    expect(andares?.outros.map((o) => o.rotulo)).toEqual(['B1'])
    const memoria = andares?.outros[0]
    expect(memoria?.map.id).toBe('m-porao')
    expect(memoria === undefined ? null : isPointExplored(memoria.explored, { x: 100, y: 100 })).toBe(true)
    expect(memoria === undefined ? null : isPointExplored(memoria.explored, { x: 900, y: 400 })).toBe(false)
  })

  it('snapshot sem o campo tira as abas (o jogador saiu do prédio)', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, { atual: '1F', outros: [B1] }))
    socket.receive(snapshot(2))
    expect(connection.getState().rev).toBe(2)
    expect(connection.getState().andares).toBeUndefined()
  })

  it('campo malformado descarta a mensagem inteira', () => {
    const tortos: unknown[] = [
      'B1',
      { atual: 'Salao Nobre', outros: [B1] },
      { atual: '1F', outros: 'B1' },
      { atual: '1F', outros: [{ ...B1, rotulo: 'Porao Umido' }] },
      { atual: '1F', outros: [{ ...B1, map: { id: 'x' } }] },
      { atual: '1F', outros: [{ ...B1, explored: { cols: -1 } }] },
      { atual: '1F', outros: [{ ...B1, concealed: [[{ x: 'a', y: 0 }]] }] },
      { atual: '1F', outros: [B1, B1] },
      { atual: 'B1', outros: [B1] },
    ]
    for (const torto of tortos) {
      const { connection, socket } = conectado()
      socket.receive(snapshot(1, torto))
      expect(connection.getState().status, JSON.stringify(torto)).toBe('waiting')
      expect(connection.getState().rev).toBe(-1)
      expect(connection.getState().andares).toBeUndefined()
    }
  })
})
