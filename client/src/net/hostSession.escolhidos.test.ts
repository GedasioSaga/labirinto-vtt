/**
 * RECADO PARA ESCOLHIDOS: o mestre marca quem, dentro da cena, recebe o
 * recado. Só os marcados que AINDA estão na cena recebem; quem ficou de fora
 * não recebe nem o frame, e o pacote de quem recebe não diz quem mais leu.
 */
import { describe, expect, it } from 'vitest'
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

/** Vila: Ana, Carla e Duda na taverna; Bruno no quarto do prefeito. Mina: Elisa. */
const VILA: HostScene = {
  sceneId: 's-vila',
  name: 'Vila de Pedravel',
  map: mapa('m-vila', 'Vila', [ficha('t-ana', 100, 100), ficha('t-bruno', 700, 200), ficha('t-carla', 150, 100), ficha('t-duda', 200, 100)]),
}
const MINA: HostScene = { sceneId: 's-mina', name: 'Mina Funda', map: mapa('m-mina', 'Mina', [ficha('t-elisa', 100, 100)]) }
const mundo: HostWorld = { open: VILA, background: [MINA] }

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  for (const [i, nome] of ['ana', 'bruno', 'carla', 'duda', 'elisa'].entries()) {
    const r = s.handleMessage(`c-${nome}`, { type: 'join', code: CODE, name: nome }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error(`esperava welcome no ${i}º`)
    ids[nome] = welcome.playerId
    s.assignToken(welcome.playerId, `t-${nome}`)
  }
  return { s, ids }
}

function quem(r: HostResult): string[] {
  return r.outbound.map((o) => o.clientId).sort()
}

describe('sceneNote para escolhidos', () => {
  it('"Quem está em: Taverna": só os 3 marcados recebem; Bruno, na mesma cena, não recebe nada', () => {
    const { s, ids } = mesa()
    const r = s.sceneNote('s-vila', 'O taverneiro cochicha.', mundo, [ids.ana, ids.carla, ids.duda])
    expect(quem(r)).toEqual(['c-ana', 'c-carla', 'c-duda'])
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-bruno'))).toBe('[]')
  })

  it('"Quem está em: Quarto do prefeito" manda só ao Bruno', () => {
    const { s, ids } = mesa()
    expect(quem(s.sceneNote('s-vila', 'Uma carta sob o travesseiro.', mundo, [ids.bruno]))).toEqual(['c-bruno'])
  })

  it('marcado que está em OUTRA cena não recebe: a cena do recado ainda manda', () => {
    const { s, ids } = mesa()
    // A lista do mestre ficou velha: Elisa está na Mina, não na Vila.
    expect(quem(s.sceneNote('s-vila', 'oi', mundo, [ids.ana, ids.elisa]))).toEqual(['c-ana'])
  })

  it('ninguém marcado: não sai nada', () => {
    const { s } = mesa()
    expect(s.sceneNote('s-vila', 'oi', mundo, [])).toEqual({ outbound: [] })
  })

  it('o pacote de quem recebe não diz quem mais leu, nem nome ou id de cena', () => {
    const { s, ids } = mesa()
    const r = s.sceneNote('s-vila', 'segredo', mundo, [ids.ana, ids.carla])
    // Formato exato: nenhum campo além de tipo, id do recado, texto e a hora do caderno (nem lista de quem recebe).
    for (const o of r.outbound) expect(o.msg).toEqual({ type: 'scene.note', id: expect.any(String), text: 'segredo', at: expect.any(Number) })
    const texto = JSON.stringify(r.outbound.map((o) => o.msg))
    for (const vazado of ['ana', 'carla', 'Vila', 's-vila', 'bruno']) expect(texto).not.toContain(vazado)
  })

  it('sem a lista (o recado da cena inteira) continua indo a todos da cena', () => {
    const { s } = mesa()
    expect(quem(s.sceneNote('s-vila', 'todos', mundo))).toEqual(['c-ana', 'c-bruno', 'c-carla', 'c-duda'])
  })
})
