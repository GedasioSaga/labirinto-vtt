/**
 * VOLTAR É A MESMA PESSOA, lado do host.
 *
 * - Ana cai e alguém entra com o nome dela ("ana", outro aparelho): o host NÃO
 *   decide sozinho. Entra como "Ana (2)", sem nada da Ana, e o mestre recebe a
 *   pergunta (`returnCandidate`) — que nunca vai pela rede.
 * - "É ela" (`confirmReturn`): a conexão nova vira a Ana de antes — fichas,
 *   explorado e raio vêm junto, e fica uma Ana só.
 * - "Outra pessoa" (`denyReturn`): nada muda, e a Ana (2) nunca recebe nada
 *   da Ana.
 * - Aba nova do MESMO aparelho entra pelo resume: a aba velha recebe
 *   `session.replaced` e deixa de receber o mapa.
 * - "Dispensar" (`dismissPlayer`): tira quem foi embora da lista.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

const HALL: HostScene = { sceneId: 's-hall', name: 'Hall de Entrada', map: mapa('m-hall', 'Hall de Entrada', [ficha('lirio', 100, 100), ficha('escudo', 300, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 777, 333)]) }
const mundo: HostWorld = { open: HALL, background: [CRIPTA] }

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 5_000, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, resume?: string) => {
    const r = s.handleMessage(clientId, resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, resumeToken: welcome.resumeToken, name: welcome.name, result: r }
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  s.assignToken(ana.playerId, 'lirio')
  s.assignToken(bruno.playerId, 'machado')
  s.setVisionRadius(ana.playerId, 400)
  // O mestre revelou a planta do Hall à Ana: o canto longe dela (1400, 450),
  // fora do raio, só fica marcado por essa memória — é o "explorado" dela.
  s.revealPlan(ana.playerId, mundo)
  s.broadcast(mundo)
  return { s, ana, bruno, entra }
}

/** Tudo o que saiu pela rede para `clientId`, como texto (o que o aparelho leria). */
function wireFor(result: HostResult, clientId: string): string {
  return JSON.stringify(result.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg))
}

describe('hostSession: nome igual ao de quem caiu vira pergunta ao mestre', () => {
  it('"ana" noutro aparelho com a Ana fora: entra como "Ana (2)", sem nada da Ana, e o mestre é perguntado', () => {
    const m = mesa()
    m.s.disconnect('c1')
    const nova = m.entra('c9', 'ana')
    expect(nova.name).toBe('ana (2)')
    expect(nova.playerId).not.toBe(m.ana.playerId)
    // A pergunta é do mestre: vem no resultado, com quem era.
    expect(nova.result.returnCandidate).toEqual({ playerId: nova.playerId, previousId: m.ana.playerId, name: 'Ana' })
    // Nada da Ana chega ao aparelho novo antes do "É ela": nem o id, nem o resume, nem a cena, nem a ficha.
    const wire = wireFor(nova.result, 'c9')
    expect(wire).not.toContain(m.ana.playerId)
    expect(wire).not.toContain(m.ana.resumeToken)
    expect(wire).not.toContain('Hall de Entrada')
    expect(wire).not.toContain('lirio')
    expect(nova.result.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    // E a pergunta nunca vai pela rede.
    expect(JSON.stringify(nova.result.outbound)).not.toContain('returnCandidate')
    expect(m.s.isReturnPending(nova.playerId)).toBe(true)
  })

  it('com a Ana conectada, outra "ana" é outra pessoa: sem pergunta', () => {
    const m = mesa()
    const nova = m.entra('c9', 'ana')
    expect(nova.name).toBe('ana (2)')
    expect(nova.result.returnCandidate).toBeUndefined()
    expect(m.s.isReturnPending(nova.playerId)).toBe(false)
  })

  it('"É ela": a conexão nova vira a Ana de antes, com ficha, explorado e raio; fica uma Ana só', () => {
    const m = mesa()
    m.s.disconnect('c1')
    const nova = m.entra('c9', 'ana')
    const r = m.s.confirmReturn(nova.playerId, m.ana.playerId, mundo)
    const tipos = r.outbound.filter((o) => o.clientId === 'c9').map((o) => o.msg.type)
    expect(tipos.slice(0, 2)).toEqual(['welcome', 'snapshot'])
    const welcome = r.outbound[0]?.msg
    expect(welcome).toEqual({ type: 'welcome', playerId: m.ana.playerId, resumeToken: m.ana.resumeToken, name: 'Ana' })
    const snapshot = r.outbound[1]?.msg
    if (snapshot?.type !== 'snapshot') throw new Error('esperava snapshot')
    expect(snapshot.ownTokens).toEqual(['lirio'])
    // O explorado da Ana veio junto: o canto que só a memória dela marcava.
    const explorado = decodeExploration(snapshot.explored)
    if (explorado === null) throw new Error('explorado ilegível')
    expect(isPointExplored(explorado, { x: 1400, y: 450 })).toBe(true)
    const lista = m.s.listPlayers(mundo)
    expect(lista.map((p) => p.name)).toEqual(['Ana', 'Bruno'])
    expect(lista[0]).toMatchObject({ playerId: m.ana.playerId, clientId: 'c9', connected: true, visionRadius: 400, tokenIds: ['lirio'] })
    expect(m.s.isReturnPending(nova.playerId)).toBe(false)
    // O que o Bruno esconde (a ficha dele na Cripta) continua sem chegar.
    expect(wireFor(r, 'c9')).not.toContain('machado')
    expect(wireFor(r, 'c9')).not.toContain('Cripta Rubra')
  })

  it('pedido de ação no ponto feito antes da queda: depois do "É ela", a resposta do mestre chega ao aparelho novo', () => {
    const m = mesa()
    const pedido = m.s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo).pointAction
    if (pedido === undefined) throw new Error('esperava o pedido da Ana')
    m.s.disconnect('c1')
    const nova = m.entra('c9', 'ana')
    // A "ana (2)" ainda não é a Ana: pedido dela é recusado em silêncio (está no lobby).
    const antes = m.s.handleMessage('c9', { type: 'point.action', action: 'escutar', x: 120, y: 130 }, mundo)
    expect(antes.pointAction).toBeUndefined()
    m.s.confirmReturn(nova.playerId, m.ana.playerId, mundo)
    expect(m.s.isPointActionPending(pedido.requestId)).toBe(true)
    expect(m.s.answerPointAction(pedido.requestId, 'nothing').outbound).toEqual([
      { clientId: 'c9', msg: { type: 'point.action.answer', action: 'procurar', answer: 'nothing' } },
    ])
  })

  it('"Outra pessoa": nada chega a ninguém e as duas ficam', () => {
    const m = mesa()
    m.s.disconnect('c1')
    const nova = m.entra('c9', 'ana')
    m.s.denyReturn(nova.playerId)
    expect(m.s.isReturnPending(nova.playerId)).toBe(false)
    expect(m.s.listPlayers(mundo).map((p) => p.name)).toEqual(['Ana', 'Bruno', 'ana (2)'])
    // Depois do "Outra pessoa", o "É ela" atrasado não junta nada.
    const tarde = m.s.confirmReturn(nova.playerId, m.ana.playerId, mundo)
    expect(tarde.outbound).toEqual([])
    expect(m.s.listPlayers(mundo)).toHaveLength(3)
  })

  it('a Ana volta pelo resume antes do mestre responder: o "É ela" já não junta nada', () => {
    const m = mesa()
    m.s.disconnect('c1')
    const nova = m.entra('c9', 'ana')
    m.entra('c3', 'Ana', m.ana.resumeToken)
    expect(m.s.isReturnPending(nova.playerId)).toBe(false)
    const tarde = m.s.confirmReturn(nova.playerId, m.ana.playerId, mundo)
    expect(tarde.outbound).toEqual([])
    expect(m.s.listPlayers(mundo)).toHaveLength(3)
  })
})

describe('hostSession: aba nova do mesmo aparelho', () => {
  it('entra pelo resume como a mesma Ana; a aba velha recebe session.replaced e sai do broadcast', () => {
    const m = mesa()
    const outra = m.entra('c7', 'Ana', m.ana.resumeToken)
    expect(outra.playerId).toBe(m.ana.playerId)
    expect(outra.name).toBe('Ana')
    expect(outra.result.replacedClientId).toBe('c1')
    expect(outra.result.outbound).toContainEqual({ clientId: 'c1', msg: { type: 'session.replaced' } })
    // A aba velha não recebe nada além do aviso: nem o mapa, nem a ficha.
    expect(wireFor(outra.result, 'c1')).toBe(JSON.stringify([{ type: 'session.replaced' }]))
    // A aba nova já recebe o mapa na entrada.
    expect(outra.result.outbound.some((o) => o.clientId === 'c7' && o.msg.type === 'snapshot')).toBe(true)
    // O broadcast só manda o que mudou: o escudo, que a Ana vê, anda — só a aba nova recebe.
    const mexeu: HostWorld = { ...mundo, open: { ...HALL, map: { ...HALL.map, tokens: HALL.map.tokens.map((t) => (t.id === 'escudo' ? { ...t, x: 250 } : t)) } } }
    const depois = m.s.broadcast(mexeu)
    expect(depois.outbound.some((o) => o.clientId === 'c1')).toBe(false)
    expect(depois.outbound.some((o) => o.clientId === 'c7' && o.msg.type === 'snapshot')).toBe(true)
    expect(m.s.listPlayers(mundo).filter((p) => p.name.startsWith('Ana'))).toHaveLength(1)
  })

  it('resume depois de uma queda (sem aba velha viva) não manda session.replaced', () => {
    const m = mesa()
    m.s.disconnect('c1')
    const volta = m.entra('c7', 'Ana', m.ana.resumeToken)
    expect(volta.result.replacedClientId).toBeUndefined()
    expect(volta.result.outbound.some((o) => o.msg.type === 'session.replaced')).toBe(false)
    expect(volta.result.outbound.map((o) => o.clientId)).toContain('c7')
  })
})

describe('hostSession: Dispensar quem foi embora', () => {
  it('tira da lista quem está fora; o resume dele deixa de valer', () => {
    const m = mesa()
    m.s.disconnect('c1')
    expect(m.s.dismissPlayer(m.ana.playerId)).toBe(true)
    expect(m.s.listPlayers(mundo).map((p) => p.name)).toEqual(['Bruno'])
    // O resume velho não ressuscita a Ana: entra alguém novo, sem ficha.
    const volta = m.entra('c7', 'Ana', m.ana.resumeToken)
    expect(volta.playerId).not.toBe(m.ana.playerId)
    expect(volta.result.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
  })

  it('o pedido de ação no ponto de quem é dispensado morre junto: "Nada aqui" não vai a ninguém', () => {
    const m = mesa()
    const pedido = m.s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo).pointAction
    if (pedido === undefined) throw new Error('esperava o pedido da Ana')
    m.s.disconnect('c1')
    // A queda não apaga o pedido (o mestre ainda quer ler "Ana quer Procurar")…
    expect(m.s.isPointActionPending(pedido.requestId)).toBe(true)
    // …mas o Dispensar esquece a Ana inteira, pedido incluído.
    expect(m.s.dismissPlayer(m.ana.playerId)).toBe(true)
    expect(m.s.isPointActionPending(pedido.requestId)).toBe(false)
    expect(m.s.answerPointAction(pedido.requestId, 'nothing')).toEqual({ outbound: [] })
  })

  it('quem está conectado não é dispensado (isso é o Expulsar)', () => {
    const m = mesa()
    expect(m.s.dismissPlayer(m.ana.playerId)).toBe(false)
    expect(m.s.listPlayers(mundo)).toHaveLength(2)
  })
})
