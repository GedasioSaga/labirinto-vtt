import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../types/map'
import { comCegueira, filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
import { createEmptyMap } from './mapFactory'

/**
 * CEGUEIRA (protótipo aprovado em 23/11/2026): a ficha cega vê com a metade do
 * raio; quem está até o raio normal e não saiu no recorte vira onda (só x/y).
 * A parede não para a onda. Casa de 50 px; raio normal de 6 casas (300 px).
 */

const POSSE = { carla: ['aira'] }
const RAIO = 300

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `Nome ${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function mapa(walls: Wall[] = []): MapData {
  return {
    ...createEmptyMap('m', 'M', 40, 20, 50),
    // Aira no centro; Mimi a 2 casas, Urso a 4, Soldado a 2,8 na diagonal, Cisco a 8 (fora).
    tokens: [ficha('aira', 500, 500), ficha('mimi', 600, 500), ficha('urso', 700, 500), ficha('soldado', 400, 400), ficha('cisco', 900, 500)],
    walls,
  }
}

function ve(vision: readonly (readonly { x: number; y: number }[])[], x: number, y: number): boolean {
  return vision.some((ring) => pointInRing({ x, y }, [...ring]))
}

const raioCego = () => comCegueira((_tokenId: string) => RAIO, new Set(['aira']))

describe('fogFilter: cegueira', () => {
  it('a cega vê a metade do raio e sente o resto como onda, sem id nem nome', () => {
    const view = filterMapForPlayer(mapa(), 'carla', POSSE, raioCego())
    expect(ve(view.vision, 600, 500)).toBe(true)
    expect(ve(view.vision, 700, 500)).toBe(false)
    // Sem parede o Soldado (2,8 casas na diagonal) está dentro da metade: é visto.
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['aira', 'mimi', 'soldado'])
    // Urso (4 casas) é onda; Cisco (8 casas) está fora.
    expect(view.ondas).toEqual([{ x: 700, y: 500 }])
    const fio = JSON.stringify({ map: view.map, vision: view.vision, ondas: view.ondas })
    for (const segredo of ['urso', 'cisco', 'Nome urso', 'Nome cisco']) expect(fio).not.toContain(segredo)
  })

  it('a parede não para a onda; sem cegueira não há onda e a parede tapa como sempre', () => {
    // Parede entre a Aira e o Soldado (a 2 casas na diagonal: dentro da metade, mas atrás da parede).
    const comParede = mapa([parede('p', 450, 0, 450, 470)])
    const cega = filterMapForPlayer(comParede, 'carla', POSSE, raioCego())
    expect(cega.map.tokens.some((t) => t.id === 'soldado')).toBe(false)
    expect(cega.ondas).toContainEqual({ x: 400, y: 400 })
    const normal = filterMapForPlayer(comParede, 'carla', POSSE, RAIO)
    expect(normal.ondas).toBeUndefined()
    expect(normal.map.tokens.map((t) => t.id).sort()).toEqual(['aira', 'mimi', 'urso'])
  })
})
