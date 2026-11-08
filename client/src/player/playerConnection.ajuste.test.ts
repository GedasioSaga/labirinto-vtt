/**
 * AJUSTE RÁPIDO no cliente do jogador: o clique aparece na hora (a ficha
 * otimista) e vai à mesa JUNTO com os do mesmo instante — dez "−" são um
 * pedido só, e clique normal nunca chega ao teto de pedidos da mesa. A
 * resposta (ou a queda, ou o silêncio) tira o otimista; recusado, avisa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cliqueDaTela, comAjustes, valorDaParte } from '../lib/ajusteDaFicha'
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

/**
 * Conserto das fichas F1 (bug 5, revisão da fatia S2): o golpe chega no MEIO
 * dos cliques. Cada clique sai como a tela o faz (`cliqueDaTela` sobre a
 * ficha otimista); a mesa aplica o pedido como o host (`comAjustes` sobre a
 * ficha dela). Números do relatório: HP 365 de 400, Escudo 12, golpe de 112.
 */
describe('ajuste rápido do jogador: golpe no meio dos cliques', () => {
  const ANTES: Personagem = { ...LUFFY, recursos: { hp: 365, sp: 60, escudo: 12 }, maximos: { hp: 400, sp: 60 } }

  function naMesa(inicio: Personagem) {
    const t = conectado()
    const receber = (ficha: Personagem) => t.socket.receive({ type: 'personagens', personagens: [ficha], tokens: [{ tokenId: 'tok-ana', nome: 'Ana', personagemId: ficha.id }] })
    receber(inicio)
    /** A ficha que o jogador vê: a que chegou, com o que está na fila por cima. */
    const tela = (): Personagem => {
      const recebido = t.connection.getState().personagens?.personagens.find((personagem) => personagem.id === LUFFY.id)
      if (recebido === undefined) throw new Error('a ficha não chegou')
      return comAjustes(recebido, SISTEMA_ONE_PIECE, t.connection.getState().ajustesPendentes ?? [])
    }
    const hpNaTela = () => valorDaParte(tela(), 'recurso', 'hp')
    const clicar = (passo: number) => t.connection.ajustarPersonagem(LUFFY.id, cliqueDaTela(tela(), SISTEMA_ONE_PIECE, { parte: 'recurso', chave: 'hp', valor: hpNaTela() + passo }))
    return { ...t, receber, hpNaTela, clicar }
  }

  it('5 "−", o golpe de 112 chega (HP 265), mais 5 "−": a tela desce de 1 em 1 (260 → 255) e a mesa grava 255', () => {
    const { ajustes, receber, hpNaTela, clicar } = naMesa(ANTES)
    for (let i = 0; i < 5; i += 1) expect(clicar(-1)).toBe(true)
    expect(hpNaTela()).toBe(360)
    const comOGolpe: Personagem = { ...ANTES, recursos: { ...ANTES.recursos, hp: 265, escudo: 0 } }
    receber(comOGolpe)
    expect(hpNaTela()).toBe(260)
    for (let i = 0; i < 5; i += 1) expect(clicar(-1)).toBe(true)
    expect(hpNaTela()).toBe(255)

    vi.advanceTimersByTime(AJUSTE_JUNTAR_MS)
    const enviados = ajustes()[0]?.ajustes
    expect(enviados).toEqual([{ parte: 'recurso', chave: 'hp', valor: 355, de: 365 }])
    expect(comAjustes(comOGolpe, SISTEMA_ONE_PIECE, [{ parte: 'recurso', chave: 'hp', valor: 355, de: 365 }]).recursos.hp).toBe(255)
  })

  it('3 "+" no máximo (a tela fica em 400), o golpe de 100 chega: a mesa grava 300, sem um ganho que a tela não mostrou', () => {
    const cheio: Personagem = { ...ANTES, recursos: { ...ANTES.recursos, hp: 400 } }
    const { ajustes, receber, hpNaTela, clicar } = naMesa(cheio)
    for (let i = 0; i < 3; i += 1) clicar(+1)
    expect(hpNaTela()).toBe(400)
    const comOGolpe: Personagem = { ...cheio, recursos: { ...cheio.recursos, hp: 300 } }
    receber(comOGolpe)
    expect(hpNaTela()).toBe(300)

    vi.advanceTimersByTime(AJUSTE_JUNTAR_MS)
    const enviado = ajustes()[0]?.ajustes
    expect(enviado).toEqual([{ parte: 'recurso', chave: 'hp', valor: 400, de: 400 }])
    expect(comAjustes(comOGolpe, SISTEMA_ONE_PIECE, [{ parte: 'recurso', chave: 'hp', valor: 400, de: 400 }]).recursos.hp).toBe(300)
  })
})
