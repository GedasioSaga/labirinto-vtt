/**
 * AJUSTE RÁPIDO no cliente do jogador: o clique aparece na hora (a ficha
 * otimista) e vai à mesa JUNTO com os do mesmo instante — dez "−" são um
 * pedido só, e clique normal nunca chega ao teto de pedidos da mesa. A
 * resposta (ou a queda, ou o silêncio) tira o otimista; recusado, avisa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { AJUSTE_INTERVALO_MS, AJUSTE_JUNTAR_MS, createPlayerConnection, ENVIO_DE_PERSONAGEM_PRAZO_MS, type SocketLike } from './playerConnection'

const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy', recursos: { hp: 600, sp: 60, escudo: 0 } }
/** O teto da mesa (`PERSONAGEM_PEDIDOS_POR_JANELA` em 10 s). */
const TETO_DA_MESA = 20

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
  socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  socket.receive({ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE })
  socket.receive({ type: 'personagens', personagens: [LUFFY], tokens: [{ tokenId: 'tok-ana', nome: 'Ana', personagemId: LUFFY.id }] })
  const ajustes = () => socket.sent.filter((m) => m.type === 'personagem.ajustar')
  const menosUm = (valor: number) => connection.ajustarPersonagem(LUFFY.id, { parte: 'recurso', chave: 'hp', valor })
  return { connection, socket, ajustes, menosUm }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ajuste rápido do jogador: juntar e mandar', () => {
  it('dez "−" rápidos: a ficha mostra já, e vai UM pedido com o último valor quando os cliques param', () => {
    const { connection, ajustes, menosUm } = conectado()
    for (let i = 1; i <= 10; i += 1) {
      expect(menosUm(600 - i)).toBe(true)
      vi.advanceTimersByTime(100)
    }
    expect(connection.getState().ajustesPendentes).toEqual([{ personagemId: LUFFY.id, parte: 'recurso', chave: 'hp', valor: 590 }])
    expect(ajustes()).toEqual([])
    vi.advanceTimersByTime(AJUSTE_JUNTAR_MS)
    expect(ajustes()).toEqual([{ type: 'personagem.ajustar', reqId: expect.any(String), personagemId: LUFFY.id, ajustes: [{ parte: 'recurso', chave: 'hp', valor: 590 }] }])
  })

  it('partes diferentes vão juntas, na ordem do último clique de cada uma', () => {
    const { connection, ajustes } = conectado()
    connection.ajustarPersonagem(LUFFY.id, { parte: 'recurso', chave: 'hp', valor: 650 })
    connection.ajustarPersonagem(LUFFY.id, { parte: 'maximo', chave: 'hp', valor: 700 })
    connection.ajustarPersonagem(LUFFY.id, { parte: 'recurso', chave: 'hp', valor: 690 })
    vi.advanceTimersByTime(AJUSTE_JUNTAR_MS)
    expect(ajustes()[0]?.ajustes).toEqual([
      { parte: 'maximo', chave: 'hp', valor: 700 },
      { parte: 'recurso', chave: 'hp', valor: 690 },
    ])
  })

  it(`nunca dois envios a menos de ${AJUSTE_INTERVALO_MS} ms; clique de meio em meio segundo por 10 s fica abaixo do teto da mesa`, () => {
    const { socket, ajustes, menosUm } = conectado()
    let respondidos = 0
    /** A mesa responde cada pedido (e assim a conexão segue viva para o vigia do ping). */
    const mesaResponde = () => {
      for (const pedido of ajustes().slice(respondidos)) socket.receive({ type: 'personagem.resultado', reqId: pedido.reqId, ok: true })
      respondidos = ajustes().length
      socket.receive({ type: 'pong' })
    }
    for (let i = 1; i <= 20; i += 1) {
      expect(menosUm(600 - i)).toBe(true)
      vi.advanceTimersByTime(500)
      mesaResponde()
    }
    vi.advanceTimersByTime(AJUSTE_INTERVALO_MS)
    expect(ajustes().length).toBeGreaterThan(1)
    expect(ajustes().length).toBeLessThan(TETO_DA_MESA)
    // E o último valor chegou: nada se perde ao juntar.
    expect(ajustes().at(-1)?.ajustes).toEqual([{ parte: 'recurso', chave: 'hp', valor: 580 }])
  })

  it('a mesa confirma: o otimista sai (a ficha que ela mandou já tem o valor); recusa: sai e avisa', () => {
    const { connection, socket, ajustes, menosUm } = conectado()
    menosUm(590)
    vi.advanceTimersByTime(AJUSTE_JUNTAR_MS)
    const primeiro = ajustes()[0]?.reqId
    socket.receive({ type: 'personagens', personagens: [{ ...LUFFY, recursos: { ...LUFFY.recursos, hp: 590 } }], tokens: [] })
    socket.receive({ type: 'personagem.resultado', reqId: primeiro, ok: true })
    expect([connection.getState().ajustesPendentes, connection.getState().ajusteFalhou]).toEqual([[], false])

    menosUm(580)
    vi.advanceTimersByTime(AJUSTE_INTERVALO_MS)
    socket.receive({ type: 'personagem.resultado', reqId: ajustes()[1]?.reqId, ok: false })
    expect([connection.getState().ajustesPendentes, connection.getState().ajusteFalhou]).toEqual([[], true])
    // A resposta do ajuste não mexe no envio do "Salvar".
    expect(connection.getState().envioDePersonagem).toBeUndefined()
  })

  it('sem resposta no prazo: o otimista sai e avisa', () => {
    const { connection, menosUm } = conectado()
    menosUm(590)
    vi.advanceTimersByTime(AJUSTE_JUNTAR_MS)
    expect(connection.getState().ajustesPendentes).toHaveLength(1)
    vi.advanceTimersByTime(ENVIO_DE_PERSONAGEM_PRAZO_MS)
    expect([connection.getState().ajustesPendentes, connection.getState().ajusteFalhou]).toEqual([[], true])
  })

  it('a conexão cai com clique na fila: nada sai depois, a ficha volta ao que a mesa tem', () => {
    const { connection, socket, ajustes, menosUm } = conectado()
    menosUm(590)
    socket.readyState = 3
    socket.onclose?.(new CloseEvent('close', { code: 1006 }))
    expect([connection.getState().ajustesPendentes, connection.getState().ajusteFalhou]).toEqual([[], true])
    vi.advanceTimersByTime(AJUSTE_JUNTAR_MS * 2)
    expect(ajustes()).toEqual([])
    expect(menosUm(580)).toBe(false)
  })
})
