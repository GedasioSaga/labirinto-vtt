/**
 * CADERNO DE RECADOS no host: o recado deixa de sumir. O host guarda até
 * `NOTEBOOK_MAX_NOTES` recados por jogador (só os que ELE recebeu) e o último
 * recado de cada cena; quem entra ou volta recebe o caderno (`notes.book`) e o
 * último recado da cena onde está. Quem está em outra cena não recebe nada:
 * nem o recado, nem o caderno de ninguém, nem o nome ou o id da cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { NOTEBOOK_MAX_NOTES, type HostMessage } from './protocol'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const RECADO = 'o baú tem fundo falso'
/** 20:30 do dia 22/09/2026 no relógio do mestre. */
const VINTE_E_MEIA = new Date(2026, 8, 22, 20, 30).getTime()

function ficha(id: string): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: 100, y: 100, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

function cena(sceneId: string, nome: string, mapId: string, tokens: Token[]): HostScene {
  return { sceneId, name: nome, map: mapa(mapId, nome, tokens) }
}

/** Vila (aberta no editor) com Fábio; Prisão com Bruno; Mercado com Diego. Gabi ainda sem ficha em cena. */
function mundo(gabiNaPrisao = false): HostWorld {
  return {
    open: cena('s-vila', 'Vila Alta', 'm-vila', [ficha('fabio')]),
    background: [
      cena('s-prisao', 'Prisao Velha', 'm-prisao', gabiNaPrisao ? [ficha('bruno'), ficha('gabi')] : [ficha('bruno')]),
      cena('s-mercado', 'Mercado Negro', 'm-mercado', [ficha('diego')]),
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
  const gabi = entra(s, 'c-gabi', 'Gabi', w)
  s.assignToken(fabio.playerId, 'fabio')
  s.assignToken(bruno.playerId, 'bruno')
  s.assignToken(diego.playerId, 'diego')
  s.assignToken(gabi.playerId, 'gabi')
  s.broadcast(w)
  return { s, fabio, bruno, diego, gabi, relogio: (ms: number) => (agora = ms) }
}

function msgsPara(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(msgsPara(r, clientId))
}

describe('caderno de recados (host)', () => {
  it('o recado sai com a hora do mestre (`at`), e só para quem está na cena', () => {
    const { s } = mesa()
    const r = s.sceneNote('s-prisao', RECADO, mundo())
    expect(r.outbound).toEqual([{ clientId: 'c-bruno', msg: { type: 'scene.note', id: expect.any(String), text: RECADO, at: VINTE_E_MEIA } }])
  })

  it('Bruno corta a rede e volta: o caderno e o recado da cena chegam de novo', () => {
    const { s, bruno } = mesa()
    const enviado = msgsPara(s.sceneNote('s-prisao', RECADO, mundo()), 'c-bruno')[0]
    if (enviado?.type !== 'scene.note') throw new Error('esperava scene.note')
    s.disconnect('c-bruno')

    const volta = entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r
    const tipos = msgsPara(volta, 'c-bruno-2').map((m) => m.type)
    // Ordem: welcome, o mapa, o caderno e o cartão do recado por cima do mapa.
    expect(tipos).toEqual(['welcome', 'snapshot', 'notes.book', 'scene.note'])
    expect(msgsPara(volta, 'c-bruno-2')[2]).toEqual({ type: 'notes.book', notes: [{ id: enviado.id, text: RECADO, at: VINTE_E_MEIA }] })
    expect(msgsPara(volta, 'c-bruno-2')[3]).toEqual({ type: 'scene.note', id: enviado.id, text: RECADO, at: VINTE_E_MEIA })
  })

  it('recado mandado com Bruno fora do ar: ao voltar ele recebe, e o recado entra no caderno dele', () => {
    const { s, bruno } = mesa()
    s.disconnect('c-bruno')
    expect(s.sceneNote('s-prisao', RECADO, mundo())).toEqual({ outbound: [] })
    const volta = entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r
    expect(textoPara(volta, 'c-bruno-2')).toContain(RECADO)
    // Caiu de novo e voltou: agora o recado está no caderno dele.
    s.disconnect('c-bruno-2')
    const outraVolta = entra(s, 'c-bruno-3', 'Bruno', mundo(), bruno.resume).r
    const livro = msgsPara(outraVolta, 'c-bruno-3').find((m) => m.type === 'notes.book')
    expect(livro).toEqual({ type: 'notes.book', notes: [{ id: expect.any(String), text: RECADO, at: VINTE_E_MEIA }] })
  })

  it('Gabi chega na Prisão depois do recado e recebe; Diego, no Mercado, não recebe nada', () => {
    const { s } = mesa()
    s.sceneNote('s-prisao', RECADO, mundo())

    const r = s.broadcast(mundo(true))
    const gabi = msgsPara(r, 'c-gabi')
    // O mapa primeiro: o cliente só aceita recado com mapa na tela.
    expect(gabi.map((m) => m.type)).toEqual(['snapshot', 'scene.note'])
    expect(gabi[1]).toEqual({ type: 'scene.note', id: expect.any(String), text: RECADO, at: VINTE_E_MEIA })

    expect(textoPara(r, 'c-diego')).not.toContain(RECADO)
    expect(textoPara(r, 'c-fabio')).not.toContain(RECADO)
    expect(msgsPara(r, 'c-diego').map((m) => m.type)).toEqual(['snapshot'])
  })

  it('Diego volta à sala: o caderno dele não traz recado de outra cena', () => {
    const { s, diego } = mesa()
    s.sceneNote('s-prisao', RECADO, mundo())
    s.sceneNote('s-mercado', 'as bancas fecham cedo', mundo())
    s.disconnect('c-diego')
    const volta = entra(s, 'c-diego-2', 'Diego', mundo(), diego.resume).r
    const texto = textoPara(volta, 'c-diego-2')
    expect(texto).toContain('as bancas fecham cedo')
    expect(texto).not.toContain(RECADO)
  })

  it('quem já tem o recado no caderno não o recebe de novo ao voltar à mesma cena', () => {
    const { s } = mesa()
    s.sceneNote('s-prisao', RECADO, mundo())
    expect(msgsPara(s.broadcast(mundo(true)), 'c-gabi').map((m) => m.type)).toEqual(['snapshot', 'scene.note'])
    // Broadcast seguinte na mesma cena: só o mapa.
    expect(msgsPara(s.broadcast(mundo(true)), 'c-gabi').map((m) => m.type)).toEqual(['snapshot'])
    // Foi para fora (ficha sumiu da Prisão) e voltou: já leu, o cartão não reabre.
    s.broadcast(mundo(false))
    expect(msgsPara(s.broadcast(mundo(true)), 'c-gabi').map((m) => m.type)).toEqual(['snapshot'])
  })

  it('o caderno guarda no máximo NOTEBOOK_MAX_NOTES recados por jogador: sai o mais antigo', () => {
    const { s, bruno, relogio } = mesa()
    for (let i = 0; i < NOTEBOOK_MAX_NOTES + 5; i += 1) {
      relogio(VINTE_E_MEIA + i * 60_000)
      s.sceneNote('s-prisao', `recado ${i}`, mundo())
    }
    s.disconnect('c-bruno')
    const volta = entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r
    const livro = msgsPara(volta, 'c-bruno-2').find((m) => m.type === 'notes.book')
    if (livro?.type !== 'notes.book') throw new Error('esperava notes.book')
    expect(livro.notes).toHaveLength(NOTEBOOK_MAX_NOTES)
    expect(livro.notes[0]?.text).toBe('recado 5')
    expect(livro.notes.at(-1)?.text).toBe(`recado ${NOTEBOOK_MAX_NOTES + 4}`)
  })

  it('nem o caderno nem o recado reenviado levam id ou nome de cena', () => {
    const { s, bruno } = mesa()
    s.sceneNote('s-prisao', RECADO, mundo())
    s.disconnect('c-bruno')
    const texto = textoPara(entra(s, 'c-bruno-2', 'Bruno', mundo(), bruno.resume).r, 'c-bruno-2')
    expect(texto).toContain('notes.book')
    expect(texto).not.toContain('s-prisao')
    expect(texto).not.toContain('Prisao Velha')
    expect(texto).not.toContain('sceneId')
  })

  it('jogador expulso perde o caderno: quem entra com o mesmo nome não herda nada', () => {
    const { s } = mesa()
    s.sceneNote('s-prisao', RECADO, mundo())
    s.kick('c-bruno')
    const novo = entra(s, 'c-bruno-2', 'Bruno', mundo()).r
    expect(textoPara(novo, 'c-bruno-2')).not.toContain(RECADO)
    expect(msgsPara(novo, 'c-bruno-2').map((m) => m.type)).not.toContain('notes.book')
  })

  it('quem entra sem ficha (aguardando) não recebe recado de cena nenhuma', () => {
    const { s } = mesa()
    s.sceneNote('s-prisao', RECADO, mundo())
    const hugo = entra(s, 'c-hugo', 'Hugo', mundo()).r
    expect(textoPara(hugo, 'c-hugo')).not.toContain(RECADO)
  })
})
