/**
 * MINIGAME DE DANÇA no cliente do jogador: o que chega do mestre vira
 * `state.danca` (convite, estado, começar com a hora de chegada, pausa,
 * colegas em fila, desfecho, encerra), e as ações mandam Pronto, lote e fim
 * só quando valem. Mensagem de outra sessão cai.
 */
import { describe, expect, it } from 'vitest'
import type { DancaConviteMessage, DancaPlacarFinal } from '../net/protocoloDaDanca'
import { DANCA_EVENTOS_MAX } from '../net/protocoloDaDanca'
import { DANCA_FILA_DE_COLEGAS_MAX } from './estadoDaDanca'
import { createPlayerConnection, type SocketLike } from './playerConnection'

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

const CONVITE: DancaConviteMessage = {
  type: 'danca.convite',
  sessao: 's1',
  pinId: 'pino-danca',
  npc: 'Dona Ziza',
  fala: 'Acompanha o meu tempo?',
  permitida: 'escolha',
  notaMin: 'B',
  premio: { tipo: 'item', texto: 'Chave de latão' },
  musica: { tipo: 'demo' },
  participantes: [{ playerId: 'p1', nome: 'Ana' }, { playerId: 'p2', nome: 'Bruno' }],
}
const COMECAR = { type: 'danca.comecar', sessao: 's1', emMs: 3000, participantes: [{ playerId: 'p1', nome: 'Ana', dificuldade: 'expert' }, { playerId: 'p2', nome: 'Bruno', dificuldade: 'diversao' }] }
const PLACAR = { precisao: 0.9, combo: 4, vida: 64, julgadas: 5 }
const FINAL: DancaPlacarFinal = { precisao: 0.9, letra: 'A', falhou: false, perfeito: 50, bom: 8, ok: 2, errou: 1, comboMax: 40, segOk: 0, segTotal: 0 }

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
  socket.sent = []
  return { connection, socket, danca: () => connection.getState().danca }
}

describe('dança no cliente do jogador', () => {
  it('o convite vira o estado, e o Pronto respeita a dificuldade permitida', () => {
    const { connection, socket, danca } = conectado()
    socket.receive({ ...CONVITE, permitida: 'expert' })
    expect(danca()?.convite).toMatchObject({ npc: 'Dona Ziza', permitida: 'expert', participantes: CONVITE.participantes })
    expect(connection.dancaPronto('diversao')).toBe(false)
    expect(connection.dancaPronto('expert')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'danca.pronto', sessao: 's1', dificuldade: 'expert' }])
    expect(danca()?.pronto).toBe('expert')
    // O mesmo convite de novo (a volta da conexão) guarda o Pronto; outro convite recomeça.
    socket.receive({ ...CONVITE, permitida: 'expert' })
    expect(danca()?.pronto).toBe('expert')
    socket.receive({ ...CONVITE, sessao: 's2' })
    expect(danca()?.sessao).toBe('s2')
    expect(danca()?.pronto).toBeUndefined()
  })

  it('começar guarda a hora de chegada; pausa e retomada também; o estado chega', () => {
    const { socket, danca } = conectado()
    socket.receive(CONVITE)
    socket.receive({ type: 'danca.estado', sessao: 's1', fase: 'convite', participantes: [{ playerId: 'p1', status: 'pronto' }, { playerId: 'p2', status: 'convidado' }] })
    expect(danca()?.estado?.participantes[0]).toEqual({ playerId: 'p1', status: 'pronto' })
    // Pausa antes do começar não vale.
    socket.receive({ type: 'danca.pausa', sessao: 's1' })
    expect(danca()?.pausada).toBe(false)
    socket.receive(COMECAR)
    const comecar = danca()?.comecar
    expect(comecar).toMatchObject({ emMs: 3000, participantes: COMECAR.participantes })
    expect(typeof comecar?.recebidoEm).toBe('number')
    socket.receive({ ...COMECAR, emMs: 10 })
    expect(danca()?.comecar?.emMs).toBe(3000)
    socket.receive({ type: 'danca.pausa', sessao: 's1' })
    expect(danca()?.pausada).toBe(true)
    expect(typeof danca()?.pausaMudouEm).toBe('number')
    socket.receive({ type: 'danca.retoma', sessao: 's1' })
    expect(danca()?.pausada).toBe(false)
  })

  it('os lotes dos colegas entram em fila com seq crescente, e o último placar de cada um fica', () => {
    const { socket, danca } = conectado()
    socket.receive(CONVITE)
    socket.receive(COMECAR)
    for (let i = 0; i < DANCA_FILA_DE_COLEGAS_MAX + 3; i += 1) {
      socket.receive({ type: 'danca.colegas', sessao: 's1', playerId: 'p2', eventos: [{ lane: 1, j: 'bom', t: i }], placar: { ...PLACAR, combo: i } })
    }
    const fila = danca()?.colegas ?? []
    expect(fila).toHaveLength(DANCA_FILA_DE_COLEGAS_MAX)
    expect(fila.at(-1)?.seq).toBe(DANCA_FILA_DE_COLEGAS_MAX + 3)
    expect(danca()?.placares.p2?.combo).toBe(DANCA_FILA_DE_COLEGAS_MAX + 2)
  })

  it('toques e fim só saem na música, conferidos; o fim sai uma vez e trava os lotes', () => {
    const { connection, socket } = conectado()
    expect(connection.dancaToques({ eventos: [], placar: PLACAR })).toBe(false)
    socket.receive(CONVITE)
    expect(connection.dancaToques({ eventos: [], placar: PLACAR })).toBe(false)
    socket.receive(COMECAR)
    // O Pronto não sai depois do começar.
    expect(connection.dancaPronto('expert')).toBe(false)
    const eventos = [{ lane: 0 as const, j: 'perfeito' as const, t: 1.5 }]
    expect(connection.dancaToques({ eventos, placar: PLACAR })).toBe(true)
    const demais = Array.from({ length: DANCA_EVENTOS_MAX + 1 }, () => ({ lane: 0 as const, j: 'perfeito' as const, t: 1.5 }))
    expect(connection.dancaToques({ eventos: demais, placar: PLACAR })).toBe(false)
    expect(connection.dancaToques({ eventos, placar: { ...PLACAR, precisao: 1.5 } })).toBe(false)
    expect(connection.dancaFim(FINAL)).toBe(true)
    expect(connection.dancaFim(FINAL)).toBe(false)
    expect(connection.dancaToques({ eventos, placar: PLACAR })).toBe(false)
    expect(socket.sent).toEqual([
      { type: 'danca.toques', sessao: 's1', eventos, placar: PLACAR },
      { type: 'danca.fim', sessao: 's1', placar: FINAL },
    ])
  })

  it('desfecho e encerra chegam; de outra sessão caem; fecharDanca e a sala fechada limpam', () => {
    const { connection, socket, danca } = conectado()
    socket.receive(CONVITE)
    socket.receive({ type: 'danca.encerra', sessao: 'outra', motivo: 'mestre' })
    expect(danca()?.encerrada).toBeUndefined()
    socket.receive({ type: 'danca.encerra', sessao: 's1', motivo: 'fora' })
    expect(danca()?.encerrada).toBe('fora')
    connection.fecharDanca()
    expect(danca()).toBeUndefined()
    socket.receive(CONVITE)
    socket.receive(COMECAR)
    const desfecho = { type: 'danca.desfecho', sessao: 's1', todosPassaram: true, portaAberta: true, mesa: [{ playerId: 'p1', nome: 'Ana', letra: 'A', precisao: 0.9 }], seu: { passou: true, premio: CONVITE.premio } }
    socket.receive(desfecho)
    expect(danca()?.desfecho).toEqual({ todosPassaram: true, portaAberta: true, mesa: desfecho.mesa, seu: desfecho.seu })
    // Desfecho torto (letra que não existe) cai inteiro.
    socket.receive({ ...CONVITE, sessao: 's3' })
    socket.receive({ ...desfecho, sessao: 's3', mesa: [{ playerId: 'p1', nome: 'Ana', letra: 'Z', precisao: 0.9 }] })
    expect(danca()?.desfecho).toBeUndefined()
    socket.receive({ type: 'room.closed' })
    expect(danca()).toBeUndefined()
  })
})
