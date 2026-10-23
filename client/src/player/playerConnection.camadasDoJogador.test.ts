/**
 * `camadasDoJogador` NA REDE (fatia 4 de `docs/planos/camadas-fase3-2026-10-22.md`):
 * campo aditivo de topo do mapa. `isMapShape` não muda; a leitura é tolerante
 * (ausente = padrão; torto = padrão, sem derrubar a mensagem) e o patch
 * (`net/viewPatch.ts`) o leva como qualquer campo de topo.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { diffMap } from '../net/viewPatch'
import type { MapData, Token } from '../types/map'
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
const MAPA: MapData = { ...createEmptyMap('m1', 'Mapa', 10, 10, 50), tokens: [ANA] }

function receberCom(camadasDoJogador: unknown) {
  const { connection, socket } = conectar()
  socket.receive({ type: 'snapshot', rev: 1, map: { ...MAPA, camadasDoJogador }, vision: [] })
  return { connection, socket }
}

describe('leitura tolerante de camadasDoJogador', () => {
  it('lista boa chega como veio (id e alfa)', () => {
    const lista = [{ id: 'salas' }, { id: 'chao' }, { id: 'livre_a1', alfa: 0.4 }]
    const { connection } = receberCom(lista)
    expect(connection.getState()).toMatchObject({ status: 'playing', rev: 1 })
    expect(connection.getState().map?.camadasDoJogador).toEqual(lista)
  })

  it('mapa sem o campo (host antigo, mapa antigo) entra sem ele', () => {
    const { connection, socket } = conectar()
    socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [] })
    expect(connection.getState()).toMatchObject({ status: 'playing', rev: 1 })
    expect(connection.getState().map).not.toHaveProperty('camadasDoJogador')
  })

  const tortos: [string, unknown][] = [
    ['texto', 'salas'],
    ['objeto', { id: 'salas' }],
    ['lista vazia', []],
    ['id que não é camada', [{ id: 'salas' }, { id: 'Segredo do Lich' }]],
    ['item que não é objeto', [{ id: 'salas' }, 'chao']],
    ['alfa em texto', [{ id: 'salas', alfa: '0.4' }]],
    ['alfa nulo (o JSON leva Infinity como null)', [{ id: 'salas', alfa: null }]],
    ['id repetido', [{ id: 'salas' }, { id: 'salas' }]],
  ]
  for (const [nome, valor] of tortos) {
    it(`campo torto (${nome}) vira o padrão e a mensagem entra`, () => {
      const { connection } = receberCom(valor)
      expect(connection.getState()).toMatchObject({ status: 'playing', rev: 1 })
      expect(connection.getState().map).not.toHaveProperty('camadasDoJogador')
    })
  }

  it('campo a mais num item (um nome) fica de fora; a opacidade fora de 0..1 é limitada', () => {
    const { connection } = receberCom([{ id: 'salas', nome: 'Segredo do Lich' }, { id: 'chao', alfa: 7 }, { id: 'tokens', alfa: -1 }])
    expect(connection.getState().map?.camadasDoJogador).toEqual([{ id: 'salas' }, { id: 'chao' }, { id: 'tokens', alfa: 0 }])
    expect(JSON.stringify(connection.getState().map)).not.toContain('Segredo do Lich')
  })
})

describe('camadasDoJogador no patch (campo de topo, sem mudar a versão do protocolo)', () => {
  it('o campo novo atravessa o patch e chega à tela', () => {
    const { connection, socket } = conectar()
    socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [] })
    const depois: MapData = { ...MAPA, camadasDoJogador: [{ id: 'salas' }, { id: 'chao', alfa: 0.4 }] }
    const patch = diffMap(MAPA, depois)
    expect(patch?.set).toEqual({ camadasDoJogador: depois.camadasDoJogador })
    socket.receive({ type: 'patch', rev: 2, base: 1, map: patch })
    expect(connection.getState()).toMatchObject({ status: 'playing', rev: 2 })
    expect(connection.getState().map?.camadasDoJogador).toEqual([{ id: 'salas' }, { id: 'chao', alfa: 0.4 }])
  })

  it('o campo que some não cabe num patch: o host manda o mapa inteiro', () => {
    const antes: MapData = { ...MAPA, camadasDoJogador: [{ id: 'salas' }] }
    expect(diffMap(antes, MAPA)).toBeNull()
  })

  it('campo torto no patch vira o padrão, sem pedir a tela inteira de novo', () => {
    const { connection, socket } = conectar()
    socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [] })
    socket.receive({ type: 'patch', rev: 2, base: 1, map: { set: { camadasDoJogador: [{ id: 42 }] } } })
    expect(connection.getState()).toMatchObject({ status: 'playing', rev: 2 })
    expect(connection.getState().map).not.toHaveProperty('camadasDoJogador')
  })
})
