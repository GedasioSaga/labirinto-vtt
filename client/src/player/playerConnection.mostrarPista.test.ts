/**
 * "MOSTRAR AGORA A…" no cliente do jogador: `pin.show` vira `state.shownPin`,
 * que fica até `dismissShownPin`. O cartão que chega passa por `parsePinShow`:
 * forma errada, pino de viagem ou imagem que não é data URL derrubam a
 * mensagem inteira (a imagem vira `null`, nunca um caminho do mestre).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { parsePinShow } from '../net/protocol'
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
    name: 'Gabi',
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' })
  return { connection, socket }
}

function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return mesa
}

const CARTA = { id: 'carta', kind: 'exclamacao', description: 'Encontre-me na capela', image: 'data:image/png;base64,AAAA' }

describe('parsePinShow', () => {
  it('aceita o cartão e devolve só os campos conhecidos', () => {
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, x: 10, y: 20, destino: { sceneId: 's', pinId: 'p' }, lerDePerto: 2 } })).toEqual({
      type: 'pin.show',
      pin: CARTA,
    })
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, icon: 'chave', image: null } })).toEqual({
      type: 'pin.show',
      pin: { ...CARTA, icon: 'chave', image: null },
    })
  })

  it('imagem que não é data URL não passa como foto: vira null', () => {
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, image: 'C:/mestre/carta.png' } })?.pin.image).toBeNull()
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, image: 'javascript:alert(1)' } })?.pin.image).toBeNull()
  })

  it('recusa forma errada, pino de viagem e símbolo desconhecido', () => {
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, kind: 'viagem' } })).toBeNull()
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, kind: 'outro' } })).toBeNull()
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, id: '' } })).toBeNull()
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, description: 7 } })).toBeNull()
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, icon: 'dragao' } })).toBeNull()
    expect(parsePinShow({ type: 'pin.show', pin: { ...CARTA, image: 5 } })).toBeNull()
    expect(parsePinShow({ type: 'pin.show' })).toBeNull()
    expect(parsePinShow({ type: 'scene.note', pin: CARTA })).toBeNull()
    expect(parsePinShow(null)).toBeNull()
  })
})

describe('cartão mostrado pelo mestre no cliente do jogador', () => {
  it('abre sozinho; um novo toma o lugar; dismissShownPin fecha', () => {
    const { connection, socket } = jogando()
    expect(connection.getState().shownPin).toBeUndefined()
    socket.receive({ type: 'pin.show', pin: CARTA })
    const primeiro = connection.getState().shownPin
    expect(primeiro?.pin).toEqual(CARTA)
    socket.receive({ type: 'pin.show', pin: CARTA })
    const segundo = connection.getState().shownPin
    // O mesmo pino mostrado de novo reabre: outra identidade para o cartão remontar.
    expect(segundo?.pin).toEqual(CARTA)
    expect(segundo?.id).not.toBe(primeiro?.id)
    connection.dismissShownPin()
    expect(connection.getState().shownPin).toBeUndefined()
  })

  it('cartão malformado não abre nem fecha o que está aberto', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'pin.show', pin: CARTA })
    socket.receive({ type: 'pin.show', pin: { ...CARTA, kind: 'viagem', description: 'outro' } })
    expect(connection.getState().shownPin?.pin.description).toBe(CARTA.description)
  })

  it('fora do jogo (aguardando) o cartão é ignorado; trocar de cena fecha o aberto', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'lobby.waiting' })
    socket.receive({ type: 'pin.show', pin: CARTA })
    expect(connection.getState().shownPin).toBeUndefined()
    const mesa = jogando()
    mesa.socket.receive({ type: 'pin.show', pin: CARTA })
    expect(mesa.connection.getState().shownPin?.pin.id).toBe('carta')
    mesa.socket.receive({ type: 'scene.changed' })
    expect(mesa.connection.getState().shownPin).toBeUndefined()
  })
})
