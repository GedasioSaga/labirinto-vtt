/**
 * ABALO POR DISTÂNCIA no host: o mestre marca de onde veio o evento (cena e
 * ponto) e escreve um texto por faixa. Cada jogador recebe SÓ o texto da faixa
 * dele; quem está na cena da origem recebe também a seta (a partir da PRÓPRIA
 * ficha) e o "forte" que faz o aparelho vibrar. Nunca viaja: o ponto de origem,
 * o id ou o nome de cena, nem o texto de outra faixa.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { NOTE_MAX_LENGTH } from './protocol'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 20, 50), tokens }
}

const TEXTOS = { perto: 'PERTO: o teto treme sobre voces', andar: 'MEIO: um tranco abafado', longe: 'LONGE: um ronco distante' }

/** Origem no Andar Dois (Ana e Eva lá), Andar Um vizinho (Bruno), Vila longe (Caio). */
function mundoCom(evaExtra: Partial<Token> = {}): HostWorld {
  const andar2: HostScene = {
    sceneId: 'andar-2',
    name: 'Andar Dois Secreto',
    map: mapa('m-andar-2', 'Andar Dois Secreto', [ficha('f-ana', 100, 500), ficha('f-eva', 500, 100, evaExtra)]),
  }
  const andar1: HostScene = { sceneId: 'andar-1', name: 'Andar Um', map: mapa('m-andar-1', 'Andar Um', [ficha('f-bruno', 100, 100)]) }
  const vila: HostScene = { sceneId: 'vila', name: 'Vila Longinqua', map: mapa('m-vila', 'Vila Longinqua', [ficha('f-caio', 100, 100)]) }
  return { open: andar1, background: [andar2, vila] }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, mundo: HostWorld) {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome
}

function mesa(mundo: HostWorld = mundoCom()) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 42, randomId: () => `id-${(n += 1)}` })
  const ana = entra(s, 'c-ana', 'Ana', mundo)
  const bruno = entra(s, 'c-bruno', 'Bruno', mundo)
  const caio = entra(s, 'c-caio', 'Caio', mundo)
  const eva = entra(s, 'c-eva', 'Eva', mundo)
  entra(s, 'c-dora', 'Dora', mundo) // sem ficha: aguarda
  s.assignToken(ana.playerId, 'f-ana')
  s.assignToken(bruno.playerId, 'f-bruno')
  s.assignToken(caio.playerId, 'f-caio')
  s.assignToken(eva.playerId, 'f-eva')
  return { s, ana }
}

function para(r: HostResult, clientId: string) {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

describe('abalo (estrondo com texto por distância)', () => {
  it('cada jogador recebe só o texto da faixa dele', () => {
    const mundo = mundoCom()
    const { s } = mesa(mundo)
    const r = s.abalo({ sceneId: 'andar-2', x: 100, y: 100 }, TEXTOS, ['andar-1'], mundo)

    expect(para(r, 'c-ana')).toEqual([{ type: 'abalo', id: expect.any(String), text: TEXTOS.perto, at: 42, forte: true, seta: 'n' }])
    expect(para(r, 'c-bruno')).toEqual([{ type: 'abalo', id: expect.any(String), text: TEXTOS.andar, at: 42, forte: false }])
    expect(para(r, 'c-caio')).toEqual([{ type: 'abalo', id: expect.any(String), text: TEXTOS.longe, at: 42, forte: false }])
    // Quem aguarda não tem cena: não ouve nada.
    expect(para(r, 'c-dora')).toEqual([])

    // O texto de uma faixa nunca chega a quem está em outra.
    const bruno = JSON.stringify(para(r, 'c-bruno'))
    expect(bruno).not.toContain('PERTO')
    expect(bruno).not.toContain('LONGE')
    const caio = JSON.stringify(para(r, 'c-caio'))
    expect(caio).not.toContain('PERTO')
    expect(caio).not.toContain('MEIO')
    expect(r.porFaixa).toEqual({ perto: 2, andar: 1, longe: 1 })
  })

  it('a seta sai da PRÓPRIA ficha de cada um: dois jogadores na mesma cena, rumos diferentes', () => {
    const mundo = mundoCom()
    const { s } = mesa(mundo)
    const r = s.abalo({ sceneId: 'andar-2', x: 100, y: 100 }, TEXTOS, [], mundo)
    // Ana está em (100, 500): a origem está acima dela. Eva está em (500, 100): a origem está à esquerda.
    expect(para(r, 'c-ana')[0]).toMatchObject({ seta: 'n' })
    expect(para(r, 'c-eva')[0]).toMatchObject({ seta: 'o' })
  })

  it('nunca leva o ponto de origem, o id nem o nome de cena', () => {
    const mundo = mundoCom()
    const { s } = mesa(mundo)
    const r = s.abalo({ sceneId: 'andar-2', x: 123, y: 456 }, TEXTOS, ['andar-1'], mundo)
    expect(r.outbound.length).toBe(4)
    const fio = JSON.stringify(r.outbound.map((o) => o.msg))
    for (const segredo of ['andar-2', 'andar-1', 'vila', 'Andar Dois Secreto', 'Vila Longinqua', '123', '456', '"x"', '"y"', 'sceneId']) {
      expect(fio).not.toContain(segredo)
    }
  })

  it('ficha escondida pelo mestre não dá seta: o jogador nem a tem no mapa dele', () => {
    const mundo = mundoCom({ hidden: true })
    const { s } = mesa(mundo)
    const r = s.abalo({ sceneId: 'andar-2', x: 100, y: 100 }, TEXTOS, [], mundo)
    const eva = para(r, 'c-eva')
    expect(eva).toEqual([{ type: 'abalo', id: expect.any(String), text: TEXTOS.perto, at: 42, forte: true }])
  })

  it('sem ponto de origem: perto vibra, mas sem seta', () => {
    const mundo = mundoCom()
    const { s } = mesa(mundo)
    const r = s.abalo({ sceneId: 'andar-2' }, TEXTOS, [], mundo)
    expect(para(r, 'c-ana')).toEqual([{ type: 'abalo', id: expect.any(String), text: TEXTOS.perto, at: 42, forte: true }])
  })

  it('faixa com texto vazio não manda nada a quem está nela; tudo vazio não manda nada', () => {
    const mundo = mundoCom()
    const { s } = mesa(mundo)
    const r = s.abalo({ sceneId: 'andar-2', x: 1, y: 1 }, { perto: 'so perto', andar: '   ', longe: '' }, ['andar-1'], mundo)
    expect(r.outbound.map((o) => o.clientId).sort()).toEqual(['c-ana', 'c-eva'])
    expect(r.porFaixa).toEqual({ perto: 2, andar: 0, longe: 0 })
    expect(s.abalo({ sceneId: 'andar-2' }, { perto: '', andar: '', longe: ' ' }, [], mundo).outbound).toEqual([])
  })

  it('texto acima do teto sai cortado', () => {
    const mundo = mundoCom()
    const { s } = mesa(mundo)
    const r = s.abalo({ sceneId: 'andar-2' }, { ...TEXTOS, perto: 'x'.repeat(NOTE_MAX_LENGTH + 30) }, [], mundo)
    const msg = para(r, 'c-ana')[0]
    expect(msg?.type === 'abalo' ? msg.text.length : -1).toBe(NOTE_MAX_LENGTH)
  })

  it('quem caiu não recebe na hora, e o abalo fica no caderno de quem recebeu', () => {
    const mundo = mundoCom()
    const { s, ana } = mesa(mundo)
    s.disconnect('c-eva')
    const r = s.abalo({ sceneId: 'andar-2' }, TEXTOS, [], mundo)
    expect(para(r, 'c-eva')).toEqual([])
    // Ana recarrega a página: o caderno dela traz o abalo.
    s.disconnect('c-ana')
    const volta = s.handleMessage('c-ana-2', { type: 'join', code: CODE, name: 'Ana', resume: ana.resumeToken }, mundo)
    const book = volta.outbound.find((o) => o.msg.type === 'notes.book')?.msg
    expect(book?.type === 'notes.book' ? book.notes.map((n) => n.text) : []).toEqual([TEXTOS.perto])
  })

  it('mapa solto: todo mundo que joga está na cena da origem', () => {
    const solto = mapa('m-solto', 'Solto', [ficha('f-ana', 100, 500)])
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1, randomId: () => `id-${(n += 1)}` })
    const r1 = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, solto)
    const w = r1.outbound[0]?.msg
    if (w?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(w.playerId, 'f-ana')
    const r = s.abalo({ sceneId: null, x: 900, y: 500 }, TEXTOS, [], solto)
    expect(para(r, 'c1')).toEqual([{ type: 'abalo', id: expect.any(String), text: TEXTOS.perto, at: 1, forte: true, seta: 'l' }])
  })
})
