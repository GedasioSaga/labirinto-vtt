/**
 * CONSERTO DAS FICHAS F1, fatia S1 (bug 1 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): o jogador clica, a mesa
 * recusa, e a tela dele diz por quê, em vez de nada acontecer. O pedido sem
 * resposta no prazo também vira aviso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, PEDIDO_DE_BATALHA_PRAZO_MS, SEM_RESPOSTA_DA_MESA, type SocketLike } from './playerConnection'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: { type: string; reqId?: string; [chave: string]: unknown }[] = []
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

/** A Ana na mesa, com a batalha ligada na cena dela (o recorte mínimo) e a ficha `tok-ana`. */
function naBatalha() {
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
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: ['tok-ana'], concealed: [] })
  socket.receive({ type: 'batalha.estado', estado: { rodada: 1, turno: { n: 0, m: 0 }, vez: null, proxima: null, minhaVez: false, vezForaDaVista: false, cartas: [], registro: [], regras: null } })
  if (connection.getState().batalhaEstado === undefined) throw new Error('o recorte da batalha não chegou')
  // A reação livre (o botão REAÇÃO sem golpe esperando): o pedido que precisa de menos recorte.
  const reagir = () => connection.reagirNaBatalha({ tipo: 'rolar', golpeId: null, tokenId: 'tok-ana', modificador: 0 })
  const ultimoPedido = () => socket.sent.filter((mensagem) => mensagem.type === 'batalha.reagir').at(-1)
  return { connection, socket, reagir, ultimoPedido }
}

describe('bug 1: a recusa da mesa vira aviso na tela do jogador', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ok:false com motivo: o aviso diz "A mesa não aceitou: ..."; sem motivo, o genérico; o aceito não avisa', () => {
    const { connection, socket, reagir, ultimoPedido } = naBatalha()
    expect(reagir()).toBe(true)
    socket.receive({ type: 'batalha.resultado', reqId: ultimoPedido()?.reqId, ok: false, motivo: 'A vez já passou' })
    expect(connection.getState().recusaDaBatalha).toEqual({ id: 1, texto: 'A mesa não aceitou: a vez já passou.' })

    expect(reagir()).toBe(true)
    socket.receive({ type: 'batalha.resultado', reqId: ultimoPedido()?.reqId, ok: false })
    expect(connection.getState().recusaDaBatalha).toEqual({ id: 2, texto: 'A mesa não aceitou o pedido.' })

    expect(reagir()).toBe(true)
    socket.receive({ type: 'batalha.resultado', reqId: ultimoPedido()?.reqId, ok: true })
    expect(connection.getState().recusaDaBatalha?.id).toBe(2)
  })

  it('sem resposta no prazo: o aviso diz que a mesa não respondeu', () => {
    const { connection, socket, reagir } = naBatalha()
    expect(reagir()).toBe(true)
    // O host segue vivo (qualquer mensagem é prova de vida): só o pedido ficou sem resposta.
    const PASSO_MS = 1_000
    for (let passado = 0; passado < PEDIDO_DE_BATALHA_PRAZO_MS - PASSO_MS; passado += PASSO_MS) {
      vi.advanceTimersByTime(PASSO_MS)
      socket.receive({ type: 'pong' })
    }
    vi.advanceTimersByTime(PASSO_MS - 1)
    expect(connection.getState().recusaDaBatalha).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(connection.getState().recusaDaBatalha).toEqual({ id: 1, texto: SEM_RESPOSTA_DA_MESA })
  })
})
