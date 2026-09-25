/**
 * RECADO PARA QUEM ESTÁ FORA no host: o recado mandado a uma cena enquanto um
 * jogador dela está fora do ar fica guardado para ELE e chega todo, em ordem,
 * na volta (`notes.away`), não só o último da cena. Quem está em outra cena,
 * quem aguarda sem ficha e quem estava conectado não entram na fila; a fila
 * nunca leva id nem nome de cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { AWAY_NOTES_MAX, type HostMessage } from './protocol'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
/** 20:30 do dia 24/09/2026 no relógio do mestre. */
const VINTE_E_MEIA = new Date(2026, 8, 24, 20, 30).getTime()
const UM_MINUTO = 60_000

function ficha(id: string): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: 100, y: 100, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

function cena(sceneId: string, nome: string, mapId: string, tokens: Token[]): HostScene {
  return { sceneId, name: nome, map: mapa(mapId, nome, tokens) }
}

/** Vila (aberta no editor) com Fábio; Prisão com Bruno; Mercado com Diego. `brunoNoMercado`: o mestre levou Bruno. */
function mundo(brunoNoMercado = false): HostWorld {
  return {
    open: cena('s-vila', 'Vila Alta', 'm-vila', [ficha('fabio')]),
    background: [
      cena('s-prisao', 'Prisao Velha', 'm-prisao', brunoNoMercado ? [] : [ficha('bruno')]),
      cena('s-mercado', 'Mercado Negro', 'm-mercado', brunoNoMercado ? [ficha('diego'), ficha('bruno')] : [ficha('diego')]),
    ],
  }
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
  let agora = VINTE_E_MEIA
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => agora, randomId: () => `id-${(n += 1)}` })
  const w = mundo()
  const fabio = entra(s, 'c-fabio', 'Fabio', w)
  const bruno = entra(s, 'c-bruno', 'Bruno', w)
  const diego = entra(s, 'c-diego', 'Diego', w)
  s.assignToken(fabio.playerId, 'fabio')
  s.assignToken(bruno.playerId, 'bruno')
  s.assignToken(diego.playerId, 'diego')
  s.broadcast(w)
  return { s, fabio, bruno, diego, relogio: (ms: number) => (agora = ms) }
}

function msgsPara(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function foraDoAr(r: HostResult, clientId: string): HostMessage | undefined {
  return msgsPara(r, clientId).find((m) => m.type === 'notes.away')
}

describe('recado para quem está fora (host)', () => {
  it('dois recados com Bruno fora do ar: na volta chegam os dois, em ordem, com a hora do mestre', () => {
    const { s, bruno, relogio } = mesa()
    s.disconnect('c-bruno')
    s.sceneNote('s-prisao', 'a guarda troca à meia-noite', mundo())
    relogio(VINTE_E_MEIA + UM_MINUTO)
    s.sceneNote('s-prisao', 'a chave está no balde', mundo())

    const volta = entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r
    expect(foraDoAr(volta, 'c-bruno-2')).toEqual({
      type: 'notes.away',
      notes: [
        { id: expect.any(String), text: 'a guarda troca à meia-noite', at: VINTE_E_MEIA },
        { id: expect.any(String), text: 'a chave está no balde', at: VINTE_E_MEIA + UM_MINUTO },
      ],
    })
    // O cartão "Enquanto você esteve fora" já mostra o último: o recado da cena não abre outro cartão por cima.
    expect(msgsPara(volta, 'c-bruno-2').map((m) => m.type)).toEqual(['welcome', 'snapshot', 'notes.book', 'notes.away'])
  })

  it('os recados de fora também entram no caderno de Bruno', () => {
    const { s, bruno } = mesa()
    s.disconnect('c-bruno')
    s.sceneNote('s-prisao', 'um', mundo())
    s.sceneNote('s-prisao', 'dois', mundo())
    const livro = msgsPara(entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r, 'c-bruno-2').find((m) => m.type === 'notes.book')
    if (livro?.type !== 'notes.book') throw new Error('esperava notes.book')
    expect(livro.notes.map((n) => n.text)).toEqual(['um', 'dois'])
  })

  it('o mestre leva Bruno ao Mercado enquanto ele está fora: o recado da Prisão, mandado quando ele estava lá, ainda chega', () => {
    const { s, bruno } = mesa()
    s.disconnect('c-bruno')
    s.sceneNote('s-prisao', 'a chave está no balde', mundo())
    const volta = entra(s, 'c-bruno-2', 'Bruno', mundo(true), bruno.resume).r
    const fila = foraDoAr(volta, 'c-bruno-2')
    if (fila?.type !== 'notes.away') throw new Error('esperava notes.away')
    expect(fila.notes.map((n) => n.text)).toEqual(['a chave está no balde'])
  })

  it('recado de outra cena não entra na fila de Bruno, e a fila não leva id nem nome de cena', () => {
    const { s, bruno } = mesa()
    s.disconnect('c-bruno')
    s.sceneNote('s-mercado', 'SEGREDO-DO-MERCADO', mundo())
    s.sceneNote('s-vila', 'SEGREDO-DA-VILA', mundo())
    s.sceneNote('s-prisao', 'a chave está no balde', mundo())

    const volta = entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r
    const fila = foraDoAr(volta, 'c-bruno-2')
    if (fila?.type !== 'notes.away') throw new Error('esperava notes.away')
    expect(fila.notes.map((n) => n.text)).toEqual(['a chave está no balde'])
    const texto = JSON.stringify(msgsPara(volta, 'c-bruno-2'))
    expect(texto).not.toContain('SEGREDO-DO-MERCADO')
    expect(texto).not.toContain('SEGREDO-DA-VILA')
    expect(JSON.stringify(fila)).not.toContain('s-prisao')
    expect(JSON.stringify(fila)).not.toContain('Prisao Velha')
    expect(JSON.stringify(fila)).not.toContain('sceneId')
  })

  it('quem estava conectado recebe na hora e não ganha fila; na volta não há "notes.away"', () => {
    const { s, diego } = mesa()
    const agora = s.sceneNote('s-mercado', 'as bancas fecham cedo', mundo())
    expect(msgsPara(agora, 'c-diego').map((m) => m.type)).toEqual(['scene.note'])
    s.disconnect('c-diego')
    const volta = entra(s, 'c-diego-2', 'Diego', mundo(), diego.resume).r
    expect(foraDoAr(volta, 'c-diego-2')).toBeUndefined()
    // O recado que ele já leu volta como sempre voltou: o cartão da cena.
    expect(msgsPara(volta, 'c-diego-2').map((m) => m.type)).toEqual(['welcome', 'snapshot', 'notes.book', 'scene.note'])
  })

  it('a fila é entregue uma vez só: caiu e voltou de novo, o "notes.away" não repete', () => {
    const { s, bruno } = mesa()
    s.disconnect('c-bruno')
    s.sceneNote('s-prisao', 'a chave está no balde', mundo())
    expect(foraDoAr(entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r, 'c-bruno-2')?.type).toBe('notes.away')
    s.disconnect('c-bruno-2')
    const outra = entra(s, 'c-bruno-3', 'Bruno', mundo(), bruno.resume).r
    expect(foraDoAr(outra, 'c-bruno-3')).toBeUndefined()
    expect(msgsPara(outra, 'c-bruno-3').map((m) => m.type)).toEqual(['welcome', 'snapshot', 'notes.book', 'scene.note'])
  })

  it('fora do ar e sem ficha (aguardando) não entra na fila', () => {
    const { s, bruno } = mesa()
    s.disconnect('c-bruno')
    s.unassignToken(bruno.playerId, 'bruno')
    s.sceneNote('s-prisao', 'ninguém ouve', mundo())
    const volta = entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r
    expect(foraDoAr(volta, 'c-bruno-2')).toBeUndefined()
    expect(JSON.stringify(msgsPara(volta, 'c-bruno-2'))).not.toContain('ninguém ouve')
  })

  it('a fila guarda no máximo AWAY_NOTES_MAX recados: sai o mais antigo', () => {
    const { s, bruno, relogio } = mesa()
    s.disconnect('c-bruno')
    for (let i = 0; i < AWAY_NOTES_MAX + 3; i += 1) {
      relogio(VINTE_E_MEIA + i * UM_MINUTO)
      s.sceneNote('s-prisao', `recado ${i}`, mundo())
    }
    const fila = foraDoAr(entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r, 'c-bruno-2')
    if (fila?.type !== 'notes.away') throw new Error('esperava notes.away')
    expect(fila.notes).toHaveLength(AWAY_NOTES_MAX)
    expect(fila.notes[0]?.text).toBe('recado 3')
    expect(fila.notes.at(-1)?.text).toBe(`recado ${AWAY_NOTES_MAX + 2}`)
  })

  it('quem entra com o nome de Bruno mas sem o resume dele não herda a fila', () => {
    const { s } = mesa()
    s.disconnect('c-bruno')
    s.sceneNote('s-prisao', 'a chave está no balde', mundo())
    const bruno2 = entra(s, 'c-bruno-x', 'Bruno', mundo())
    expect(foraDoAr(bruno2.r, 'c-bruno-x')).toBeUndefined()
    expect(JSON.stringify(msgsPara(bruno2.r, 'c-bruno-x'))).not.toContain('a chave está no balde')
  })

  it('o mestre ainda vê quantos receberam AGORA: a fila não conta como entregue', () => {
    const { s } = mesa()
    s.disconnect('c-bruno')
    expect(s.sceneNote('s-prisao', 'a chave está no balde', mundo())).toEqual({ outbound: [] })
  })
})
