/**
 * LUGARES no cliente do jogador: cada snapshot com `place` guarda (ou
 * atualiza) o desenho daquele lugar, só com o que já veio no recorte dele;
 * `places` diz quais o host ainda lembra, e o resto sai. Campo presente e
 * malformado descarta a mensagem inteira, como os outros campos aditivos.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, markRings } from '../lib/exploration'
import type { MapData } from '../types/map'
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

function conectado() {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Eva',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Eva' })
  return { connection, socket }
}

function mapa(id: string): MapData {
  return {
    ...createEmptyMap(id, '', 10, 10, 50),
    tokens: [{ id: 'bruno', characterId: null, name: 'Bruno', x: 100, y: 100, size: 1, image: null }],
  }
}

function explorado(ate: number) {
  const exp = createExploration({ width: 500, height: 500, grid: 50 })
  markRings(exp, [
    [
      { x: 0, y: 0 },
      { x: ate, y: 0 },
      { x: ate, y: ate },
      { x: 0, y: ate },
    ],
  ])
  return encodeExploration(exp)
}

function snapshot(rev: number, map: MapData, extra: Record<string, unknown> = {}) {
  return { type: 'snapshot', rev, map, vision: [], explored: explorado(100), ownTokens: [], concealed: [], ...extra }
}

describe('Lugares no cliente do jogador', () => {
  it('guarda um lugar por id, na ordem da visita, e a volta não cria outro', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, mapa('m-a'), { place: 'l1', places: ['l1'] }))
    socket.receive(snapshot(2, mapa('m-b'), { place: 'l2', places: ['l1', 'l2'] }))
    socket.receive(snapshot(3, mapa('m-c'), { place: 'l3', places: ['l1', 'l2', 'l3'] }))
    socket.receive({ ...snapshot(4, mapa('m-a'), { place: 'l1', places: ['l2', 'l3', 'l1'] }), type: 'delta' })
    const places = connection.getState().places ?? []
    expect(places.map((p) => [p.id, p.number])).toEqual([
      ['l1', 1],
      ['l2', 2],
      ['l3', 3],
    ])
    expect(connection.getState().place).toBe('l1')
  })

  it('o desenho guardado não leva a ficha de ninguém', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, mapa('m-a'), { place: 'l1', places: ['l1'] }))
    socket.receive(snapshot(2, mapa('m-b'), { place: 'l2', places: ['l1', 'l2'] }))
    const places = connection.getState().places ?? []
    expect(places).toHaveLength(2)
    expect(JSON.stringify(places.map((p) => p.sketch))).not.toContain('Bruno')
  })

  it('lugar que o host esqueceu (fora de `places`) sai da lista', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, mapa('m-a'), { place: 'l1', places: ['l1'] }))
    socket.receive(snapshot(2, mapa('m-b'), { place: 'l2', places: ['l1', 'l2'] }))
    socket.receive(snapshot(3, mapa('m-b'), { place: 'l3', places: ['l3'] }))
    expect((connection.getState().places ?? []).map((p) => p.id)).toEqual(['l3'])
  })

  it('aguardar o mestre (sem ficha) não apaga os lugares: eles são do jogador, não da cena', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, mapa('m-a'), { place: 'l1', places: ['l1'] }))
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().status).toBe('waiting')
    expect((connection.getState().places ?? []).map((p) => p.id)).toEqual(['l1'])
  })

  it('mestre antigo (sem `place`): nenhum lugar, e o jogo segue', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, mapa('m-a')))
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().places).toBeUndefined()
    expect(connection.getState().place).toBeUndefined()
  })

  it('recorte sem paredes, sem salas e sem explorado ainda vira lugar (desenho vazio, nada quebra)', () => {
    const { connection, socket } = conectado()
    const { walls: _walls, regions: _regions, ...semListas } = mapa('m-a')
    socket.receive({ type: 'snapshot', rev: 1, map: semListas, vision: [], place: 'l1', places: ['l1'] })
    expect(connection.getState().status).toBe('playing')
    const [lugar] = connection.getState().places ?? []
    expect(lugar?.id).toBe('l1')
    expect(lugar?.explored).toBeNull()
    expect(lugar?.sketch.walls).toEqual([])
    expect(lugar?.sketch.rooms).toEqual([])
  })

  it('`place` ou `places` malformado descarta o snapshot inteiro', () => {
    const { connection, socket } = conectado()
    socket.receive(snapshot(1, mapa('m-a'), { place: 'l1', places: ['l1'] }))
    socket.receive(snapshot(2, mapa('m-b'), { place: 7, places: ['l1'] }))
    socket.receive(snapshot(3, mapa('m-b'), { place: '', places: ['l1'] }))
    socket.receive(snapshot(4, mapa('m-b'), { place: 'x'.repeat(65), places: ['l1'] }))
    socket.receive(snapshot(5, mapa('m-b'), { place: 'l2', places: 'l1' }))
    socket.receive(snapshot(6, mapa('m-b'), { place: 'l2', places: [3] }))
    socket.receive(snapshot(7, mapa('m-b'), { place: 'l2', places: Array.from({ length: 100 }, (_, i) => `l${i}`) }))
    expect(connection.getState().rev).toBe(1)
    expect((connection.getState().places ?? []).map((p) => p.id)).toEqual(['l1'])
  })
})
