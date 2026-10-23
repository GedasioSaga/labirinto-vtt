/**
 * CAMADAS NA REDE (fatia 2 de `docs/planos/camadas-fase3-2026-10-22.md`): o
 * cliente do jogador (`isMapShape`) aceita o mapa sem nenhum campo de camada
 * (mestre antigo) e o recorte novo, com `camada` nas entidades, sem derrubar a
 * mensagem.
 */
import { describe, expect, it } from 'vitest'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

function conectar() {
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
  if (socket === undefined) throw new Error('socket não criado')
  socket.open()
  return { connection, socket }
}

const ANA: Token = { id: 't1', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }
const PAREDE: Wall = { id: 'w1', x1: 50, y1: 50, x2: 200, y2: 50, blocksLight: true, blocksMove: true, door: null, camada: 'livre_x' }

describe('isMapShape com camadas', () => {
  it('mapa sem nenhum campo de camada (mestre antigo) entra', () => {
    const { connection, socket } = conectar()
    socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', 'Mapa', 10, 10, 50), tokens: [ANA] }, vision: [] })
    expect(connection.getState()).toMatchObject({ status: 'playing', rev: 1 })
  })

  it('o recorte novo, com camada nas entidades, entra inteiro', () => {
    const mestre: MapData = {
      ...createEmptyMap('m1', 'Mapa', 10, 10, 50),
      tokens: [{ ...ANA, camada: 'tokens' }],
      walls: [PAREDE],
      floor: [],
      versaoDasCamadas: 2,
      ocultasDoJogador: [],
      modeloCamadas: { ordem: [{ id: 'chao' }, { id: 'livre_x', nome: 'Segredo do Lich' }] },
    }
    const { map } = filterMapForPlayer(mestre, 'p1', { p1: ['t1'] }, 400)
    expect(map.walls.map((w) => w.camada)).toEqual(['livre_x'])
    const { connection, socket } = conectar()
    socket.receive({ type: 'snapshot', rev: 1, map, vision: [] })
    expect(connection.getState()).toMatchObject({ status: 'playing', rev: 1 })
    expect(connection.getState().map?.walls[0]?.camada).toBe('livre_x')
  })
})
