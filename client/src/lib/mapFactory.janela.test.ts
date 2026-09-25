import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/map'
import { createEmptyMap, setWallJanela } from './mapFactory'

/** 'Janela' na parede: liga numa parede sem porta; desligar devolve a parede comum, sem campo sobrando. */
function parede(id: string, extra: Partial<Wall> = {}): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, ...extra }
}

describe('setWallJanela', () => {
  it('liga e desliga; desligada fica idêntica à parede comum', () => {
    const map = { ...createEmptyMap('m', 'M', 10, 10, 50), walls: [parede('w'), parede('outra')] }
    const ligada = setWallJanela(map, 'w', true)
    expect(ligada.walls[0]).toEqual({ ...parede('w'), janela: true })
    expect(ligada.walls[1]).toBe(map.walls[1])
    const desligada = setWallJanela(ligada, 'w', false)
    expect(desligada.walls[0]).toEqual(parede('w'))
    expect('janela' in desligada.walls[0]).toBe(false)
  })

  it('parede com porta, id inexistente ou sem mudança: o mapa volta o mesmo', () => {
    const map = { ...createEmptyMap('m', 'M', 10, 10, 50), walls: [parede('p', { door: { open: false, locked: false, kind: 'normal' } }), parede('w')] }
    expect(setWallJanela(map, 'p', true)).toBe(map)
    expect(setWallJanela(map, 'nada', true)).toBe(map)
    expect(setWallJanela(map, 'w', false)).toBe(map)
  })
})
