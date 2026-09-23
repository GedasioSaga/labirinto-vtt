/**
 * MINHAS PISTAS no cliente do jogador: a pista confirmada pelo host
 * (`clue.added`) entra em `state.clues`; o caderno que o host manda na entrada
 * (`clues.book`) substitui o local — é assim que a pista sobrevive a recarregar.
 * A pista que um colega mostra (`clue.shown`) entra também e abre o cartão
 * "Gabi mostrou: Bilhete". Tudo que chega passa pelo parser: foto que não é
 * `data:image/` e campo desconhecido não entram.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { CLUEBOOK_MAX_CLUES } from '../lib/clues'
import { parseClueMessage, parsePlayerMessage } from '../net/protocol'
import type { Pin } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

const FOTO = 'data:image/png;base64,QklMSEVURQ=='
const AS_21_15 = new Date(2026, 8, 23, 21, 15).getTime()
const BILHETE = { id: 'c1', title: 'Bilhete', text: 'Bilhete\nNa torre.', image: FOTO, at: AS_21_15 }

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

function pino(id: string, description: string, image: string | null = null): Pin {
  return { id, x: 100, y: 100, kind: 'exclamacao', description, image }
}

function jogando(pins: Pin[] = []) {
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
  socket.receive({ type: 'snapshot', rev: 1, map: { ...createEmptyMap('m1', '', 10, 10, 50), pins }, vision: [], ownTokens: [], concealed: [] })
  if (connection.getState().status !== 'playing') throw new Error('esperava jogando')
  return { connection, socket }
}

describe('parseClueMessage', () => {
  it('aceita o caderno e devolve cópia só com os campos da pista (sem posição, cena ou pino)', () => {
    const suja = { ...BILHETE, x: 10, y: 20, sceneId: 's-casa', pinId: 'bilhete' }
    expect(parseClueMessage({ type: 'clues.book', clues: [suja], extra: 1 })).toEqual({ type: 'clues.book', clues: [BILHETE] })
    expect(parseClueMessage({ type: 'clue.shown', from: 'Gabi', clue: { ...BILHETE, from: 'Gabi' } })).toEqual({
      type: 'clue.shown',
      from: 'Gabi',
      clue: { ...BILHETE, from: 'Gabi' },
    })
    expect(parseClueMessage({ type: 'clue.peers', names: ['Ana', 'Bia'] })).toEqual({ type: 'clue.peers', names: ['Ana', 'Bia'] })
    expect(parseClueMessage({ type: 'clue.show.result', to: 'Ana', ok: true })).toEqual({ type: 'clue.show.result', to: 'Ana', ok: true })
  })

  it('foto fora de data:image, título vazio, lista grande demais ou forma errada recusam inteiro', () => {
    expect(parseClueMessage({ type: 'clue.added', clue: { ...BILHETE, image: 'C:\\mestre\\mapa.png' } })).toBeNull()
    expect(parseClueMessage({ type: 'clue.added', clue: { ...BILHETE, image: 'https://evil.example/x.png' } })).toBeNull()
    expect(parseClueMessage({ type: 'clue.added', clue: { ...BILHETE, title: '' } })).toBeNull()
    expect(parseClueMessage({ type: 'clue.added', clue: { ...BILHETE, at: Number.NaN } })).toBeNull()
    const muitas = Array.from({ length: CLUEBOOK_MAX_CLUES + 1 }, (_, i) => ({ ...BILHETE, id: `c${i}` }))
    expect(parseClueMessage({ type: 'clues.book', clues: muitas })).toBeNull()
    expect(parseClueMessage({ type: 'clue.peers', names: [42] })).toBeNull()
    expect(parseClueMessage({ type: 'clue.show.result', to: 'Ana', ok: 'sim' })).toBeNull()
    expect(parseClueMessage({ type: 'scene.note', id: 'n1', text: 'oi' })).toBeNull()
  })

  it('do jogador, o host aceita clue.read, clue.peers e clue.show e joga fora o resto', () => {
    expect(parsePlayerMessage({ type: 'clue.read', pinId: 'bilhete', x: 1 })).toEqual({ type: 'clue.read', pinId: 'bilhete' })
    expect(parsePlayerMessage({ type: 'clue.peers', names: ['x'] })).toEqual({ type: 'clue.peers' })
    expect(parsePlayerMessage({ type: 'clue.show', clueId: 'c1', to: 'Ana', from: 'Mestre' })).toEqual({ type: 'clue.show', clueId: 'c1', to: 'Ana' })
    expect(parsePlayerMessage({ type: 'clue.read', pinId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'clue.show', clueId: 'c1', to: '' })).toBeNull()
  })
})

describe('playerConnection: Minhas pistas', () => {
  it('abrir um pino com texto pede ao host para guardar; pino sem texto nem foto não pede', () => {
    const { connection, socket } = jogando([pino('bilhete', 'Bilhete'), pino('vazio', '   ')])
    expect(connection.readClue('bilhete')).toBe(true)
    expect(connection.readClue('vazio')).toBe(false)
    expect(connection.readClue('nao-existe')).toBe(false)
    expect(socket.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === 'clue.read')).toEqual([{ type: 'clue.read', pinId: 'bilhete' }])
  })

  it('clue.added entra no caderno; a mesma pista de novo substitui e sobe para o fim', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'clue.added', clue: BILHETE })
    socket.receive({ type: 'clue.added', clue: { ...BILHETE, id: 'c2', title: 'Chave', text: 'Chave' } })
    socket.receive({ type: 'clue.added', clue: { ...BILHETE, text: 'Bilhete\nNa torre, depois.' } })
    expect(connection.getState().clues?.map((c) => [c.id, c.text])).toEqual([
      ['c2', 'Chave'],
      ['c1', 'Bilhete\nNa torre, depois.'],
    ])
  })

  it('recarregar: o clues.book do host substitui o caderno inteiro', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'clue.added', clue: { ...BILHETE, id: 'velha' } })
    socket.receive({ type: 'clues.book', clues: [BILHETE] })
    expect(connection.getState().clues).toEqual([BILHETE])
  })

  it('colega mostrou: a pista entra no caderno e o cartão "de quem" abre; fechar some com o cartão, não com a pista', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'clue.shown', from: 'Gabi', clue: { ...BILHETE, from: 'Gabi' } })
    expect(connection.getState().shownClue).toEqual({ id: expect.any(Number), from: 'Gabi', clue: { ...BILHETE, from: 'Gabi' } })
    expect(connection.getState().clues).toEqual([{ ...BILHETE, from: 'Gabi' }])
    connection.dismissShownClue()
    expect(connection.getState().shownClue).toBeUndefined()
    expect(connection.getState().clues).toHaveLength(1)
  })

  it('"Mostrar para…": pede a lista, mostra, e guarda o resultado', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'clue.added', clue: BILHETE })
    expect(connection.askCluePeers()).toBe(true)
    expect(connection.getState().cluePeers).toEqual({ phase: 'loading' })
    socket.receive({ type: 'clue.peers', names: ['Ana'] })
    expect(connection.getState().cluePeers).toEqual({ phase: 'ready', names: ['Ana'] })
    expect(connection.showClue('c1', 'Ana')).toBe(true)
    expect(connection.getState().clueShow).toEqual({ to: 'Ana', phase: 'sending' })
    socket.receive({ type: 'clue.show.result', to: 'Ana', ok: true })
    expect(connection.getState().clueShow).toEqual({ to: 'Ana', phase: 'ok' })
    expect(socket.sent.slice(-2)).toEqual([{ type: 'clue.peers' }, { type: 'clue.show', clueId: 'c1', to: 'Ana' }])
    // Pista que o jogador não tem não sai.
    expect(connection.showClue('outra', 'Ana')).toBe(false)
    connection.resetClueShare()
    expect(connection.getState().cluePeers).toBeUndefined()
    expect(connection.getState().clueShow).toBeUndefined()
  })

  it('o host pediu para esperar (too_soon): o resultado diz isso, e não que o colega saiu', () => {
    expect(parseClueMessage({ type: 'clue.show.result', to: 'Bruno', ok: false, reason: 'too_soon' })).toEqual({
      type: 'clue.show.result',
      to: 'Bruno',
      ok: false,
      reason: 'too_soon',
    })
    // Motivo que este jogador não conhece (mestre mais novo) vira a recusa comum, sem travar em "Mostrando…".
    expect(parseClueMessage({ type: 'clue.show.result', to: 'Bruno', ok: false, reason: 'outro' })).toEqual({ type: 'clue.show.result', to: 'Bruno', ok: false })
    expect(parseClueMessage({ type: 'clue.show.result', to: 'Bruno', ok: false, reason: 7 })).toBeNull()
    const { connection, socket } = jogando()
    socket.receive({ type: 'clue.added', clue: BILHETE })
    connection.showClue('c1', 'Ana')
    socket.receive({ type: 'clue.show.result', to: 'Ana', ok: true })
    expect(connection.showClue('c1', 'Bruno')).toBe(true)
    socket.receive({ type: 'clue.show.result', to: 'Bruno', ok: false, reason: 'too_soon' })
    expect(connection.getState().clueShow).toEqual({ to: 'Bruno', phase: 'too_soon' })
    connection.showClue('c1', 'Bruno')
    socket.receive({ type: 'clue.show.result', to: 'Bruno', ok: false })
    expect(connection.getState().clueShow).toEqual({ to: 'Bruno', phase: 'failed' })
  })

  it('pista com foto em caminho de disco não entra no caderno', () => {
    const { connection, socket } = jogando()
    socket.receive({ type: 'clue.added', clue: { ...BILHETE, image: 'file:///C:/mestre/mapa.png' } })
    expect(connection.getState().clues).toBeUndefined()
  })
})
