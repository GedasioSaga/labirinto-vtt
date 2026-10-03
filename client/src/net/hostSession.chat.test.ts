/**
 * CHAT DOS JOGADORES (texto e @). Dois canais: 'cena' (quem tem a ficha na
 * mesma cena) e 'global' (quem joga com ficha, em qualquer cena). Quem aguarda
 * sem ficha não lê nem escreve. O host limpa o texto, refaz as menções, segura
 * a rajada e guarda as últimas 200 de cada canal em memória. O jogador nunca
 * recebe a chave da cena: só 'cena' ou 'global'. Plano: docs/plano-chat.md
 * (fatia A).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const TABLE_KEY = 'chave-da-tv'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

function salao(tokens: Token[]): HostScene {
  return { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', tokens) }
}

function cripta(tokens: Token[]): HostScene {
  return { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', tokens) }
}

/** Salão (aberto no editor) com as fichas de Ana e Dora; Cripta (de fundo) com a de Bruno. */
const mundo: HostWorld = {
  open: salao([ficha('lanterna', 100, 100), ficha('tocha', 150, 100)]),
  background: [cripta([ficha('machado', 200, 100)])],
}

/** O mesmo mundo com a foice na Cripta: a ficha que o mestre dá a quem chega. */
const comFoice: HostWorld = {
  open: salao([ficha('lanterna', 100, 100), ficha('tocha', 150, 100)]),
  background: [cripta([ficha('machado', 200, 100), ficha('foice', 250, 100)])],
}

/** O que nunca pode chegar ao jogador pelo chat: chave, id e nome da cena. */
const DA_CENA = ['m-salao', 'm-cripta', 's-salao', 's-cripta', 'Salao Norte', 'Cripta Rubra', 'sceneId', 'sceneKey']

/** Ana (c1, Salão), Bruno (c2, Cripta), Caio (c3, aguardando sem ficha) e Dora (c4, Salão). */
function mesa() {
  let n = 0
  const relogio = { agora: 0 }
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio.agora, randomId: () => `id-${(n += 1)}`, tableKey: TABLE_KEY })
  const tokens = new Map<string, string>()
  const entra = (clientId: string, name: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    tokens.set(name, welcome.resumeToken)
    return welcome.playerId
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  entra('c3', 'Caio')
  const dora = entra('c4', 'Dora')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.assignToken(dora, 'tocha')
  // O primeiro snapshot põe cada um na cena dele.
  s.broadcast(mundo)
  const resume = (name: string): string => {
    const token = tokens.get(name)
    if (token === undefined) throw new Error(`sem resume de ${name}`)
    return token
  }
  return { s, relogio, resume, ana, dora }
}

/** O playerId que o `welcome` deste resultado deu. */
function idDoWelcome(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

type Sessao = ReturnType<typeof createHostSession>
type Canal = 'cena' | 'global'

function fala(s: Sessao, clientId: string, channel: Canal, text: string, mentions: string[] = [], reqId = 'r1', world: HostWorld = mundo): HostResult {
  return s.handleMessage(clientId, { type: 'chat.send', reqId, channel, text, mentions }, world)
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

/** Quem recebeu mensagem deste tipo, na ordem de saída. */
function quemRecebe(r: HostResult, type: string): string[] {
  return r.outbound.filter((o) => o.msg.type === type).map((o) => o.clientId)
}

interface Linha {
  id: string
  at: number
  from: string
  text: string
  mentions: string[]
}

function comoLinha(value: unknown): Linha {
  if (typeof value !== 'object' || value === null) throw new Error('esperava uma linha do chat')
  if (!('id' in value) || !('at' in value) || !('from' in value) || !('text' in value) || !('mentions' in value)) {
    throw new Error('linha do chat sem campo')
  }
  const { id, at, from, text, mentions } = value
  if (typeof id !== 'string' || typeof at !== 'number' || typeof from !== 'string' || typeof text !== 'string' || !Array.isArray(mentions)) {
    throw new Error('linha do chat malformada')
  }
  return { id, at, from, text, mentions: mentions.map(String) }
}

/** A linha que saiu no `chat.msg` deste resultado (a primeira). */
function linhaDe(r: HostResult): Linha {
  const msg: unknown = r.outbound.find((o) => o.msg.type === 'chat.msg')?.msg
  if (typeof msg !== 'object' || msg === null || !('msg' in msg)) throw new Error('esperava chat.msg')
  return comoLinha(msg.msg)
}

/** A linha que o `chat.msg` deste resultado levou a `clientId`: cada um recebe a sua cópia. */
function linhaPara(r: HostResult, clientId: string): Linha {
  const msg: unknown = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'chat.msg')?.msg
  if (typeof msg !== 'object' || msg === null || !('msg' in msg)) throw new Error(`esperava chat.msg para ${clientId}`)
  return comoLinha(msg.msg)
}

/** O resultado do envio para quem mandou. */
function resultadoDe(r: HostResult): { ok: boolean; reason?: unknown } {
  const msg: unknown = r.outbound.find((o) => o.msg.type === 'chat.send.result')?.msg
  if (typeof msg !== 'object' || msg === null || !('ok' in msg) || typeof msg.ok !== 'boolean') throw new Error('esperava chat.send.result')
  return 'reason' in msg ? { ok: msg.ok, reason: msg.reason } : { ok: msg.ok }
}

/** A lista do canal que o `chat.history` levou a `clientId` neste resultado. */
function historicoDe(r: HostResult, clientId: string, channel: Canal): Linha[] {
  const msg: unknown = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'chat.history' && 'channel' in o.msg && o.msg.channel === channel)?.msg
  if (typeof msg !== 'object' || msg === null || !('messages' in msg) || !Array.isArray(msg.messages)) throw new Error(`esperava chat.history de ${channel}`)
  return msg.messages.map(comoLinha)
}

/** Quantos `chat.history` saíram neste resultado (de um cliente só, se `clientId` vier). */
function historicos(r: HostResult, clientId?: string): number {
  return r.outbound.filter((o) => o.msg.type === 'chat.history' && (clientId === undefined || o.clientId === clientId)).length
}

function semCena(r: HostResult): void {
  const texto = JSON.stringify(r.outbound.filter((o) => o.msg.type.startsWith('chat.')))
  for (const chave of DA_CENA) expect(texto).not.toContain(chave)
}

describe('chat: canais', () => {
  it('cena A não vê cena B: só quem está no Salão ouve o Salão, e ninguém recebe a chave da cena', () => {
    const { s } = mesa()
    const r = fala(s, 'c1', 'cena', 'Alguém viu a porta?')
    const linha = { type: 'chat.msg', channel: 'cena', msg: { id: expect.any(String), at: 0, from: 'Ana', text: 'Alguém viu a porta?', mentions: [] } }
    expect(r.outbound).toEqual([
      { clientId: 'c1', msg: linha },
      { clientId: 'c4', msg: linha },
      { clientId: 'c1', msg: { type: 'chat.send.result', reqId: 'r1', ok: true } },
    ])
    const daCripta = fala(s, 'c2', 'cena', 'Aqui embaixo está escuro')
    expect(quemRecebe(daCripta, 'chat.msg')).toEqual(['c2'])
    semCena(r)
    semCena(daCripta)
  })

  it('global chega a quem joga, em qualquer cena; quem aguarda sem ficha não fala nem ouve, e a tela da mesa também não', () => {
    const { s } = mesa()
    s.handleMessage('tv1', { type: 'join', code: CODE, name: 'Mesa', role: 'table', tableKey: TABLE_KEY }, mundo)
    expect(fala(s, 'c3', 'global', 'Posso entrar?').outbound).toEqual([
      { clientId: 'c3', msg: { type: 'chat.send.result', reqId: 'r1', ok: false, reason: 'not_seated' } },
    ])
    const r = fala(s, 'c2', 'global', 'Alguém no Salão?')
    expect(quemRecebe(r, 'chat.msg')).toEqual(['c1', 'c2', 'c4'])
    expect(r.outbound.find((o) => o.msg.type === 'chat.msg')?.msg).toEqual({
      type: 'chat.msg',
      channel: 'global',
      msg: { id: expect.any(String), at: 0, from: 'Bruno', text: 'Alguém no Salão?', mentions: [] },
    })
    expect(para(r, 'c3')).toBe('[]')
    expect(para(r, 'tv1')).toBe('[]')
    expect(fala(s, 'tv1', 'global', 'sou a TV').outbound).toEqual([{ clientId: 'tv1', msg: { type: 'error', reason: 'not_joined' } }])
    expect(fala(s, 'c99', 'global', 'quem sou eu').outbound).toEqual([{ clientId: 'c99', msg: { type: 'error', reason: 'not_joined' } }])
    semCena(r)
  })

  it('quem entra sem ficha não recebe o global; ao ganhar a ficha, recebe a história dele uma vez', () => {
    const { s } = mesa()
    fala(s, 'c2', 'global', 'Alguém no Salão?')
    fala(s, 'c1', 'cena', 'segredo do salão')
    const entrou = s.handleMessage('c5', { type: 'join', code: CODE, name: 'Eva' }, mundo)
    expect(historicos(entrou, 'c5')).toBe(0)
    expect(JSON.stringify(entrou.outbound)).not.toContain('Alguém no Salão?')
    s.assignToken(idDoWelcome(entrou), 'foice')
    const ganhou = s.broadcast(comFoice)
    expect(historicoDe(ganhou, 'c5', 'global').map((linha) => linha.text)).toEqual(['Alguém no Salão?'])
    expect(historicos(ganhou, 'c5')).toBe(1)
    expect(JSON.stringify(ganhou.outbound)).not.toContain('segredo do salão')
    semCena(ganhou)
    expect(historicos(s.broadcast(comFoice), 'c5')).toBe(0)
  })

  it('quem aguarda sem ficha não tem chat: falar em qualquer canal volta "sem ficha" e não chega a ninguém; ao voltar, nada vem', () => {
    const { s, resume } = mesa()
    fala(s, 'c1', 'cena', 'segredo do salão')
    fala(s, 'c2', 'global', 'Alguém no Salão?')
    const canais: Canal[] = ['cena', 'global']
    for (const canal of canais) {
      expect(fala(s, 'c3', canal, 'e eu?').outbound).toEqual([
        { clientId: 'c3', msg: { type: 'chat.send.result', reqId: 'r1', ok: false, reason: 'not_seated' } },
      ])
    }
    s.disconnect('c3')
    const volta = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Caio', resume: resume('Caio') }, mundo)
    expect(historicos(volta)).toBe(0)
    expect(JSON.stringify(volta.outbound)).not.toContain('segredo do salão')
    expect(JSON.stringify(volta.outbound)).not.toContain('Alguém no Salão?')
  })
})

describe('chat: só o que mudou', () => {
  it('sem nada guardado, entrar, voltar, ganhar a ficha, trocar de cena e perder a ficha não mandam chat.history', () => {
    const { s, resume } = mesa()
    const eva = s.handleMessage('c5', { type: 'join', code: CODE, name: 'Eva' }, mundo)
    expect(historicos(eva)).toBe(0)
    s.disconnect('c4')
    expect(historicos(s.handleMessage('c9', { type: 'join', code: CODE, name: 'Dora', resume: resume('Dora') }, mundo))).toBe(0)
    const evaId = idDoWelcome(eva)
    s.assignToken(evaId, 'foice')
    expect(historicos(s.broadcast(comFoice))).toBe(0)
    const desceu: HostWorld = {
      open: salao([ficha('lanterna', 100, 100)]),
      background: [cripta([ficha('machado', 200, 100), ficha('tocha', 250, 100), ficha('foice', 300, 100)])],
    }
    expect(historicos(s.broadcast(desceu))).toBe(0)
    s.unassignToken(evaId, 'foice')
    const semTocha: HostWorld = { open: salao([ficha('lanterna', 100, 100)]), background: [cripta([ficha('machado', 200, 100)])] }
    expect(historicos(s.broadcast(semTocha))).toBe(0)
  })

  it('a cena nova vazia apaga a lista só de quem tinha linha na de antes', () => {
    const { s } = mesa()
    fala(s, 'c2', 'cena', 'na cripta')
    // Bruno sobe da Cripta (com linha) para o Salão (vazio); Dora desce do Salão (vazio) para a Cripta.
    const trocaram: HostWorld = {
      open: salao([ficha('lanterna', 100, 100), ficha('machado', 150, 100)]),
      background: [cripta([ficha('tocha', 200, 100)])],
    }
    expect(s.broadcast(trocaram).outbound.filter((o) => o.msg.type === 'chat.history')).toEqual([
      { clientId: 'c2', msg: { type: 'chat.history', channel: 'cena', messages: [] } },
      { clientId: 'c4', msg: { type: 'chat.history', channel: 'cena', messages: [expect.objectContaining({ from: 'Bruno', text: 'na cripta' })] } },
    ])
  })
})

describe('chat: troca de cena', () => {
  it('a ficha desce para a Cripta: chega o chat.history da nova, sem nada da antiga; quem ficou não recebe nada', () => {
    const { s } = mesa()
    fala(s, 'c1', 'cena', 'no salão')
    fala(s, 'c2', 'cena', 'na cripta')
    const desceu: HostWorld = {
      open: salao([ficha('lanterna', 100, 100)]),
      background: [cripta([ficha('machado', 200, 100), ficha('tocha', 250, 100)])],
    }
    const r = s.broadcast(desceu)
    expect(r.outbound.filter((o) => o.msg.type === 'chat.history')).toEqual([
      { clientId: 'c4', msg: { type: 'chat.history', channel: 'cena', messages: [expect.objectContaining({ from: 'Bruno', text: 'na cripta' })] } },
    ])
    semCena(r)
    // Agora Dora fala com Bruno, e Ana não ouve.
    expect(quemRecebe(fala(s, 'c4', 'cena', 'cheguei', [], 'r2', desceu), 'chat.msg')).toEqual(['c2', 'c4'])
    // Um envio sem troca de cena não repete a história.
    expect(s.broadcast(desceu).outbound.filter((o) => o.msg.type === 'chat.history')).toEqual([])
  })

  it('"Olhar por…" a ficha dele em outra cena também traz a história de lá', () => {
    const { s, ana } = mesa()
    fala(s, 'c2', 'cena', 'na cripta')
    s.assignToken(ana, 'foice')
    expect(s.broadcast(comFoice).outbound.filter((o) => o.msg.type === 'chat.history')).toEqual([])
    const r = s.handleMessage('c1', { type: 'view.switch', tokenId: 'foice' }, comFoice)
    expect(r.outbound.filter((o) => o.msg.type === 'chat.history')).toEqual([
      { clientId: 'c1', msg: { type: 'chat.history', channel: 'cena', messages: [expect.objectContaining({ from: 'Bruno', text: 'na cripta' })] } },
    ])
    semCena(r)
  })

  it('perdeu a ficha: a lista da cena esvazia', () => {
    const { s } = mesa()
    fala(s, 'c1', 'cena', 'no salão')
    const semTocha: HostWorld = { open: salao([ficha('lanterna', 100, 100)]), background: [cripta([ficha('machado', 200, 100)])] }
    const r = s.broadcast(semTocha)
    expect(r.outbound.filter((o) => o.msg.type === 'chat.history')).toEqual([
      { clientId: 'c4', msg: { type: 'chat.history', channel: 'cena', messages: [] } },
    ])
  })

  it('perdeu a ficha: a lista do global esvazia, o global para de chegar e falar volta "sem ficha"', () => {
    const { s, dora } = mesa()
    fala(s, 'c2', 'global', 'Alguém no Salão?')
    s.unassignToken(dora, 'tocha')
    const r = s.broadcast(mundo)
    expect(r.outbound.filter((o) => o.msg.type === 'chat.history')).toEqual([
      { clientId: 'c4', msg: { type: 'chat.history', channel: 'global', messages: [] } },
    ])
    expect(quemRecebe(fala(s, 'c1', 'global', 'cadê a Dora?'), 'chat.msg')).toEqual(['c1', 'c2'])
    expect(resultadoDe(fala(s, 'c4', 'global', 'fui tirada', [], 'r2'))).toEqual({ ok: false, reason: 'not_seated' })
  })

  it('trocou de cena e o snapshot ainda não saiu: a história nova chega antes da linha', () => {
    const { s } = mesa()
    fala(s, 'c2', 'cena', 'na cripta')
    const desceu: HostWorld = {
      open: salao([ficha('lanterna', 100, 100)]),
      background: [cripta([ficha('machado', 200, 100), ficha('tocha', 250, 100)])],
    }
    // Bruno fala no mundo novo antes do broadcast que levaria Dora para a Cripta.
    const r = fala(s, 'c2', 'cena', 'oi', [], 'r2', desceu)
    expect(r.outbound.filter((o) => o.clientId === 'c4').map((o) => o.msg.type)).toEqual(['chat.history', 'chat.msg'])
    expect(historicoDe(r, 'c4', 'cena').map((linha) => linha.text)).toEqual(['na cripta'])
    expect(quemRecebe(r, 'chat.msg')).toEqual(['c2', 'c4'])
    semCena(r)
  })

  it('ganhou a ficha e o snapshot ainda não saiu: a história do global chega antes da linha nova', () => {
    const { s } = mesa()
    fala(s, 'c2', 'global', 'Alguém no Salão?')
    const entrou = s.handleMessage('c5', { type: 'join', code: CODE, name: 'Eva' }, mundo)
    s.assignToken(idDoWelcome(entrou), 'foice')
    const r = fala(s, 'c1', 'global', 'Bem-vinda', [], 'r2', comFoice)
    expect(r.outbound.filter((o) => o.clientId === 'c5').map((o) => o.msg.type)).toEqual(['chat.history', 'chat.msg'])
    expect(historicoDe(r, 'c5', 'global').map((linha) => linha.text)).toEqual(['Alguém no Salão?'])
  })
})

describe('chat: história', () => {
  it('quem volta para a cena recebe as últimas 200 dela, na ordem; o global também guarda só 200', () => {
    const { s, relogio, resume } = mesa()
    for (let i = 1; i <= 205; i += 1) {
      relogio.agora += 700
      expect(resultadoDe(fala(s, 'c1', 'cena', `cena ${i}`, [], `a${i}`)).ok).toBe(true)
      expect(resultadoDe(fala(s, 'c2', 'global', `global ${i}`, [], `b${i}`)).ok).toBe(true)
    }
    s.disconnect('c4')
    const volta = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Dora', resume: resume('Dora') }, mundo)
    const cena = historicoDe(volta, 'c9', 'cena')
    expect(cena).toHaveLength(200)
    expect(cena[0]?.text).toBe('cena 6')
    expect(cena[199]?.text).toBe('cena 205')
    const global = historicoDe(volta, 'c9', 'global')
    expect(global).toHaveLength(200)
    expect(global[0]?.text).toBe('global 6')
    expect(global[199]?.text).toBe('global 205')
  })
})

describe('chat: menções refeitas pelo host', () => {
  it('cada um recebe só a própria menção: a dos colegas, o nome que não existe e o @mestre não chegam a jogador', () => {
    const { s } = mesa()
    const cena = fala(s, 'c1', 'cena', '@Dora @Bruno @Zé @mestre olhem isto', ['Dora', 'Bruno', 'Zé', 'mestre'])
    expect(linhaPara(cena, 'c4').mentions).toEqual(['Dora'])
    expect(linhaPara(cena, 'c1').mentions).toEqual([])
    const global = fala(s, 'c1', 'global', '@bruno e @Zé, venham; @Mestre e @dora também', ['Bruno', 'Zé', 'mestre', 'Dora'], 'r2')
    expect(linhaPara(global, 'c2').mentions).toEqual(['Bruno'])
    expect(linhaPara(global, 'c4').mentions).toEqual(['Dora'])
    expect(linhaPara(global, 'c1').mentions).toEqual([])
  })

  it('na cena, colega de outra cena cai: quando ele sobe, a história não o marca', () => {
    const { s } = mesa()
    fala(s, 'c1', 'cena', '@Bruno @Dora venham', ['Bruno', 'Dora'])
    // Bruno sobe da Cripta para o Salão.
    const subiu: HostWorld = {
      open: salao([ficha('lanterna', 100, 100), ficha('tocha', 150, 100), ficha('machado', 200, 100)]),
      background: [cripta([])],
    }
    expect(historicoDe(s.broadcast(subiu), 'c2', 'cena').map((linha) => linha.mentions)).toEqual([[]])
  })

  it('na história também: quem volta recebe só a própria menção, na cena e no global', () => {
    const { s, resume } = mesa()
    fala(s, 'c1', 'cena', 'Oi @Dora e @mestre', ['Dora', 'mestre'])
    fala(s, 'c2', 'global', '@Ana e @Dora, venham', ['Ana', 'Dora'], 'r2')
    s.disconnect('c4')
    const dora = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Dora', resume: resume('Dora') }, mundo)
    expect(historicoDe(dora, 'c9', 'cena').map((linha) => linha.mentions)).toEqual([['Dora']])
    expect(historicoDe(dora, 'c9', 'global').map((linha) => linha.mentions)).toEqual([['Dora']])
    s.disconnect('c1')
    const ana = s.handleMessage('c8', { type: 'join', code: CODE, name: 'Ana', resume: resume('Ana') }, mundo)
    expect(historicoDe(ana, 'c8', 'cena').map((linha) => linha.mentions)).toEqual([[]])
    expect(historicoDe(ana, 'c8', 'global').map((linha) => linha.mentions)).toEqual([['Ana']])
  })

  it('jogador chamado "mestre" não é marcado pelo @mestre, que é do mestre', () => {
    const { s } = mesa()
    const entrou = s.handleMessage('c5', { type: 'join', code: CODE, name: 'mestre' }, comFoice)
    s.assignToken(idDoWelcome(entrou), 'foice')
    const r = fala(s, 'c1', 'global', '@mestre olha isto', ['mestre'], 'r1', comFoice)
    expect(linhaPara(r, 'c5').mentions).toEqual([])
  })

  it('só vale o @ que está no texto: declarada sem @, a própria, e @ no meio de palavra caem', () => {
    const { s } = mesa()
    const semArroba = fala(s, 'c1', 'global', 'Oi, @Ana aqui', ['Bruno', 'Ana'])
    expect(linhaPara(semArroba, 'c1').mentions).toEqual([])
    expect(linhaPara(semArroba, 'c2').mentions).toEqual([])
    expect(linhaPara(fala(s, 'c4', 'global', 'ana@Bruno.com e @Brunoca', ['Bruno'], 'r2'), 'c2').mentions).toEqual([])
    // Mencionada no texto mas não declarada: o cliente não quis marcar.
    expect(linhaPara(fala(s, 'c2', 'global', 'fala, @Ana', [], 'r3'), 'c1').mentions).toEqual([])
  })
})

describe('chat: rajada', () => {
  it('5 seguidas passam, a 6ª volta "too_soon" e não chega a ninguém; a cada 700 ms entra mais uma', () => {
    const { s, relogio } = mesa()
    for (let i = 1; i <= 5; i += 1) expect(resultadoDe(fala(s, 'c1', 'global', `msg ${i}`, [], `r${i}`))).toEqual({ ok: true })
    expect(fala(s, 'c1', 'global', 'msg 6', [], 'r6').outbound).toEqual([
      { clientId: 'c1', msg: { type: 'chat.send.result', reqId: 'r6', ok: false, reason: 'too_soon' } },
    ])
    relogio.agora += 699
    expect(resultadoDe(fala(s, 'c1', 'global', 'msg 7', [], 'r7')).ok).toBe(false)
    relogio.agora += 1
    expect(resultadoDe(fala(s, 'c1', 'global', 'msg 8', [], 'r8')).ok).toBe(true)
    expect(resultadoDe(fala(s, 'c1', 'global', 'msg 9', [], 'r9')).ok).toBe(false)
    // A espera é de quem fala: o colega não a herda.
    expect(resultadoDe(fala(s, 'c4', 'global', 'oi', [], 'r10')).ok).toBe(true)
    // Parado bastante tempo, a rajada volta inteira, e não mais que ela.
    relogio.agora += 60_000
    for (let i = 0; i < 5; i += 1) expect(resultadoDe(fala(s, 'c1', 'global', `de novo ${i}`, [], `s${i}`)).ok).toBe(true)
    expect(resultadoDe(fala(s, 'c1', 'global', 'sobrou', [], 'sx')).ok).toBe(false)
  })
})

/** Texto pelos códigos: invisível escrito direto no arquivo não se vê na revisão. */
function codigos(...pontos: number[]): string {
  return String.fromCharCode(...pontos)
}

describe('chat: texto', () => {
  it('bidi e controle saem, a quebra de linha fica, o tab vira espaço e as pontas são aparadas', () => {
    const { s } = mesa()
    const sujo = '  Oi\u202E mundo\u2066!\u0000\u0007\r\nlinha\u00852\tfim\u2069\u202A\u007F  '
    expect(linhaDe(fala(s, 'c1', 'global', sujo)).text).toBe('Oi mundo!\nlinha2 fim')
    expect(linhaDe(fala(s, 'c4', 'global', 'um\rdois\r\ntres', [], 'r2')).text).toBe('um\ndois\ntres')
  })

  it('caracteres invisíveis também saem: largura zero, BOM, marca árabe e separadores de linha', () => {
    const { s } = mesa()
    const invisivel = `A${codigos(0x200b)}n${codigos(0x200c)}a${codigos(0x200d)} ${codigos(0x200e)}o${codigos(0x200f)}i${codigos(0x2060)}!${codigos(0x2061, 0x2062, 0x2063, 0x2064, 0xfeff, 0x061c)} fim${codigos(0x2028)}de${codigos(0x2029)}tudo`
    expect(linhaDe(fala(s, 'c1', 'global', invisivel)).text).toBe('Ana oi! fimdetudo')
    // Só invisível é mensagem vazia: não chega a ninguém.
    expect(quemRecebe(fala(s, 'c1', 'global', codigos(0x200b, 0xfeff, 0x2060), [], 'r2'), 'chat.msg')).toEqual([])
  })

  it('o nome de quem entra passa pela mesma limpeza: sem invisível nem bidi, quebra de linha vira espaço, e só invisível não entra', () => {
    const { s } = mesa()
    const entrou = s.handleMessage('c5', { type: 'join', code: CODE, name: ` E${codigos(0x200b)}va${codigos(0x202e, 0x2060)} ` }, comFoice)
    expect(entrou.outbound[0]?.msg).toMatchObject({ type: 'welcome', name: 'Eva' })
    s.assignToken(idDoWelcome(entrou), 'foice')
    expect(linhaDe(fala(s, 'c5', 'global', 'cheguei', [], 'r1', comFoice)).from).toBe('Eva')
    expect(s.handleMessage('c6', { type: 'join', code: CODE, name: 'Zé\r\nMestre' }, comFoice).outbound[0]?.msg).toMatchObject({ type: 'welcome', name: 'Zé Mestre' })
    expect(s.handleMessage('c7', { type: 'join', code: CODE, name: codigos(0x200b, 0xfeff) }, comFoice).outbound).toEqual([
      { clientId: 'c7', msg: { type: 'error', reason: 'invalid_message' } },
    ])
  })

  it('nome que só difere por invisível, letra larga ou letra cirílica ou grega é o mesmo nome: quem chega depois ganha " (2)"', () => {
    const { s } = mesa()
    const nomeQueEntra = (clientId: string, name: string) => s.handleMessage(clientId, { type: 'join', code: CODE, name }, comFoice).outbound[0]?.msg
    // O hífen suave some na limpeza; a letra larga vira a comum.
    expect(nomeQueEntra('c5', 'Ana\u{00AD}')).toMatchObject({ type: 'welcome', name: 'Ana (2)' })
    expect(nomeQueEntra('c6', '\u{FF24}ora')).toMatchObject({ type: 'welcome', name: 'Dora (2)' })
    // Letra de outro alfabeto é letra de verdade: fica como foi digitada, mas conta como a latina que imita.
    expect(nomeQueEntra('c7', '\u{0412}runo')).toMatchObject({ type: 'welcome', name: '\u{0412}runo (2)' })
    expect(nomeQueEntra('c8', 'C\u{03B1}io')).toMatchObject({ type: 'welcome', name: 'C\u{03B1}io (2)' })
  })

  it('nome só de preenchimento invisível ou de branco do Braille não entra, nem o que a normalização estica além do teto', () => {
    const { s } = mesa()
    const recusado = (clientId: string) => [{ clientId, msg: { type: 'error', reason: 'invalid_message' } }]
    expect(s.handleMessage('c5', { type: 'join', code: CODE, name: '\u{3164}\u{115F}\u{FFA0}' }, comFoice).outbound).toEqual(recusado('c5'))
    expect(s.handleMessage('c6', { type: 'join', code: CODE, name: '\u{2800}\u{2800}' }, comFoice).outbound).toEqual(recusado('c6'))
    // Cada U+FDFA vira 18 letras na normalização: duas passam das 32 do nome.
    expect(s.handleMessage('c7', { type: 'join', code: CODE, name: '\u{FDFA}'.repeat(2) }, comFoice).outbound).toEqual(recusado('c7'))
  })

  it('chat.send torto de quem entrou, com reqId legível, volta como chat.send.result recusado: vazio depois de limpo, acima de 1000, canal desconhecido, campo torto', () => {
    const { s } = mesa()
    const recusado = (reqId: string) => [{ clientId: 'c1', msg: { type: 'chat.send.result', reqId, ok: false } }]
    expect(fala(s, 'c1', 'global', ' \u202E\u0000 \n ').outbound).toEqual(recusado('r1'))
    expect(fala(s, 'c1', 'global', 'x'.repeat(1001), [], 'r2').outbound).toEqual(recusado('r2'))
    for (const torto of [
      { type: 'chat.send', reqId: 'r3', channel: 'sala', text: 'oi', mentions: [] },
      { type: 'chat.send', reqId: 'r3', channel: 'global', text: 'oi' },
      { type: 'chat.send', reqId: 'r3', channel: 'global', text: 'oi', mentions: 'Bruno' },
      { type: 'chat.send', reqId: 'r3', channel: 'global', text: 42, mentions: [] },
      { type: 'chat.send', reqId: 'r3', channel: 'global', text: 'oi', mentions: [7] },
      { type: 'chat.send', reqId: 'r3', channel: 'global', text: 'oi', mentions: Array.from({ length: 40 }, () => 'Bruno') },
    ]) {
      expect(s.handleMessage('c1', torto, mundo).outbound).toEqual(recusado('r3'))
      // Pelo fio o pedido chega como a string JSON crua: a mesma resposta.
      expect(s.handleMessage('c1', JSON.stringify(torto), mundo).outbound).toEqual(recusado('r3'))
    }
    // Quem aguarda também recebe a recusa daquele envio, sem motivo.
    expect(s.handleMessage('c3', { type: 'chat.send', reqId: 'r5', channel: 'global', text: 42, mentions: [] }, mundo).outbound).toEqual([
      { clientId: 'c3', msg: { type: 'chat.send.result', reqId: 'r5', ok: false } },
    ])
    // No teto, passa inteiro.
    expect(linhaDe(fala(s, 'c1', 'global', 'x'.repeat(1000), [], 'r4')).text).toHaveLength(1000)
  })

  it('sem reqId legível, JSON quebrado, outro tipo torto ou conexão que não entrou: continua invalid_message', () => {
    const { s } = mesa()
    const invalido = (clientId: string) => [{ clientId, msg: { type: 'error', reason: 'invalid_message' } }]
    for (const torto of [
      { type: 'chat.send', reqId: '', channel: 'global', text: 'oi', mentions: [] },
      { type: 'chat.send', reqId: 'r'.repeat(65), channel: 'global', text: 'oi', mentions: [] },
      { type: 'chat.send', reqId: 7, channel: 'global', text: 'oi', mentions: [] },
      { type: 'chat.send', channel: 'global', text: 'oi', mentions: [] },
      { type: 'letter.send', reqId: 'r1' },
    ]) {
      expect(s.handleMessage('c1', torto, mundo).outbound).toEqual(invalido('c1'))
    }
    expect(s.handleMessage('c1', '{"type":"chat.send","reqId":"r1"', mundo).outbound).toEqual(invalido('c1'))
    // Quem nem entrou continua levando o erro que a ponte usa para derrubar a conexão.
    expect(s.handleMessage('c9', { type: 'chat.send', reqId: 'r1', channel: 'global', text: 42, mentions: [] }, mundo).outbound).toEqual(invalido('c9'))
  })
})

describe('chat: o mestre lê e fala (fatia D)', () => {
  it('o mestre lê o Global e cada cena com conversa, com o nome dela e as menções inteiras', () => {
    const { s } = mesa()
    expect(s.masterChat(mundo)).toEqual({ global: [], scenes: [] })
    const doSalao = fala(s, 'c1', 'cena', 'segredo do salão, @Dora', ['Dora'])
    expect(doSalao.chatChanged).toBe(true)
    fala(s, 'c2', 'cena', 'aqui embaixo está escuro')
    fala(s, 'c4', 'global', 'todos bem?', [], 'r2')
    const lido = s.masterChat(mundo)
    expect(lido.global.map((linha) => [linha.from, linha.text])).toEqual([['Dora', 'todos bem?']])
    expect(lido.scenes.map((cena) => [cena.key, cena.name, cena.messages.map((linha) => linha.text)])).toEqual([
      ['m-salao', 'Salao Norte', ['segredo do salão, @Dora']],
      ['m-cripta', 'Cripta Rubra', ['aqui embaixo está escuro']],
    ])
    // O mestre vê a quem a linha marcou; o jogador só fica sabendo da própria.
    expect(lido.scenes[0].messages[0].mentions).toEqual(['Dora'])
    // Cena que saiu da aventura: a conversa continua, sem nome.
    expect(s.masterChat({ open: salao([]), background: [] }).scenes[1]).toMatchObject({ key: 'm-cripta', name: null })
  })

  it('o que o mestre lê é cópia: mexer nela não muda a sessão', () => {
    const { s } = mesa()
    fala(s, 'c1', 'global', 'oi')
    const lido = s.masterChat(mundo)
    lido.global[0].mentions.push('mestre')
    lido.global.pop()
    expect(s.masterChat(mundo).global).toHaveLength(1)
    expect(s.masterChat(mundo).global[0].mentions).toEqual([])
  })

  it('@mestre fica marcado para o mestre, e só para ele', () => {
    const { s } = mesa()
    const r = fala(s, 'c1', 'cena', '@mestre posso abrir o baú?', ['mestre'])
    expect(s.masterChat(mundo).scenes[0].messages[0].mentions).toEqual(['mestre'])
    expect(linhaPara(r, 'c4').mentions).toEqual([])
  })

  it('a fala do mestre vai só ao Global, a todo jogador com ficha, com fromMaster e o nome Mestre', () => {
    const { s, relogio } = mesa()
    relogio.agora = 5000
    const r = s.masterChatSend('  Pausa de 5 minutos, @Bruno\r\n  ')
    expect(r.sent).toBe(true)
    expect(r.chatChanged).toBe(true)
    expect(quemRecebe(r, 'chat.msg')).toEqual(['c1', 'c2', 'c4'])
    expect(r.outbound.every((o) => o.msg.type !== 'chat.msg' || ('channel' in o.msg && o.msg.channel === 'global'))).toBe(true)
    expect(r.outbound.find((o) => o.clientId === 'c2' && o.msg.type === 'chat.msg')?.msg).toEqual({
      type: 'chat.msg',
      channel: 'global',
      msg: { id: expect.any(String), at: 5000, from: 'Mestre', text: 'Pausa de 5 minutos, @Bruno', mentions: ['Bruno'], fromMaster: true },
    })
    // Bruno foi marcado; Ana não fica sabendo de quem foi.
    expect(linhaPara(r, 'c1').mentions).toEqual([])
    semCena(r)
    expect(s.masterChat(mundo).global.map((linha) => [linha.from, linha.fromMaster])).toEqual([['Mestre', true]])
    // Quem chega depois recebe a fala do mestre na história do global, ainda marcada.
    const ganhou = s.assignToken(idDoWelcome(s.handleMessage('c5', { type: 'join', code: CODE, name: 'Eva' }, mundo)), 'foice')
    const depois = s.broadcast(comFoice)
    const historia = [...ganhou.outbound, ...depois.outbound].find((o) => o.clientId === 'c5' && o.msg.type === 'chat.history' && 'channel' in o.msg && o.msg.channel === 'global')?.msg
    expect(JSON.stringify(historia)).toContain('"fromMaster":true')
  })

  it('o mestre não fala vazio nem acima do teto, e sem ritmo de jogador', () => {
    const { s } = mesa()
    expect(s.masterChatSend('   ‮  ')).toEqual({ outbound: [], sent: false })
    expect(s.masterChatSend('x'.repeat(1001))).toEqual({ outbound: [], sent: false })
    for (let i = 0; i < 12; i += 1) expect(s.masterChatSend(`aviso ${i}`).sent).toBe(true)
    expect(s.masterChat(mundo).global).toHaveLength(12)
  })

  it('um jogador chamado Mestre não se passa pelo mestre: a linha dele não tem fromMaster', () => {
    const { s } = mesa()
    const id = idDoWelcome(s.handleMessage('c6', { type: 'join', code: CODE, name: 'Mestre' }, mundo))
    s.assignToken(id, 'foice')
    s.broadcast(comFoice)
    const r = fala(s, 'c6', 'global', 'sou eu, o mestre', [], 'r1', comFoice)
    const linhas = r.outbound.filter((o) => o.msg.type === 'chat.msg')
    expect(linhas.length).toBeGreaterThan(0)
    expect(JSON.stringify(linhas)).not.toContain('fromMaster')
    expect(s.masterChat(comFoice).global[0]).not.toHaveProperty('fromMaster')
  })
})
