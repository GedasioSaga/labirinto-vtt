/**
 * CHAT DOS JOGADORES no cliente: guardar o que o host manda em cada canal
 * ('cena' e 'global'), acender a menção a mim, mandar a fala limpa e
 * acompanhar a resposta. O cliente confere o que chega como o host confere o
 * que sai: linha torta cai, e a chave da cena nunca vem. Plano:
 * docs/plano-chat.md (fatia A).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { chatOf, createPlayerConnection, hasChatMention, type SocketLike } from './playerConnection'

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

/** Entra como "Ana"; o host pode devolver outro nome no `welcome` (nome repetido ganha sufixo). */
function conectado(nomeNoWelcome = 'Ana') {
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
  socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: nomeNoWelcome })
  return { connection, socket }
}

function jogando(nomeNoWelcome = 'Ana') {
  const mesa = conectado(nomeNoWelcome)
  mesa.socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
  if (mesa.connection.getState().status !== 'playing') throw new Error('esperava jogando')
  mesa.socket.sent = []
  return mesa
}

/** Jogando, com as duas listas já recebidas (vazias), como logo depois da entrada. */
function comChat(nomeNoWelcome = 'Ana') {
  const mesa = jogando(nomeNoWelcome)
  mesa.socket.receive({ type: 'chat.history', channel: 'global', messages: [] })
  mesa.socket.receive({ type: 'chat.history', channel: 'cena', messages: [] })
  return mesa
}

function linha(id: string, text: string, mentions: string[] = [], from = 'Bruno') {
  return { id, at: 1000, from, text, mentions }
}

/** O `reqId` do último pedido que saiu. */
function ultimoReqId(sent: unknown[]): string {
  const ultimo = sent.at(-1)
  if (typeof ultimo !== 'object' || ultimo === null || !('reqId' in ultimo) || typeof ultimo.reqId !== 'string') {
    throw new Error('esperava um pedido com reqId')
  }
  return ultimo.reqId
}

function nomes(quantos: number): string[] {
  return Array.from({ length: quantos }, (_, i) => `Nome ${i + 1}`)
}

describe('chat no cliente: o que chega', () => {
  it('o welcome começa as duas listas vazias; cada chat.history troca só a lista do canal dele', () => {
    const { connection, socket } = jogando()
    // O host só manda a história que tem linha: a lista vazia é o que o welcome já deixa.
    expect(connection.getState().chat).toEqual({ cena: [], global: [] })
    expect(hasChatMention(connection.getState())).toBe(false)
    const g1 = linha('g1', 'oi')
    const g2 = linha('g2', 'tudo bem?', [], 'Caio')
    socket.receive({ type: 'chat.history', channel: 'global', messages: [g1, g2] })
    expect(connection.getState().chat).toEqual({ cena: [], global: [g1, g2] })
    const c1 = linha('c1', 'na cena')
    socket.receive({ type: 'chat.msg', channel: 'cena', msg: c1 })
    const g3 = linha('g3', 'lista nova')
    socket.receive({ type: 'chat.history', channel: 'global', messages: [g3] })
    expect(connection.getState().chat).toEqual({ cena: [c1], global: [g3] })
  })

  it('linha torta do histórico cai sozinha; mensagem torta não muda nada; a chave da cena não fica', () => {
    const { connection, socket } = comChat()
    const c1 = linha('c1', 'primeira')
    const c3 = linha('c3', 'terceira')
    socket.receive({
      type: 'chat.history',
      channel: 'cena',
      messages: [{ ...c1, sceneKey: 'm-salao' }, linha('', 'sem id'), { ...linha('c2', 'x'), text: 42 }, 'lixo', c3],
    })
    expect(connection.getState().chat?.cena).toEqual([c1, c3])
    const antes = connection.getState().chat
    socket.receive({ type: 'chat.msg', channel: 'cena', msg: { ...linha('c4', 'oi'), mentions: 'Ana' } })
    socket.receive({ type: 'chat.msg', channel: 'sala', msg: linha('c5', 'oi') })
    socket.receive({ type: 'chat.history', channel: 'global', messages: 'nada' })
    socket.receive({ type: 'chat.msg', channel: 'global', msg: linha('g1', 'x'.repeat(1001)) })
    expect(connection.getState().chat).toBe(antes)
    expect(JSON.stringify(connection.getState())).not.toContain('m-salao')
  })

  it('guarda no máximo 200 por canal, e o mesmo id não entra duas vezes', () => {
    const { connection, socket } = comChat()
    socket.receive({ type: 'chat.history', channel: 'global', messages: Array.from({ length: 205 }, (_, i) => linha(`g${i + 1}`, `fala ${i + 1}`)) })
    const global = connection.getState().chat?.global ?? []
    expect(global).toHaveLength(200)
    expect(global[0]?.id).toBe('g6')
    const nova = linha('g206', 'fala 206')
    socket.receive({ type: 'chat.msg', channel: 'global', msg: nova })
    socket.receive({ type: 'chat.msg', channel: 'global', msg: nova })
    const depois = connection.getState().chat?.global ?? []
    expect(depois).toHaveLength(200)
    expect(depois[0]?.id).toBe('g7')
    expect(depois[199]).toEqual(nova)
  })
})

describe('chat no cliente: menção a mim', () => {
  it('só a mensagem nova que me menciona acende, e no canal dela', () => {
    const { connection, socket } = comChat()
    socket.receive({ type: 'chat.msg', channel: 'global', msg: linha('g1', '@Caio vem', ['Caio']) })
    expect(hasChatMention(connection.getState())).toBe(false)
    socket.receive({ type: 'chat.msg', channel: 'cena', msg: linha('c1', '@Ana olha', ['Ana']) })
    expect(connection.getState().chatUnread).toEqual({ cena: ['c1'], global: [] })
    expect(hasChatMention(connection.getState())).toBe(true)
  })

  it('o nome que vale é o que o host deu no welcome, não o que eu digitei', () => {
    const { connection, socket } = comChat('Ana (2)')
    socket.receive({ type: 'chat.msg', channel: 'global', msg: linha('g1', '@Ana oi', ['Ana']) })
    expect(hasChatMention(connection.getState())).toBe(false)
    socket.receive({ type: 'chat.msg', channel: 'global', msg: linha('g2', '@Ana (2) oi', ['Ana (2)']) })
    expect(connection.getState().chatUnread).toEqual({ cena: [], global: ['g2'] })
  })

  it('o histórico não acende nada, nem com menção a mim', () => {
    const { connection, socket } = comChat()
    socket.receive({ type: 'chat.history', channel: 'global', messages: [linha('g1', '@Ana antiga', ['Ana'])] })
    expect(hasChatMention(connection.getState())).toBe(false)
  })

  it('ler um canal apaga só a marca dele; sem marca, ler não avisa ninguém', () => {
    const { connection, socket } = comChat()
    socket.receive({ type: 'chat.msg', channel: 'cena', msg: linha('c1', '@Ana', ['Ana']) })
    socket.receive({ type: 'chat.msg', channel: 'global', msg: linha('g1', '@Ana', ['Ana']) })
    connection.markChatRead('cena')
    expect(connection.getState().chatUnread).toEqual({ cena: [], global: ['g1'] })
    expect(hasChatMention(connection.getState())).toBe(true)
    connection.markChatRead('global')
    expect(hasChatMention(connection.getState())).toBe(false)
    let avisos = 0
    const solta = connection.subscribe(() => {
      avisos += 1
    })
    connection.markChatRead('global')
    connection.markChatRead('cena')
    solta()
    expect(avisos).toBe(0)
  })

  it('o chat.history da cena mantém a marca da linha que continua nela e solta a que saiu', () => {
    const { connection, socket } = comChat()
    const c1 = linha('c1', '@Ana olha', ['Ana'])
    socket.receive({ type: 'chat.msg', channel: 'cena', msg: c1 })
    socket.receive({ type: 'chat.history', channel: 'cena', messages: [c1, linha('c2', 'outra')] })
    expect(connection.getState().chatUnread).toEqual({ cena: ['c1'], global: [] })
    socket.receive({ type: 'chat.history', channel: 'cena', messages: [] })
    expect(connection.getState().chat?.cena).toEqual([])
    expect(hasChatMention(connection.getState())).toBe(false)
  })
})

describe('chat no cliente: a volta (outro welcome)', () => {
  it('as listas recomeçam vazias; a marca volta com a lista dela, e a lida não acende de novo', () => {
    const { connection, socket } = comChat()
    const c1 = linha('c1', '@Ana olha', ['Ana'])
    socket.receive({ type: 'chat.msg', channel: 'cena', msg: c1 })
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    expect(connection.getState().chat).toEqual({ cena: [], global: [] })
    expect(hasChatMention(connection.getState())).toBe(false)
    socket.receive({ type: 'chat.history', channel: 'cena', messages: [linha('c0', 'antes'), c1] })
    expect(connection.getState().chatUnread).toEqual({ cena: ['c1'], global: [] })
    connection.markChatRead('cena')
    // Leu, saiu da cena e voltou a ela: a marca lida não acende de novo.
    socket.receive({ type: 'chat.history', channel: 'cena', messages: [] })
    socket.receive({ type: 'chat.history', channel: 'cena', messages: [linha('c0', 'antes'), c1] })
    expect(hasChatMention(connection.getState())).toBe(false)
  })

  it('a marca da lista que não volta não acende: longe, a ficha foi para uma cena sem a linha', () => {
    const { connection, socket } = comChat()
    socket.receive({ type: 'chat.msg', channel: 'cena', msg: linha('c1', '@Ana olha', ['Ana']) })
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    // A história da cena nova vem sem a c1; o global, vazio, nem vem.
    socket.receive({ type: 'chat.history', channel: 'cena', messages: [linha('c9', 'outra cena')] })
    expect(connection.getState().chat).toEqual({ cena: [linha('c9', 'outra cena')], global: [] })
    expect(hasChatMention(connection.getState())).toBe(false)
  })
})

describe('chat no cliente: mandar', () => {
  it('manda o texto limpo com as menções, e só a resposta do mesmo pedido conta', () => {
    const { connection, socket } = comChat()
    expect(connection.sendChat('cena', '  Oi\u202E @Bruno\u0000  ', ['Bruno'])).toBe(true)
    expect(socket.sent).toEqual([{ type: 'chat.send', reqId: expect.any(String), channel: 'cena', text: 'Oi @Bruno', mentions: ['Bruno'] }])
    const reqId = ultimoReqId(socket.sent)
    expect(connection.getState().chatSend).toEqual({ reqId, channel: 'cena', phase: 'sending' })
    socket.receive({ type: 'chat.send.result', reqId: 'outro', ok: true })
    expect(connection.getState().chatSend?.phase).toBe('sending')
    socket.receive({ type: 'chat.send.result', reqId, ok: true })
    expect(connection.getState().chatSend).toEqual({ reqId, channel: 'cena', phase: 'ok' })
  })

  it('a recusa diz o motivo que a tela conhece; motivo estranho vira falha comum', () => {
    const casos: Array<{ reason?: string; phase: string }> = [
      { reason: 'too_soon', phase: 'too_soon' },
      { reason: 'no_scene', phase: 'no_scene' },
      { reason: 'not_seated', phase: 'not_seated' },
      { reason: 'quota', phase: 'failed' },
      { phase: 'failed' },
    ]
    for (const caso of casos) {
      const { connection, socket } = comChat()
      expect(connection.sendChat('global', 'oi', [])).toBe(true)
      const reqId = ultimoReqId(socket.sent)
      socket.receive({ type: 'chat.send.result', reqId, ok: false, ...(caso.reason === undefined ? {} : { reason: caso.reason }) })
      expect(connection.getState().chatSend).toEqual({ reqId, channel: 'global', phase: caso.phase })
    }
  })

  it('um envio por vez: o segundo espera a resposta do primeiro', () => {
    const { connection, socket } = comChat()
    expect(connection.sendChat('global', 'um', [])).toBe(true)
    expect(connection.sendChat('global', 'dois', [])).toBe(false)
    expect(socket.sent).toHaveLength(1)
    socket.receive({ type: 'chat.send.result', reqId: ultimoReqId(socket.sent), ok: true })
    expect(connection.sendChat('global', 'dois', [])).toBe(true)
    expect(socket.sent).toHaveLength(2)
  })

  it('vazio depois de limpo, acima de 1000 ou menção torta não sai', () => {
    const { connection, socket } = comChat()
    expect(connection.sendChat('global', ' \u202E\u0000 \n ', [])).toBe(false)
    expect(connection.sendChat('global', 'x'.repeat(1001), [])).toBe(false)
    expect(connection.sendChat('global', 'oi', nomes(34))).toBe(false)
    expect(connection.sendChat('global', 'oi', [''])).toBe(false)
    expect(connection.sendChat('global', 'oi', ['x'.repeat(41)])).toBe(false)
    expect(socket.sent).toEqual([])
    expect(connection.getState().chatSend).toBeUndefined()
    // No teto, passa.
    expect(connection.sendChat('global', 'x'.repeat(1000), nomes(33))).toBe(true)
  })

  it('aguardando sem ficha: nada sai, e a tela nem tem o chat', () => {
    const { connection, socket } = conectado()
    socket.sent = []
    expect(connection.getState().status).toBe('waiting')
    expect(connection.sendChat('cena', 'oi', [])).toBe(false)
    expect(connection.sendChat('global', 'oi', [])).toBe(false)
    expect(socket.sent).toEqual([])
    expect(connection.getState().chatSend).toBeUndefined()
    expect(chatOf(connection.getState())).toBeUndefined()
  })

  it('jogando, a tela tem as duas listas; perdeu a última ficha, o chat some da tela com o envio no ar', () => {
    const { connection, socket } = comChat()
    expect(chatOf(connection.getState())).toEqual({ cena: [], global: [] })
    expect(connection.sendChat('cena', 'oi', [])).toBe(true)
    const reqId = ultimoReqId(socket.sent)
    socket.receive({ type: 'lobby.waiting' })
    expect(connection.getState().status).toBe('waiting')
    expect(chatOf(connection.getState())).toBeUndefined()
    // A recusa que chega depois não fica guardada para aparecer quando a ficha voltar.
    socket.receive({ type: 'chat.send.result', reqId, ok: false, reason: 'not_seated' })
    expect(connection.getState().chatSend).toBeUndefined()
    socket.sent = []
    expect(connection.sendChat('global', 'oi', [])).toBe(false)
    expect(socket.sent).toEqual([])
  })

  it('a queda esquece o envio no ar e guarda a conversa até o host mandar de novo', () => {
    const { connection, socket } = comChat()
    socket.receive({ type: 'chat.msg', channel: 'global', msg: linha('g1', 'oi') })
    expect(connection.sendChat('global', 'alô', [])).toBe(true)
    socket.onclose?.(new CloseEvent('close'))
    expect(connection.getState().chatSend).toBeUndefined()
    expect(connection.getState().chat?.global).toEqual([linha('g1', 'oi')])
  })

  it('o host recusou o pedido como inválido: o envio falha e a sessão continua', () => {
    const { connection, socket } = comChat()
    expect(connection.sendChat('global', 'oi', [])).toBe(true)
    socket.receive({ type: 'error', reason: 'invalid_message' })
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().chatSend?.phase).toBe('failed')
  })

  it('com outro pedido no ar, o invalid_message pode ser dele: o chat espera a própria resposta', () => {
    const { connection, socket } = comChat()
    expect(connection.sendLetter('Bruno', 'pombo', 'Te espero.')).toBe(true)
    expect(connection.sendChat('global', 'oi', [])).toBe(true)
    const reqId = ultimoReqId(socket.sent)
    socket.receive({ type: 'error', reason: 'invalid_message' })
    expect(connection.getState().status).toBe('playing')
    expect(connection.getState().chatSend).toEqual({ reqId, channel: 'global', phase: 'sending' })
    // A carta respondeu: agora o chat está sozinho no ar, e o erro seguinte é dele.
    socket.receive({ type: 'letter.send.result', to: 'Bruno', ok: true })
    socket.receive({ type: 'error', reason: 'invalid_message' })
    expect(connection.getState().chatSend).toEqual({ reqId, channel: 'global', phase: 'failed' })
  })

  it('com outro pedido no ar, a resposta do próprio envio ainda chega e vale', () => {
    const { connection, socket } = comChat()
    expect(connection.sendLetter('Bruno', 'pombo', 'Te espero.')).toBe(true)
    expect(connection.sendChat('global', 'oi', [])).toBe(true)
    const reqId = ultimoReqId(socket.sent)
    socket.receive({ type: 'error', reason: 'invalid_message' })
    socket.receive({ type: 'chat.send.result', reqId, ok: true })
    expect(connection.getState().chatSend).toEqual({ reqId, channel: 'global', phase: 'ok' })
  })
})
