/**
 * LUZ VISTA DE LONGE, lado do FIO: o que sai pelo WebSocket da Duda quando uma
 * luz marcada "Vista de longe" está fora do raio dela, com linha de visão
 * livre. Chega um ponto (raio 0), nunca o halo nem a ficha que carrega a luz;
 * atrás de parede, nada. E a Sala com "Raio de visão aqui" muda o que a Duda
 * recebe enquanto a ficha dela está lá dentro — sem o número ir junto.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Light, MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'LUZ001'

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y: 500, size: 1, image: null, ...extra }
}

function mapa(patch: Partial<MapData>): MapData {
  return { ...createEmptyMap('m-pico', 'Pico', 3000, 1000, 50), ...patch }
}

const FAROL: Light = { id: 'farol', x: 2500, y: 500, radius: 300, color: '#ffcc00', intensity: 0.8, vistaDeLonge: true, attachedTokenId: 'vigia' }
const MURO: Wall = { id: 'muro', x1: 1200, y1: 0, x2: 1200, y2: 1000, blocksLight: true, blocksMove: true, door: null }
const MIRANTE: Region = {
  id: 'mirante',
  points: [
    { x: 100, y: 400 },
    { x: 300, y: 400 },
    { x: 300, y: 600 },
    { x: 100, y: 600 },
  ],
  tag: '',
  fillColor: '#123',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Mirante', raioDeVisao: 1500 },
}

function mesaCom(source: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Duda' }, source)
  const welcome = entrou.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'duda')
  return s
}

function mapaNoFio(r: HostResult): MapData {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error('esperava o mapa da Duda')
  return msg.map
}

describe('fio da Duda: luz vista de longe', () => {
  it('campo aberto: chega o ponto da luz, com raio 0 e sem a ficha que a carrega', () => {
    const pico = mapa({ tokens: [ficha('duda', 200), ficha('vigia', 2500)], lights: [FAROL] })
    const s = mesaCom(pico)
    const noFio = mapaNoFio(s.broadcast(pico))
    expect(noFio.lights.map((l) => [l.id, l.x, l.y, l.radius])).toEqual([['farol', 2500, 500, 0]])
    expect(noFio.tokens.map((t) => t.id)).toEqual(['duda'])
    expect(JSON.stringify(noFio)).not.toContain('vigia')
  })

  it('muro no caminho: nem o ponto chega', () => {
    const pico = mapa({ tokens: [ficha('duda', 200), ficha('vigia', 2500)], lights: [FAROL], walls: [MURO] })
    const s = mesaCom(pico)
    const noFio = mapaNoFio(s.broadcast(pico))
    expect(noFio.lights).toEqual([])
    expect(JSON.stringify(noFio)).not.toContain('farol')
  })
})

describe('fio da Duda: raio de visão da sala', () => {
  it('dentro do mirante ela vê longe; o número do raio não vai junto', () => {
    const pico = mapa({ tokens: [ficha('duda', 200), ficha('estatua', 1400)], regions: [MIRANTE] })
    const s = mesaCom(pico)
    const noFio = mapaNoFio(s.broadcast(pico))
    expect(noFio.tokens.map((t) => t.id).sort()).toEqual(['duda', 'estatua'])
    expect(JSON.stringify(noFio)).not.toContain('raioDeVisao')
  })

  it('fora do mirante vale o raio dela, 700', () => {
    const pico = mapa({ tokens: [ficha('duda', 200), ficha('estatua', 1400)], regions: [{ ...MIRANTE, points: MIRANTE.points.map((p) => ({ x: p.x + 2000, y: p.y })) }] })
    const s = mesaCom(pico)
    const noFio = mapaNoFio(s.broadcast(pico))
    expect(noFio.tokens.map((t) => t.id)).toEqual(['duda'])
  })
})
