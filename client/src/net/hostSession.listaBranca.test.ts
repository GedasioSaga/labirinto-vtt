/**
 * FICHA POR LISTA BRANCA, lado do FIO: o que sai pelo WebSocket da Duda
 * (snapshot na entrada e a cada broadcast) nunca leva campo da ficha que o
 * recorte não conhece. Aceite: "um token com o campo segredoDoMestre não traz
 * esse campo no pacote do jogador".
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'LISTA1'
const SEGREDO = 'agenda: meia-noite na ponte'

function ficha(id: string, name: string, x: number): Token {
  return Object.assign({ id, characterId: null, name, x, y: 100, size: 1, image: null }, { segredoDoMestre: SEGREDO })
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-porto', 'Porto', 30, 10, 50), tokens }
}

function mesaCom(source: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Duda' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'arco')
  return s
}

function fichasNoFio(r: HostResult): Token[] {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error('esperava o mapa da Duda')
  return msg.map.tokens
}

describe('fio da Duda: a ficha sai por lista branca', () => {
  it('nem a ficha dela nem a do NPC levam segredoDoMestre pelo fio', () => {
    const porto = mapa([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz', 300)])
    const s = mesaCom(porto)
    const r = s.broadcast(porto)
    const fichas = fichasNoFio(r)
    expect(fichas.map((t) => t.id).sort()).toEqual(['arco', 'npc'])
    expect(fichas.every((t) => !('segredoDoMestre' in t))).toBe(true)
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))).not.toContain(SEGREDO)
  })
})
