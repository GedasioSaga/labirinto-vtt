/**
 * NOTA DO MESTRE NO PINO, lado da REDE: o mestre escreve "só eu leio" no pino
 * do cofre. Nenhum pacote que sai do host para o celular leva a nota — nem o
 * snapshot de quem está em cima do pino, nem a pista que o cartão vira, nem o
 * de quem está em outra cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import type { HostMessage } from './protocol'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const DESCRICAO = 'Um cofre de parede com três rodas numeradas.'
const NOTA = 'SEGREDO-DO-MESTRE: a combinação é 6-12-18.'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

const COFRE: Pin = { id: 'cofre', x: 150, y: 150, kind: 'exclamacao', description: DESCRICAO, image: null, notaDoMestre: NOTA }

function mundo(): HostWorld {
  const casa: MapData = { ...createEmptyMap('m-casa', 'Casa', 30, 10, 50), tokens: [ficha('gabi', 100, 100)], pins: [COFRE] }
  const porao: MapData = { ...createEmptyMap('m-porao', 'Porao', 30, 10, 50), tokens: [ficha('bruno', 100, 100)] }
  return { open: { sceneId: 's-casa', name: 'Casa', map: casa }, background: [{ sceneId: 's-porao', name: 'Porao', map: porao }] }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, world: HostWorld): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function msgsPara(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function mesa() {
  let n = 0
  const world = mundo()
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  s.assignToken(entra(s, 'c-gabi', 'Gabi', world), 'gabi')
  s.assignToken(entra(s, 'c-bruno', 'Bruno', world), 'bruno')
  return { s, world }
}

describe('nota do mestre no pino nunca sai pela rede', () => {
  it('Gabi, em cima do cofre, recebe o pino com a descrição e sem a nota; Bruno, no porão, nem o pino', () => {
    const { s, world } = mesa()
    const r = s.broadcast(world)
    const daGabi = JSON.stringify(msgsPara(r, 'c-gabi'))
    expect(daGabi).toContain(DESCRICAO)
    expect(daGabi).not.toContain('SEGREDO-DO-MESTRE')
    expect(daGabi).not.toContain('notaDoMestre')
    const doBruno = JSON.stringify(msgsPara(r, 'c-bruno'))
    expect(doBruno).not.toContain('SEGREDO-DO-MESTRE')
    expect(doBruno).not.toContain(DESCRICAO)
    expect(JSON.stringify(r.outbound)).not.toContain('SEGREDO-DO-MESTRE')
  })

  it('Gabi guarda o cartão do cofre como pista: a pista leva a descrição e não a nota', () => {
    const { s, world } = mesa()
    s.broadcast(world)
    const r = s.handleMessage('c-gabi', { type: 'clue.read', pinId: 'cofre' }, world)
    const added = msgsPara(r, 'c-gabi').find((m) => m.type === 'clue.added')
    if (added?.type !== 'clue.added') throw new Error('esperava clue.added')
    expect(added.clue.text).toBe(DESCRICAO)
    expect(JSON.stringify(r.outbound)).not.toContain('SEGREDO-DO-MESTRE')
  })
})
