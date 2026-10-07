import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/map'
import { createEmptyMap, setWallColor, setWallPassagem } from './mapFactory'

/** Parede que deixa passar/ver e cor da parede (pedido de 07/10/2026). */
function parede(id: string, extra: Partial<Wall> = {}): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function mapa(...walls: Wall[]) {
  return { ...createEmptyMap('m', 'M', 10, 10, 50), walls }
}

describe('setWallPassagem', () => {
  it('deixa passar e deixa ver são independentes', () => {
    const map = mapa(parede('w'), parede('outra'))
    const passa = setWallPassagem(map, 'w', { blocksMove: false })
    expect(passa.walls[0]).toEqual(parede('w', { blocksMove: false }))
    expect(passa.walls[1]).toBe(map.walls[1])
    const passaEVe = setWallPassagem(passa, 'w', { blocksLight: false })
    expect(passaEVe.walls[0]).toEqual(parede('w', { blocksMove: false, blocksLight: false }))
  })

  it('sem mudança ou id inexistente: o mapa volta o mesmo', () => {
    const map = mapa(parede('w'))
    expect(setWallPassagem(map, 'w', { blocksMove: true })).toBe(map)
    expect(setWallPassagem(map, 'nada', { blocksMove: false })).toBe(map)
  })
})

describe('setWallColor', () => {
  it('troca a cor e Padrão tira o campo', () => {
    const map = mapa(parede('w'))
    const vermelha = setWallColor(map, 'w', '#ff0000')
    expect(vermelha.walls[0].color).toBe('#ff0000')
    const padrao = setWallColor(vermelha, 'w', null)
    expect(padrao.walls[0]).toEqual(parede('w'))
    expect('color' in padrao.walls[0]).toBe(false)
  })

  it('mesma cor: o mapa volta o mesmo', () => {
    const map = mapa(parede('w', { color: '#123456' }))
    expect(setWallColor(map, 'w', '#123456')).toBe(map)
    expect(setWallColor(mapa(parede('w')), 'w', null).walls[0]).toEqual(parede('w'))
  })
})
