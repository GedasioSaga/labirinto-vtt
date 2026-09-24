/**
 * NOME PÚBLICO DA FICHA, lado do FIO: o que sai pelo WebSocket da Duda
 * (snapshot na entrada e a cada broadcast) nunca leva o nome de trabalho do
 * NPC quando o mestre escolheu "Outro" ou "Nenhum". Aceite do backlog:
 * "'traidor' não aparece no WS dela".
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'NOME01'

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
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

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

function nomesNoFio(r: HostResult): string[] {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error('esperava o mapa da Duda')
  return msg.map.tokens.map((t) => t.name).sort()
}

describe('fio da Duda: nome público da ficha', () => {
  it('"Outro: Estivador": o fio traz "Estivador" e nunca "traidor"', () => {
    const porto = mapa([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz traidor', 300, { publicName: 'Estivador' })])
    const s = mesaCom(porto)
    const r = s.broadcast(porto)
    expect(nomesNoFio(r)).toEqual(['Arco', 'Estivador'])
    expect(textoPara(r, 'c1')).not.toContain('traidor')
  })

  it('"Nenhum": o NPC chega com nome vazio e sem o nome de trabalho', () => {
    const porto = mapa([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz traidor', 300, { publicName: null })])
    const s = mesaCom(porto)
    const r = s.broadcast(porto)
    expect(nomesNoFio(r)).toEqual(['', 'Arco'])
    expect(textoPara(r, 'c1')).not.toContain('traidor')
  })

  it('a dona recebe o nome real da própria ficha, nunca a máscara', () => {
    const porto = mapa([ficha('arco', 'Arco', 100, { publicName: 'Mascarado' }), ficha('npc', 'Capataz traidor', 300)])
    const s = mesaCom(porto)
    const r = s.broadcast(porto)
    expect(nomesNoFio(r)).toEqual(['Arco', 'Capataz traidor'])
    expect(textoPara(r, 'c1')).not.toContain('Mascarado')
  })
})
