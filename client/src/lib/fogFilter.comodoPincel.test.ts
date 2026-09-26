import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer } from './fogFilter'
import { paintRevealBrush } from './concealBrush'
import type { ConcealZone, MapData, Region, RegionPoint, Token } from '../types/map'

/**
 * CÔMODO LEMBRADO + PINCEL DE REVELAR (juntados em auto/juntar). O pincel
 * mostra só o pedaço pintado da zona oculta; o cômodo, quando "visto", sai
 * INTEIRO. Juntos, o corredor pintado que passa por dentro de um cômodo não
 * pode torná-lo "visto": senão o polígono e o nome do cômodo inteiro — que a
 * zona ainda esconde quase todo — iam para o jogador.
 *
 * Mesma cena de `fogFilter.pincel.test.ts`: zona na metade direita, traço do
 * pincel em y = 450, Lanterna da Ana fora da zona, sem paredes.
 */

const RAIO_VISAO = 700
const DONO = { ana: ['tok-lanterna'] }
const TRACO: RegionPoint[] = [
  { x: 560, y: 450 },
  { x: 700, y: 450 },
  { x: 940, y: 450 },
]
const RAIO_PINCEL = 25

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function comodo(id: string, x1: number, y1: number, x2: number, y2: number, name: string): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#123',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name, comodo: true },
  }
}

function cena(regions: Region[]): MapData {
  const zona: ConcealZone = {
    id: 'zona-ala-leste',
    name: 'Ala leste secreta',
    revealed: false,
    points: [
      { x: 500, y: 20 },
      { x: 980, y: 20 },
      { x: 980, y: 580 },
      { x: 500, y: 580 },
    ],
  }
  return {
    ...createEmptyMap('m', 'Ala do Pincel', 20, 12, 50),
    tokens: [ficha('tok-lanterna', 'Lanterna', 420, 300)],
    concealZones: [zona],
    regions,
  }
}

const pintado = (mapa: MapData): MapData => paintRevealBrush(mapa, TRACO, RAIO_PINCEL, 'revelar', 0).map

describe('cômodo lembrado + pincel de revelar', () => {
  it('SEGURANÇA: cômodo dentro da zona NÃO sai quando o traço do pincel passa por ele — com visão longa ou curta', () => {
    const mapa = cena([comodo('comodo-arsenal', 520, 300, 960, 570, 'Arsenal')])
    expect(filterMapForPlayer(mapa, 'ana', DONO, RAIO_VISAO).map.regions).toEqual([])
    for (const raio of [RAIO_VISAO, 50]) {
      const view = filterMapForPlayer(pintado(mapa), 'ana', DONO, raio)
      expect(view.map.regions, `raio ${raio}`).toEqual([])
      expect(view.rememberedRooms, `raio ${raio}`).toEqual([])
      expect(JSON.stringify(view), `raio ${raio}`).not.toContain('Arsenal')
    }
  })

  it('controle: o cômodo que cabe inteiro no pedaço pintado sai, e fica lembrado', () => {
    const mapa = cena([comodo('comodo-no-corredor', 600, 440, 680, 460, 'Nicho')])
    const view = filterMapForPlayer(pintado(mapa), 'ana', DONO, RAIO_VISAO)
    expect(view.map.regions.map((r) => r.id)).toEqual(['comodo-no-corredor'])
    expect(view.rememberedRooms.map((r) => r.id)).toEqual(['comodo-no-corredor'])
  })
})
