/**
 * CONDIÇÃO NA FICHA pela REDE: o que o mestre marca numa ficha que o jogador
 * vê chega no snapshot seguinte, e desmarcar tira. O que está fora do alcance
 * dele — ficha de OUTRA cena, ficha no escuro — não sai da máquina do mestre,
 * nem a condição dela.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { toggleTokenCondition } from '../lib/tokenConditions'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'COND01'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function mapa(id: string, tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap(id, `cena-${id}`, 30, 12, 50), tokens, walls }
}

/** Ana entra e recebe a Lanterna. */
function mesaCom(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'lanterna')
  return s
}

function mapaDoJogador(r: HostResult): MapData {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava o snapshot da Ana')
  return msg.map
}

function textoPara(r: HostResult): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
}

describe('condição na ficha — o que chega a quem joga', () => {
  it('o mestre marca "Caído" no Ogro à vista de Ana: o snapshot leva; desmarcar tira', () => {
    const inicio = mapa('m-enfermaria', [ficha('lanterna', 425, 325), ficha('ogro', 625, 325)])
    const s = mesaCom(inicio)
    expect(mapaDoJogador(s.broadcast(inicio)).tokens.find((t) => t.id === 'ogro')?.conditions).toBeUndefined()

    const marcado = toggleTokenCondition(inicio, 'ogro', 'caido')
    expect(mapaDoJogador(s.broadcast(marcado)).tokens.find((t) => t.id === 'ogro')?.conditions).toEqual(['caido'])

    const desmarcado = toggleTokenCondition(marcado, 'ogro', 'caido')
    const ogro = mapaDoJogador(s.broadcast(desmarcado)).tokens.find((t) => t.id === 'ogro')
    expect(ogro).toBeDefined()
    expect(ogro?.conditions ?? []).toEqual([])
  })

  it('a condição da PRÓPRIA ficha chega a ela', () => {
    const inicio = mapa('m-enfermaria', [ficha('lanterna', 425, 325, { conditions: ['envenenado'] })])
    const s = mesaCom(inicio)
    expect(mapaDoJogador(s.broadcast(inicio)).tokens[0]?.conditions).toEqual(['envenenado'])
  })

  it('ficha do outro lado da parede: nem a ficha nem a condição saem para Ana', () => {
    const inicio = mapa('m-enfermaria', [ficha('lanterna', 200, 300), ficha('espiao', 900, 300, { conditions: ['dormindo'] })], [parede('muro', 500, 0, 500, 600)])
    const s = mesaCom(inicio)
    const r = s.broadcast(inicio)
    expect(mapaDoJogador(r).tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(textoPara(r)).not.toContain('dormindo')
  })

  it('ficha de OUTRA cena da aventura: a condição dela nunca chega a quem está nesta', () => {
    const enfermaria = mapa('m-enfermaria', [ficha('lanterna', 425, 325)])
    const cripta = mapa('m-cripta', [ficha('lich', 300, 300, { conditions: ['invisivel'] })])
    const mundo: HostWorld = {
      open: { sceneId: 's-enfermaria', name: 'Enfermaria', map: enfermaria },
      background: [{ sceneId: 's-cripta', name: 'Cripta', map: cripta }],
    }
    const s = mesaCom(mundo)
    const r = s.broadcast(mundo)
    expect(mapaDoJogador(r).tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(textoPara(r)).not.toContain('invisivel')
    expect(textoPara(r)).not.toContain('lich')
  })
})
