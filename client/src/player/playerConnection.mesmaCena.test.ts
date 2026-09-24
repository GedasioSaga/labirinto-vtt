/**
 * ATALHO NA MESMA CENA no cliente do jogador: o mapa não muda de id, então a
 * câmera não reenquadra sozinha (ela só reenquadra mapa novo). O
 * `scene.changed` seguido de um snapshot do MESMO mapa pede à tela que
 * centre a própria ficha — é a chegada pelo atalho. Troca de cena de verdade
 * não pede nada: o mapa novo já chega enquadrado.
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
  const snapshot = (mapId: string) => {
    rev += 1
    const map = { ...createEmptyMap(mapId, '', 10, 10, 50), tokens: [ficha('heroi'), ficha('cachorro')] }
    socket.receive({ type: 'snapshot', rev, map, vision: [], ownTokens: ['heroi', 'cachorro'], concealed: [] })
  }
  snapshot('mapa-torre')
  return { connection, socket, snapshot }
}

function ficha(id: string) {
  return { id, characterId: null, name: id, x: 100, y: 100, size: 1, image: null }
}

describe('playerConnection: chegada pelo atalho na mesma cena', () => {
  it('scene.changed + snapshot do MESMO mapa pede para centrar a ficha, uma vez por chegada', () => {
    const t = jogando()
    expect(t.connection.getState().arrivalFocus).toBeUndefined()
    t.socket.receive({ type: 'scene.changed', tokenId: 'heroi' })
    // Antes do snapshot a ficha ainda está no ponto de partida: nada a centrar.
    expect(t.connection.getState().arrivalFocus).toBeUndefined()
    t.snapshot('mapa-torre')
    const primeira = t.connection.getState().arrivalFocus
    expect(primeira).toEqual({ seq: 1, tokenId: 'heroi' })
    // O snapshot seguinte (a ficha andando) não pede de novo.
    t.snapshot('mapa-torre')
    expect(t.connection.getState().arrivalFocus).toBe(primeira)
    // A próxima chegada pede outra vez.
    t.socket.receive({ type: 'scene.changed', tokenId: 'heroi' })
    t.snapshot('mapa-torre')
    expect(t.connection.getState().arrivalFocus).toEqual({ seq: 2, tokenId: 'heroi' })
    expect(t.connection.getState().travel).toMatchObject({ phase: 'arrived' })
  })

  it('duas fichas: centra a que ATRAVESSOU (o host diz qual), não a primeira da lista', () => {
    const t = jogando()
    t.socket.receive({ type: 'scene.changed', tokenId: 'cachorro' })
    t.snapshot('mapa-torre')
    expect(t.connection.getState().arrivalFocus).toEqual({ seq: 1, tokenId: 'cachorro' })
  })

  it('host antigo (sem tokenId) ou id que não é ficha dele: cai na primeira ficha dele no mapa', () => {
    const t = jogando()
    t.socket.receive({ type: 'scene.changed' })
    t.snapshot('mapa-torre')
    expect(t.connection.getState().arrivalFocus).toEqual({ seq: 1, tokenId: 'heroi' })
    t.socket.receive({ type: 'scene.changed', tokenId: 'zumbi-do-mestre' })
    t.snapshot('mapa-torre')
    expect(t.connection.getState().arrivalFocus).toEqual({ seq: 2, tokenId: 'heroi' })
  })

  it('troca de cena de verdade (mapa novo) não pede: o enquadramento do mapa novo já cuida', () => {
    const t = jogando()
    t.socket.receive({ type: 'scene.changed' })
    t.snapshot('mapa-cripta')
    expect(t.connection.getState().arrivalFocus).toBeUndefined()
    expect(t.connection.getState().map?.id).toBe('mapa-cripta')
  })

  it('snapshot comum, sem chegada, não pede', () => {
    const t = jogando()
    t.snapshot('mapa-torre')
    expect(t.connection.getState().arrivalFocus).toBeUndefined()
    expect(t.connection.getState().map?.id).toBe('mapa-torre')
  })
})
