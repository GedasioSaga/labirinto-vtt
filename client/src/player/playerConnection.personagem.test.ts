/**
 * FICHA DE PERSONAGEM NA MESA, no cliente do jogador: o que o host manda vira
 * estado (sistema, personagens, fichas sem personagem); "Criar minha ficha" e
 * "Salvar" saem como pedidos, e o envio só termina quando TODOS respondem —
 * recusa, queda ou silêncio no prazo deixam o envio como falho.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { createPlayerConnection, ENVIO_DE_PERSONAGEM_PRAZO_MS, type SocketLike } from './playerConnection'

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }

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
  socket.receive({ type: 'personagens', personagens: [LUFFY], tokens: [{ tokenId: 'tok-ana', nome: 'Ana', personagemId: LUFFY.id }, { tokenId: 'tok-nami', nome: 'Nami', personagemId: null }] })
  const pedidos = (type: string) => socket.sent.filter((m) => m.type === type)
  return { connection, socket, pedidos }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ficha do jogador: o que chega', () => {
  it('o sistema e os personagens viram estado; a ficha sem personagem vem com null', () => {
    const { connection } = conectado()
    const state = connection.getState()
    expect(state.sistemaDeRpg?.id).toBe(SISTEMA_ONE_PIECE.id)
    expect(state.personagens?.personagens.map((p) => p.id)).toEqual([LUFFY.id])
    expect(state.personagens?.tokens.map((t) => t.personagemId)).toEqual([LUFFY.id, null])
  })

  it('o mestre editou: a lista nova substitui a velha', () => {
    const { connection, socket } = conectado()
    socket.receive({ type: 'personagens', personagens: [{ ...LUFFY, descricao: 'Capitão.' }], tokens: [] })
    expect(connection.getState().personagens?.personagens[0]?.descricao).toBe('Capitão.')
  })
})

describe('ficha do jogador: criar', () => {
  it('"Criar minha ficha" pede ao host e termina com o personagem que nasceu', () => {
    const { connection, socket, pedidos } = conectado()
    expect(connection.criarPersonagem('tok-nami')).toBe(true)
    const [pedido] = pedidos('personagem.criar')
    expect(pedido).toMatchObject({ type: 'personagem.criar', tokenId: 'tok-nami' })
    expect(connection.getState().envioDePersonagem).toMatchObject({ tipo: 'criar', pendentes: [pedido?.reqId], falhou: false })
    // Um envio por vez.
    expect(connection.criarPersonagem('tok-nami')).toBe(false)
    socket.receive({ type: 'personagem.resultado', reqId: pedido?.reqId, ok: true, personagemId: 'pers_nami' })
    expect(connection.getState().envioDePersonagem).toMatchObject({ pendentes: [], falhou: false, personagemId: 'pers_nami' })
  })
})

describe('ficha do jogador: salvar', () => {
  it('manda só o que mudou e uma mensagem por imagem; termina quando as duas respondem', () => {
    const { connection, socket, pedidos } = conectado()
    const rascunho = { ...LUFFY, retrato: FOTO, atributos: { ...LUFFY.atributos, forca: 45 } }
    expect(connection.salvarPersonagem(LUFFY, rascunho)).toEqual({ ok: true, nada: false })
    const [editar] = pedidos('personagem.editar')
    const [imagem] = pedidos('personagem.imagem')
    expect(editar).toMatchObject({ personagemId: LUFFY.id, partes: { atributos: { forca: 45 } } })
    expect(imagem).toMatchObject({ personagemId: LUFFY.id, imagem: FOTO })
    socket.receive({ type: 'personagem.resultado', reqId: editar?.reqId, ok: true })
    expect(connection.getState().envioDePersonagem?.pendentes).toEqual([imagem?.reqId])
    socket.receive({ type: 'personagem.resultado', reqId: imagem?.reqId, ok: true })
    expect(connection.getState().envioDePersonagem).toMatchObject({ tipo: 'salvar', pendentes: [], falhou: false })
  })

  it('uma recusa marca o envio todo como falho', () => {
    const { connection, socket, pedidos } = conectado()
    connection.salvarPersonagem(LUFFY, { ...LUFFY, nome: 'Monkey D. Luffy' })
    const [editar] = pedidos('personagem.editar')
    socket.receive({ type: 'personagem.resultado', reqId: editar?.reqId, ok: false })
    expect(connection.getState().envioDePersonagem).toMatchObject({ pendentes: [], falhou: true })
  })

  it('nada mudou: nada sai; texto acima do teto: recusa aqui, com o motivo', () => {
    const { connection, socket } = conectado()
    const antes = socket.sent.length
    expect(connection.salvarPersonagem(LUFFY, LUFFY)).toEqual({ ok: true, nada: true })
    const grande = connection.salvarPersonagem(LUFFY, { ...LUFFY, nome: 'L'.repeat(500) })
    expect(grande.ok).toBe(false)
    expect(socket.sent.length).toBe(antes)
  })

  it('a conexão caiu antes da resposta: o welcome da volta dá o envio como perdido', () => {
    const { connection, socket } = conectado()
    connection.salvarPersonagem(LUFFY, { ...LUFFY, descricao: 'Capitão.' })
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    expect(connection.getState().envioDePersonagem).toMatchObject({ pendentes: [], falhou: true })
  })

  it('o host não respondeu no prazo: o envio falha (a tela fica com o rascunho e pode salvar de novo)', () => {
    vi.useFakeTimers()
    const { connection } = conectado()
    connection.salvarPersonagem(LUFFY, { ...LUFFY, descricao: 'Capitão.' })
    vi.advanceTimersByTime(ENVIO_DE_PERSONAGEM_PRAZO_MS - 1)
    expect(connection.getState().envioDePersonagem?.falhou).toBe(false)
    vi.advanceTimersByTime(1)
    expect(connection.getState().envioDePersonagem).toMatchObject({ pendentes: [], falhou: true })
  })
})
