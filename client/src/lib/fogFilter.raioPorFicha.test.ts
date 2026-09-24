import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
import { createEmptyMap } from './mapFactory'

/**
 * RAIO POR FICHA: o jogador que joga uma ficha emprestada vê em volta dela com
 * o raio do DONO, e em volta da própria com o dele. O raio como número continua
 * valendo para todas as fichas.
 */

const POSSE = { carla: ['escudo', 'lirio'] }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function mapa(): MapData {
  return { ...createEmptyMap('m', 'M', 40, 20, 50), tokens: [ficha('escudo', 300, 500), ficha('lirio', 1600, 500)] }
}

function ve(vision: readonly (readonly { x: number; y: number }[])[], x: number, y: number): boolean {
  return vision.some((ring) => pointInRing({ x, y }, [...ring]))
}

describe('fogFilter: raio de visão por ficha', () => {
  it('cada ficha enxerga com o próprio raio: 300 no Lírio, 700 no Escudo', () => {
    const raio = (tokenId: string): number => (tokenId === 'lirio' ? 300 : 700)
    const view = filterMapForPlayer(mapa(), 'carla', POSSE, raio)
    expect(view.vision).toHaveLength(2)
    // Lírio: 200 px dentro, 450 px fora.
    expect(ve(view.vision, 1400, 500)).toBe(true)
    expect(ve(view.vision, 1600, 50)).toBe(false)
    // Escudo: 600 px dentro.
    expect(ve(view.vision, 900, 500)).toBe(true)
  })

  it('raio como número vale para todas as fichas, como antes', () => {
    const view = filterMapForPlayer(mapa(), 'carla', POSSE, 700)
    expect(ve(view.vision, 1600, 50)).toBe(true)
    expect(ve(view.vision, 900, 500)).toBe(true)
  })
})
