/**
 * COLEÇÃO DE PISTAS no host: o pino que é "peça 2 de 3 do Letreiro" entra no
 * caderno do jogador como pista e soma na coleção DELE. O jogador recebe o
 * nome da coleção, o total e as peças que tem — nunca onde estão as que
 * faltam (cena, pino, posição) e nunca a frase inteira antes de juntar todas.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { parseColecoesMessage, type HostMessage } from './protocol'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const AGORA = new Date(2026, 8, 24, 20, 0).getTime()
const FRASE = 'A BOCA ABRE NA MARE DA LUA'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function peca(id: string, x: number, y: number, parte: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: `Letra ${parte}`, image: null, colecao: { nome: 'Letreiro', parte, total: 3, inteira: parte === 1 ? FRASE : undefined }, ...extra }
}

/** Casa Velha (aberta): Gabi e Ana; as peças 1, 2 e 3 perto delas, uma peça secreta e uma escondida. */
function casa(): HostScene {
  const base = createEmptyMap('m-casa', 'Casa Velha', 30, 10, 50)
  const map: MapData = {
    ...base,
    tokens: [ficha('gabi', 100, 100), ficha('ana', 200, 100)],
    pins: [
      peca('peca-1', 150, 150, 1),
      peca('peca-2', 160, 120, 2),
      peca('peca-3', 180, 140, 3),
      { id: 'comum', x: 140, y: 140, kind: 'exclamacao', description: 'Bilhete comum', image: null },
      { id: 'secreta', x: 170, y: 170, kind: 'exclamacao', description: 'Peca secreta', image: null, secret: true, colecao: { nome: 'Cofre-Oculto', parte: 1, total: 2, inteira: 'SEGREDO-DO-COFRE' } },
    ],
  }
  return { sceneId: 's-casa', name: 'Casa Velha', map }
}

/** Porão Úmido (fundo): Bruno, com a peça 2 de outra coleção que só existe lá. */
function porao(): HostScene {
  const base = createEmptyMap('m-porao', 'Porao Umido', 30, 10, 50)
  const pins: Pin[] = [{ id: 'porao-peca', x: 150, y: 150, kind: 'exclamacao', description: 'Pedaco do mapa', image: null, colecao: { nome: 'Mapa-de-Drenagem', parte: 2, total: 12, inteira: 'DRENO-INTEIRO' } }]
  return { sceneId: 's-porao', name: 'Porao Umido', map: { ...base, tokens: [ficha('bruno', 100, 100)], pins } }
}

type Sessao = ReturnType<typeof createHostSession>

function entra(s: Sessao, clientId: string, name: string, world: HostWorld, resume?: string): { playerId: string; resume: string; r: HostResult } {
  const join = resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }
  const r = s.handleMessage(clientId, join, world)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return { playerId: welcome.playerId, resume: welcome.resumeToken, r }
}

function mesa() {
  let n = 0
  const world: HostWorld = { open: casa(), background: [porao()] }
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => AGORA, randomId: () => `id-${(n += 1)}` })
  const gabi = entra(s, 'c-gabi', 'Gabi', world)
  const ana = entra(s, 'c-ana', 'Ana', world)
  const bruno = entra(s, 'c-bruno', 'Bruno', world)
  s.assignToken(gabi.playerId, 'gabi')
  s.assignToken(ana.playerId, 'ana')
  s.assignToken(bruno.playerId, 'bruno')
  const primeiro = s.broadcast(world)
  return { s, world, gabi, ana, bruno, primeiro }
}

function msgsPara(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function colecoesDe(r: HostResult, clientId: string) {
  const msg = msgsPara(r, clientId).find((m) => m.type === 'colecoes')
  if (msg?.type !== 'colecoes') throw new Error('esperava colecoes')
  return msg.colecoes
}

function le(s: Sessao, world: HostWorld, clientId: string, pinId: string): HostResult {
  return s.handleMessage(clientId, { type: 'clue.read', pinId }, world)
}

describe('Coleção de pistas — o recorte nunca leva a coleção do pino', () => {
  it('o snapshot de todos sai sem nome de coleção, parte, total ou frase inteira', () => {
    const { primeiro } = mesa()
    const json = JSON.stringify(primeiro.outbound)
    expect(json).toContain('Letra 1')
    for (const vazamento of ['colecao', 'Letreiro', FRASE, 'Cofre-Oculto', 'SEGREDO-DO-COFRE', 'Mapa-de-Drenagem', 'DRENO-INTEIRO']) expect(json).not.toContain(vazamento)
  })
})

describe('Coleção de pistas — ler uma peça soma na coleção de quem leu', () => {
  it('Gabi lê a peça 1: pista no caderno e "Letreiro 1 de 3", sem frase, cena, pino ou posição', () => {
    const { s, world } = mesa()
    const r = le(s, world, 'c-gabi', 'peca-1')
    const [pista, colecoes] = msgsPara(r, 'c-gabi')
    expect(pista?.type).toBe('clue.added')
    const clueId = pista?.type === 'clue.added' ? pista.clue.id : ''
    expect(colecoes).toEqual({ type: 'colecoes', colecoes: [{ nome: 'Letreiro', total: 3, partes: [{ parte: 1, clueId }], completa: false }] })
    expect(msgsPara(r, 'c-ana')).toEqual([])
    expect(msgsPara(r, 'c-bruno')).toEqual([])
    const json = JSON.stringify(r.outbound)
    for (const vazamento of [FRASE, 'Casa Velha', 's-casa', 'm-casa', '"peca-1"', '"peca-2"', '"x"', '"y"']) expect(json).not.toContain(vazamento)
  })

  it('com 2 de 3 a frase ainda não chega; a terceira peça fecha a coleção e traz a frase inteira', () => {
    const { s, world } = mesa()
    le(s, world, 'c-gabi', 'peca-1')
    const duas = le(s, world, 'c-gabi', 'peca-2')
    expect(colecoesDe(duas, 'c-gabi')[0]?.partes.map((p) => p.parte)).toEqual([1, 2])
    expect(colecoesDe(duas, 'c-gabi')[0]?.completa).toBe(false)
    expect(JSON.stringify(duas.outbound)).not.toContain(FRASE)
    const todas = le(s, world, 'c-gabi', 'peca-3')
    const [letreiro] = colecoesDe(todas, 'c-gabi')
    expect(letreiro?.completa).toBe(true)
    expect(letreiro?.inteira).toBe(FRASE)
    expect(letreiro?.partes.map((p) => p.parte)).toEqual([1, 2, 3])
  })

  it('reler a mesma peça não repete a coleção; pino comum não manda coleção nenhuma', () => {
    const { s, world } = mesa()
    le(s, world, 'c-gabi', 'peca-1')
    expect(msgsPara(le(s, world, 'c-gabi', 'peca-1'), 'c-gabi').map((m) => m.type)).toEqual(['clue.added'])
    expect(msgsPara(le(s, world, 'c-gabi', 'comum'), 'c-gabi').map((m) => m.type)).toEqual(['clue.added'])
  })

  it('peça secreta e peça de outra cena não somam, nem pelo nome da coleção', () => {
    const { s, world, gabi } = mesa()
    expect(le(s, world, 'c-gabi', 'secreta').outbound).toEqual([])
    expect(le(s, world, 'c-gabi', 'porao-peca').outbound).toEqual([])
    s.disconnect('c-gabi')
    const volta = entra(s, 'c-gabi-2', 'Gabi', world, gabi.resume).r
    expect(volta.outbound.some((o) => o.msg.type === 'colecoes')).toBe(false)
    const json = JSON.stringify(volta.outbound)
    for (const vazamento of ['Cofre-Oculto', 'SEGREDO-DO-COFRE', 'Mapa-de-Drenagem', 'DRENO-INTEIRO']) expect(json).not.toContain(vazamento)
  })
})

describe('Coleção de pistas — juntar entre colegas e voltar à sala', () => {
  it('Gabi mostra a peça 2 à Ana: a peça soma na coleção da Ana, que passa a 2 de 3', () => {
    const { s, world } = mesa()
    le(s, world, 'c-ana', 'peca-1')
    const lida = msgsPara(le(s, world, 'c-gabi', 'peca-2'), 'c-gabi').find((m) => m.type === 'clue.added')
    const clueId = lida?.type === 'clue.added' ? lida.clue.id : ''
    const r = s.handleMessage('c-gabi', { type: 'clue.show', clueId, to: 'Ana' }, world)
    expect(msgsPara(r, 'c-ana').map((m) => m.type)).toEqual(['clue.shown', 'colecoes'])
    expect(colecoesDe(r, 'c-ana')[0]?.partes.map((p) => p.parte)).toEqual([1, 2])
    expect(JSON.stringify(r.outbound)).not.toContain(FRASE)
  })

  it('quem volta à sala recebe a coleção dele de novo, depois do caderno; o kick apaga', () => {
    const { s, world, gabi } = mesa()
    le(s, world, 'c-gabi', 'peca-1')
    s.disconnect('c-gabi')
    const volta = entra(s, 'c-gabi-2', 'Gabi', world, gabi.resume)
    const tipos = msgsPara(volta.r, 'c-gabi-2').map((m) => m.type)
    expect(tipos.indexOf('colecoes')).toBeGreaterThan(tipos.indexOf('clues.book'))
    expect(colecoesDe(volta.r, 'c-gabi-2')[0]?.nome).toBe('Letreiro')
    s.kick('c-gabi-2')
    const nova = entra(s, 'c-gabi-3', 'Gabi', world)
    expect(msgsPara(nova.r, 'c-gabi-3').some((m) => m.type === 'colecoes')).toBe(false)
  })
})

describe('Coleção de pistas — o jogador confere o que chega', () => {
  it('forma certa passa; a frase inteira numa coleção incompleta é descartada', () => {
    const ok = parseColecoesMessage({ type: 'colecoes', colecoes: [{ nome: 'Letreiro', total: 3, partes: [{ parte: 1, clueId: 'c1' }], completa: false, inteira: 'VAZOU', cena: 's-casa' }] })
    expect(ok).toEqual({ type: 'colecoes', colecoes: [{ nome: 'Letreiro', total: 3, partes: [{ parte: 1, clueId: 'c1' }], completa: false }] })
  })

  it('peça fora do total, total acima do teto ou nome vazio recusam a mensagem inteira', () => {
    expect(parseColecoesMessage({ type: 'colecoes', colecoes: [{ nome: 'L', total: 3, partes: [{ parte: 4, clueId: 'c' }], completa: false }] })).toBeNull()
    expect(parseColecoesMessage({ type: 'colecoes', colecoes: [{ nome: 'L', total: 9999, partes: [], completa: false }] })).toBeNull()
    expect(parseColecoesMessage({ type: 'colecoes', colecoes: [{ nome: '', total: 3, partes: [], completa: false }] })).toBeNull()
    expect(parseColecoesMessage({ type: 'colecoes' })).toBeNull()
  })
})
