/**
 * LEVAR O MAPA PARA CASA, lado da conexão: cada snapshot guarda a cena em
 * `knownScenes`, sem pedir nada ao host. Só a planta e as fichas DO JOGADOR
 * ficam; a espera no lobby e o fim da sala não apagam o que ele conhece.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
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

function ficha(id: string, name: string, x: number) {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null }
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
  let rev = 0
  const visao = [
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
    ],
  ]
  const snapshot = (mapId: string, heroiX = 100) => {
    rev += 1
    const map = { ...createEmptyMap(mapId, '', 10, 10, 50), tokens: [ficha('heroi', 'Ana', heroiX), ficha('npc', 'Capataz traidor', 150)] }
    socket.receive({ type: 'snapshot', rev, map, vision: visao, ownTokens: ['heroi'], concealed: [] })
  }
  return { connection, socket, sockets, snapshot }
}

describe('playerConnection: cenas que o jogador conhece', () => {
  it('antes do primeiro snapshot não há cena; cada snapshot guarda a dele', () => {
    const t = jogando()
    expect(t.connection.getState().knownScenes ?? []).toEqual([])
    t.snapshot('cena-a')
    expect(t.connection.getState().knownScenes?.map((c) => c.mapId)).toEqual(['cena-a'])
  })

  it('trocar de cena guarda as duas, na ordem de chegada; a volta atualiza a primeira sem renumerar', () => {
    const t = jogando()
    t.snapshot('cena-a')
    t.snapshot('cena-b')
    t.snapshot('cena-a', 300)
    const cenas = t.connection.getState().knownScenes ?? []
    expect(cenas.map((c) => c.mapId)).toEqual(['cena-a', 'cena-b'])
    expect(cenas[0]?.minhasFichas).toEqual([{ x: 300, y: 100, size: 1 }])
    // A cena que ele deixou fica só com a memória.
    expect(cenas[1]?.vision).toEqual([])
  })

  it('ficha alheia não fica guardada: nem o nome, nem a posição', () => {
    const t = jogando()
    t.snapshot('cena-a')
    const guardado = JSON.stringify(t.connection.getState().knownScenes)
    expect(guardado).not.toContain('Capataz')
    expect(guardado).not.toContain('npc')
    expect(t.connection.getState().knownScenes?.[0]?.minhasFichas).toEqual([{ x: 100, y: 100, size: 1 }])
  })

  it('a espera no lobby e o fim da sala não apagam o que ele conhece', () => {
    const t = jogando()
    t.snapshot('cena-a')
    t.socket.receive({ type: 'lobby.waiting' })
    expect(t.connection.getState().knownScenes?.length).toBe(1)
    t.socket.receive({ type: 'room.closed' })
    expect(t.connection.getState().status).toBe('closed')
    expect(t.connection.getState().knownScenes?.length).toBe(1)
  })
})

describe('playerConnection: a queda não apaga o caderno que ele leva para casa', () => {
  const pista = { id: 'c1', title: 'Bilhete', text: 'Encontre-me na torre.', image: null, at: 1 }

  function comPistaERecado() {
    const t = jogando()
    t.snapshot('cena-a')
    t.socket.receive({ type: 'clue.added', clue: pista })
    t.socket.receive({ type: 'scene.note', id: 'n1', text: 'A guarda troca à meia-noite.', at: 2 })
    // O mestre fechou o app: o socket cai sem `room.closed`.
    t.socket.onclose?.(new CloseEvent('close'))
    return t
  }

  it('"Reconectar" zera a lista da tela, mas guarda as pistas e os recados para o arquivo', () => {
    const t = comPistaERecado()
    expect(t.connection.getState().error).toBe('connection_lost')
    t.connection.reconnect()
    const depois = t.connection.getState()
    expect(depois.status).toBe('connecting')
    expect(depois.clues).toBeUndefined()
    expect(depois.notebook).toBeUndefined()
    expect(depois.keptNotebook?.clues.map((c) => c.id)).toEqual(['c1'])
    expect(depois.keptNotebook?.notes.map((n) => n.text)).toEqual(['A guarda troca à meia-noite.'])
    expect(depois.knownScenes?.map((c) => c.mapId)).toEqual(['cena-a'])
  })

  it('duas quedas seguidas não perdem o guardado; o primeiro snapshot da volta o descarta', () => {
    const t = comPistaERecado()
    t.connection.reconnect()
    t.sockets[1]?.onclose?.(new CloseEvent('close'))
    t.connection.reconnect()
    expect(t.connection.getState().keptNotebook?.clues.map((c) => c.id)).toEqual(['c1'])
    expect(t.connection.getState().keptNotebook?.notes.map((n) => n.id)).toEqual(['n1'])

    const volta = t.sockets[2]
    if (!volta) throw new Error('o segundo Reconectar não abriu socket')
    volta.open()
    volta.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    volta.receive({ type: 'snapshot', rev: 9, map: createEmptyMap('cena-a', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    expect(t.connection.getState().status).toBe('playing')
    expect(t.connection.getState().keptNotebook).toBeUndefined()
  })
})
