/**
 * RECADO POR CENA no cliente do jogador: `scene.note` vira `state.note`, que
 * fica até `dismissNote`. Forma errada ou texto acima do teto: a mensagem
 * inteira cai (não aparece um pedaço).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { NOTE_MAX_LENGTH, parseSceneNote } from '../net/protocol'
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

/** Conexão com o socket já aberto; o teste decide o que o mestre manda. */
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

/** Jogador já jogando (snapshot aplicado): é o único estado em que o recado aparece. */
function jogando() {
  const mesa = conectado()
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return mesa
}

describe('parseSceneNote', () => {
  it('aceita id e texto dentro do teto, e devolve só os campos conhecidos', () => {
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', sceneId: 's-salao' })).toEqual({ type: 'scene.note', id: 'n1', text: 'oi' })
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'x'.repeat(NOTE_MAX_LENGTH) })?.text.length).toBe(NOTE_MAX_LENGTH)
  })

  it('"só para você" passa só quando é exatamente true', () => {
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', onlyYou: true })).toEqual({ type: 'scene.note', id: 'n1', text: 'oi', onlyYou: true })
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', onlyYou: 1 })).toEqual({ type: 'scene.note', id: 'n1', text: 'oi' })
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', onlyYou: false })).toEqual({ type: 'scene.note', id: 'n1', text: 'oi' })
  })

  it('recusa forma errada e texto acima do teto', () => {
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'x'.repeat(NOTE_MAX_LENGTH + 1) })).toBeNull()
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: '' })).toBeNull()
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 42 })).toBeNull()
    expect(parseSceneNote({ type: 'scene.note', id: '', text: 'oi' })).toBeNull()
    expect(parseSceneNote({ type: 'scene.note', text: 'oi' })).toBeNull()
    expect(parseSceneNote({ type: 'laser', id: 'n1', text: 'oi' })).toBeNull()
    expect(parseSceneNote(['scene.note'])).toBeNull()
    expect(parseSceneNote(null)).toBeNull()
  })
})

describe('recado no cliente do jogador', () => {
  it('guarda o recado, o novo substitui o aberto, e dismissNote fecha', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'A porta range.' })
    expect(connection.getState().note).toEqual({ id: 'n1', text: 'A porta range.' })
    socket.receive({ type: 'scene.note', id: 'n2', text: 'Outro.' })
    expect(connection.getState().note).toEqual({ id: 'n2', text: 'Outro.' })
    connection.dismissNote()
    expect(connection.getState().note).toBeUndefined()
  })

  it('recado malformado ou grande demais não aparece nem apaga o que está aberto', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'fica' })
    socket.receive({ type: 'scene.note', id: 'n2', text: 'x'.repeat(NOTE_MAX_LENGTH + 1) })
    socket.receive({ type: 'scene.note', id: 'n3' })
    socket.receive({ type: 'scene.note', id: 7, text: 'y' })
    expect(connection.getState().note).toEqual({ id: 'n1', text: 'fica' })
  })

  it('recado SÓ PARA VOCÊ guarda a marca; o da cena não ganha marca nenhuma', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'scene.note', id: 'n1', text: 'Só você viu a carta.', onlyYou: true })
    expect(connection.getState().note).toEqual({ id: 'n1', text: 'Só você viu a carta.', onlyYou: true })
    // Marca com valor estranho não vale: sem `true`, é recado comum.
    socket.receive({ type: 'scene.note', id: 'n2', text: 'Todos ouvem.', onlyYou: 'sim' })
    expect(connection.getState().note).toEqual({ id: 'n2', text: 'Todos ouvem.' })
  })

  it('fora do jogo (aguardando) o recado é ignorado', () => {
    const { connection, socket: s } = conectado()
    s.receive({ type: 'lobby.waiting' })
    s.receive({ type: 'scene.note', id: 'n1', text: 'oi' })
    expect(connection.getState().note).toBeUndefined()
  })
})
