/**
 * COMPANHEIROS (G13): cada jogador recebe `party.update` com os OUTROS
 * jogadores da mesa e onde estão PARA ELE — 'aqui' (mesma cena), 'longe'
 * (outra cena, ou sem ficha) ou 'fora' (desconectado). A lista é calculada por
 * destinatário e nunca leva o nome nem o id de cena de ninguém: é o mesmo
 * recorte do snapshot, só que sobre gente.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { PartyMember } from './protocol'

const CODE = 'AB12CD'
const SALAO = 'Salao Norte'
const CRIPTA = 'Cripta Rubra'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

/** Salão aberto no editor com Ana e Bruno; Cripta de fundo com Carla. */
function mundoCom(salao: Token[], cripta: Token[]): HostWorld {
  return {
    open: { sceneId: 's-salao', name: SALAO, map: mapa('m-salao', SALAO, salao) },
    background: [{ sceneId: 's-cripta', name: CRIPTA, map: mapa('m-cripta', CRIPTA, cripta) }],
  }
}

const MUNDO = mundoCom([ficha('lanterna', 100, 100), ficha('machado', 200, 100)], [ficha('cajado', 300, 100)])

function mesa(mundo: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
    const welcome = r.outbound.find((o) => o.clientId === clientId)?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return welcome.playerId
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  const carla = entra('c3', 'Carla')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.assignToken(carla, 'cajado')
  return { s, ana, bruno, carla }
}

/** A lista que `clientId` recebeu neste resultado, como pares [nome, onde]; `null` quando nada chegou a ele. */
function listaDe(r: HostResult, clientId: string): Array<[string, PartyMember['where']]> | null {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'party.update')?.msg
  if (msg === undefined || msg.type !== 'party.update') return null
  return msg.members.map((m) => [m.name, m.where])
}

describe('party.update: quem está onde, por destinatário', () => {
  it('Ana vê Bruno "aqui" e Carla "longe"; Carla vê os dois "longe"; ninguém está na própria lista', () => {
    const { s } = mesa(MUNDO)
    const r = s.partyUpdates(MUNDO)
    expect(listaDe(r, 'c1')).toEqual([
      ['Bruno', 'aqui'],
      ['Carla', 'longe'],
    ])
    expect(listaDe(r, 'c2')).toEqual([
      ['Ana', 'aqui'],
      ['Carla', 'longe'],
    ])
    expect(listaDe(r, 'c3')).toEqual([
      ['Ana', 'longe'],
      ['Bruno', 'longe'],
    ])
  })

  it('sem mudança não reenvia; a viagem de Bruno muda a lista de todos na hora', () => {
    const { s } = mesa(MUNDO)
    s.partyUpdates(MUNDO)
    expect(s.partyUpdates(MUNDO).outbound).toEqual([])

    // Bruno foi para a Cripta (a ficha dele mudou de cena).
    const depois = mundoCom([ficha('lanterna', 100, 100)], [ficha('cajado', 300, 100), ficha('machado', 400, 100)])
    const r = s.partyUpdates(depois)
    expect(listaDe(r, 'c1')).toEqual([
      ['Bruno', 'longe'],
      ['Carla', 'longe'],
    ])
    expect(listaDe(r, 'c3')).toEqual([
      ['Ana', 'longe'],
      ['Bruno', 'aqui'],
    ])
  })

  it('quem cai fica "fora" para os outros, mesmo com a ficha na mesma cena', () => {
    const { s } = mesa(MUNDO)
    s.partyUpdates(MUNDO)
    s.disconnect('c2')
    const r = s.partyUpdates(MUNDO)
    expect(listaDe(r, 'c1')).toEqual([
      ['Bruno', 'fora'],
      ['Carla', 'longe'],
    ])
    // Conexão que caiu não recebe nada.
    expect(listaDe(r, 'c2')).toBeNull()
  })

  it('jogador sozinho recebe a lista vazia: a tela nova (ou reconectada) troca qualquer lista antiga', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, MUNDO)
    expect(listaDe(s.partyUpdates(MUNDO), 'c1')).toEqual([])
    expect(s.partyUpdates(MUNDO).outbound).toEqual([])
  })

  it('jogador ainda sem ficha fica "longe" para quem está em cena, e para ele ninguém está "aqui"', () => {
    const { s } = mesa(MUNDO)
    const r0 = s.handleMessage('c4', { type: 'join', code: CODE, name: 'Davi' }, MUNDO)
    expect(r0.outbound.some((o) => o.msg.type === 'welcome')).toBe(true)
    const r = s.partyUpdates(MUNDO)
    expect(listaDe(r, 'c1')).toEqual([
      ['Bruno', 'aqui'],
      ['Carla', 'longe'],
      ['Davi', 'longe'],
    ])
    expect(listaDe(r, 'c4')).toEqual([
      ['Ana', 'longe'],
      ['Bruno', 'longe'],
      ['Carla', 'longe'],
    ])
  })
})

describe('party.update não vaza', () => {
  it('nenhum frame leva nome de cena, id de cena, id de mapa, ficha ou posição', () => {
    const { s } = mesa(MUNDO)
    const r = s.partyUpdates(MUNDO)
    const segredos = [SALAO, CRIPTA, 's-salao', 's-cripta', 'm-salao', 'm-cripta', 'lanterna', 'machado', 'cajado']
    for (const clientId of ['c1', 'c2', 'c3']) {
      const texto = JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
      expect(texto).toContain('party.update')
      for (const segredo of segredos) expect(texto, `${clientId} não deveria receber "${segredo}"`).not.toContain(segredo)
    }
  })

  it('cada membro tem só playerId, nome e onde — nada de x, y, cena ou ficha', () => {
    const { s } = mesa(MUNDO)
    const msg = s.partyUpdates(MUNDO).outbound.find((o) => o.clientId === 'c1')?.msg
    if (msg?.type !== 'party.update') throw new Error('esperava party.update')
    for (const membro of msg.members) expect(Object.keys(membro).sort()).toEqual(['name', 'playerId', 'where'])
  })
})
