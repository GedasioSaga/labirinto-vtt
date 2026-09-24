/**
 * MARCA DE COMPANHEIRO, lado do FIO: o snapshot que sai pelo WebSocket da
 * Duda leva, na ficha do Caio que ela enxerga, o nome dele e a cor de sinal
 * dele — e nada disso quando a ficha do Caio está onde ela não vê (névoa ou
 * outra cena). NPC nunca leva marca.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { signalColor } from '../lib/signals'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'COMP01'

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

function mapa(id: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, 'Salão', 40, 40, 50), tokens }
}

/** Duda (c1) com a ficha 'duda' e Caio (c2) com a ficha 'caio'. */
function mesaCom(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, tokenId: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, source)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  const duda = entra('c1', 'Duda', 'duda')
  const caio = entra('c2', 'Caio', 'caio')
  return { s, duda, caio }
}

function fichasNoFio(r: HostResult, clientId: string): Token[] {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error(`esperava o mapa de ${clientId}`)
  return msg.map.tokens
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('fio: marca de companheiro na ficha de outro jogador', () => {
  it('a Duda recebe a ficha do Caio com o nome e a cor dele; o NPC e a própria ficha vão sem marca', () => {
    const salao = mapa('m-salao', [ficha('duda', 'Guerreira', 100, 100), ficha('caio', 'Ladino', 300, 100), ficha('guarda', 'Guarda', 200, 300, { npc: true })])
    const { s, caio } = mesaCom(salao)
    const fichas = fichasNoFio(s.broadcast(salao), 'c1')
    const porId = new Map(fichas.map((t) => [t.id, t]))
    expect(porId.get('caio')?.companion).toEqual({ name: 'Caio', color: signalColor(caio) })
    expect(porId.get('guarda')?.name).toBe('Guarda')
    expect('companion' in (porId.get('guarda') ?? {})).toBe(false)
    expect(porId.get('duda')?.name).toBe('Guerreira')
    expect('companion' in (porId.get('duda') ?? {})).toBe(false)
  })

  it('e o Caio recebe a ficha da Duda marcada com o nome dela', () => {
    const salao = mapa('m-salao', [ficha('duda', 'Guerreira', 100, 100), ficha('caio', 'Ladino', 300, 100)])
    const { s, duda } = mesaCom(salao)
    const daDuda = fichasNoFio(s.broadcast(salao), 'c2').find((t) => t.id === 'duda')
    expect(daDuda?.companion).toEqual({ name: 'Duda', color: signalColor(duda) })
  })

  it('o Caio longe, na névoa da Duda: nem a ficha nem o nome "Caio" chegam a ela', () => {
    const salao = mapa('m-salao', [ficha('duda', 'Guerreira', 100, 100), ficha('caio', 'Ladino', 1900, 1900)])
    const { s } = mesaCom(salao)
    const r = s.broadcast(salao)
    expect(fichasNoFio(r, 'c1').map((t) => t.id)).toEqual(['duda'])
    expect(textoPara(r, 'c1')).not.toContain('Caio')
  })

  it('o Caio em outra cena: nada dele (ficha, nome, cor) chega à Duda', () => {
    const salao = mapa('m-salao', [ficha('duda', 'Guerreira', 100, 100)])
    const cripta = mapa('m-cripta', [ficha('caio', 'Ladino', 100, 100)])
    const mundo: HostWorld = { open: { sceneId: 's-a', name: 'Salão', map: salao }, background: [{ sceneId: 's-b', name: 'Cripta', map: cripta }] }
    const { s, caio } = mesaCom(mundo)
    const r = s.broadcast(mundo)
    expect(fichasNoFio(r, 'c1').map((t) => t.id)).toEqual(['duda'])
    const texto = textoPara(r, 'c1')
    expect(texto).not.toContain('Caio')
    expect(texto).not.toContain('Ladino')
    expect(texto).not.toContain(signalColor(caio))
  })
})
