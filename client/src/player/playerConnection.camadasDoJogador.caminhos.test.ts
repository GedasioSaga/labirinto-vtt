/**
 * `camadasDoJogador` POR TODO CAMINHO QUE CHEGA À TELA (revisão da fatia 4):
 * a tela da mesa (TV, `TableScreen.tsx`) usa a mesma conexão e lê o campo
 * igual; a memória de outro andar (`snapshot.andares`) vira um `PlayerView`
 * inteiro (`player/main.tsx`), então o mapa dela passa pela mesma leitura
 * tolerante (torto = padrão; bom = a mesma lista).
 */
import { describe, expect, it } from 'vitest'
import { createExploration, encodeExploration } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createPlayerConnection, TABLE_SCREEN_NAME, type SocketLike } from './playerConnection'

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

function conectar(name: string) {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name,
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
const BOA = [{ id: 'salas' }, { id: 'chao' }, { id: 'livre_0e41e1c8', alfa: 0.4 }]

describe('tela da mesa (TV): a mesma leitura do jogador', () => {
  it('lista boa chega como veio; torta vira o padrão sem derrubar a mensagem', () => {
    const boa = conectar(TABLE_SCREEN_NAME)
    boa.socket.receive({ type: 'snapshot', rev: 1, map: { ...MAPA, camadasDoJogador: BOA }, vision: [] })
    expect(boa.connection.getState().map?.camadasDoJogador).toEqual(BOA)

    const torta = conectar(TABLE_SCREEN_NAME)
    torta.socket.receive({ type: 'snapshot', rev: 1, map: { ...MAPA, camadasDoJogador: { id: 'salas' } }, vision: [] })
    expect(torta.connection.getState()).toMatchObject({ status: 'playing', rev: 1 })
    expect(torta.connection.getState().map).not.toHaveProperty('camadasDoJogador')
  })
})

describe('memória de outro andar: o mapa dela passa pela leitura tolerante', () => {
  const andar = (camadasDoJogador: unknown) => ({
    rotulo: 'B1',
    map: { ...createEmptyMap('m-porao', '', 10, 10, 50), camadasDoJogador },
    explored: encodeExploration(createExploration({ width: 500, height: 500, grid: 50 })),
    concealed: [],
  })
  const receberAndar = (camadasDoJogador: unknown) => {
    const { connection, socket } = conectar('Ana')
    socket.receive({ type: 'snapshot', rev: 1, map: MAPA, vision: [], andares: { atual: '1F', outros: [andar(camadasDoJogador)] } })
    return connection
  }

  const tortos: [string, unknown][] = [
    ['objeto no lugar da lista', { id: 'salas' }],
    ['texto', 'salas'],
    ['id que não é camada', [{ id: 'Segredo do Lich' }]],
  ]
  for (const [nome, valor] of tortos) {
    it(`campo torto (${nome}) no andar: o andar entra sem o campo`, () => {
      const connection = receberAndar(valor)
      const outros = connection.getState().andares?.outros ?? []
      expect(outros.map((o) => o.rotulo)).toEqual(['B1'])
      expect(outros[0]?.map).not.toHaveProperty('camadasDoJogador')
    })
  }

  it('lista boa no andar chega como veio', () => {
    const connection = receberAndar(BOA)
    expect(connection.getState().andares?.outros[0]?.map.camadasDoJogador).toEqual(BOA)
  })
})
