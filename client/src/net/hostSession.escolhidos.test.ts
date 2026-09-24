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
  const resumes: Record<string, string> = {}
  for (const [i, nome] of ['ana', 'bruno', 'carla', 'duda', 'elisa'].entries()) {
    const r = s.handleMessage(`c-${nome}`, { type: 'join', code: CODE, name: nome }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error(`esperava welcome no ${i}º`)
    ids[nome] = welcome.playerId
    resumes[nome] = welcome.resumeToken
    s.assignToken(welcome.playerId, `t-${nome}`)
  }
  return { s, ids, resumes }
}

/** `nome` cai e volta pelo resume, noutra conexão: tudo o que a sala manda na volta. */
function voltaDe(s: ReturnType<typeof mesa>['s'], resumes: Record<string, string>, nome: string): string {
  s.disconnect(`c-${nome}`)
  const r = s.handleMessage(`c-${nome}-volta`, { type: 'join', code: CODE, name: nome, resume: resumes[nome] }, mundo)
  return JSON.stringify(r.outbound.map((o) => o.msg))
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

  // Junção com o CADERNO (o último recado da cena vai a quem chega ou volta):
  // o recado para escolhidos não pode virar o "último recado da cena".
  it('quem volta à sala recebe o último recado da CENA, nunca o que foi só para outros', () => {
    const { s, ids, resumes } = mesa()
    s.sceneNote('s-vila', 'Todos ouvem o sino.', mundo)
    s.sceneNote('s-vila', 'Só a Ana vê o bilhete.', mundo, [ids.ana])
    const bruno = voltaDe(s, resumes, 'bruno')
    expect(bruno).toContain('Todos ouvem o sino.')
    expect(bruno).not.toContain('Só a Ana vê o bilhete.')
    // A Ana, que recebeu, continua com ele no caderno dela.
    expect(voltaDe(s, resumes, 'ana')).toContain('Só a Ana vê o bilhete.')
  })

  it('quem chega depois à cena não lê o recado que foi só para os marcados', () => {
    const { s, ids } = mesa()
    s.sceneNote('s-mina', 'Só a Elisa ouve o eco.', mundo, [ids.elisa])
    // O Bruno ganha uma ficha na Mina e sai da Vila: é CHEGADA à Mina.
    const mina: HostScene = { ...MINA, map: { ...MINA.map, tokens: [...MINA.map.tokens, ficha('t-bruno-mina', 300, 100)] } }
    const vila: HostScene = { ...VILA, map: { ...VILA.map, tokens: VILA.map.tokens.filter((t) => t.id !== 't-bruno') } }
    s.unassignToken(ids.bruno, 't-bruno')
    s.assignToken(ids.bruno, 't-bruno-mina')
    const chegada = s.broadcast({ open: vila, background: [mina] })
    const doBruno = JSON.stringify(chegada.outbound.filter((o) => o.clientId === 'c-bruno').map((o) => o.msg))
    expect(doBruno).toContain('snapshot')
    expect(doBruno).not.toContain('Só a Elisa ouve o eco.')
  })
})
