import { describe, expect, it } from 'vitest'
import type { DoorState, Wall } from '../types/map'
import { doorOpensFrom, sideOfWall } from './doorReach'

/**
 * Lado de uma parede: 'right' é a direita de quem anda de (x1,y1) para (x2,y2)
 * na tela (y cresce para baixo). Porta horizontal (0,0)->(100,0): 'right' é
 * embaixo (y > 0), 'left' é em cima.
 */
function porta(door: Partial<DoorState>): Wall {
  return { id: 'p', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', ...door } }
}

describe('doorReach: porta de um lado', () => {
  it('sideOfWall: embaixo é right, em cima é left, em cima da linha é null', () => {
    const w = porta({})
    expect(sideOfWall({ x: 50, y: 20 }, w)).toBe('right')
    expect(sideOfWall({ x: 50, y: -20 }, w)).toBe('left')
    expect(sideOfWall({ x: 50, y: 0 }, w)).toBeNull()
    // Invertendo o sentido da parede, os lados trocam.
    expect(sideOfWall({ x: 50, y: 20 }, { ...w, x1: 100, x2: 0 })).toBe('left')
  })

  it('doorOpensFrom: sem o campo abre dos dois lados; com o campo, só daquele lado', () => {
    expect(doorOpensFrom(porta({}), { x: 50, y: 20 })).toBe(true)
    expect(doorOpensFrom(porta({}), { x: 50, y: -20 })).toBe(true)
    expect(doorOpensFrom(porta({ opensFrom: 'right' }), { x: 50, y: 20 })).toBe(true)
    expect(doorOpensFrom(porta({ opensFrom: 'right' }), { x: 50, y: -20 })).toBe(false)
    expect(doorOpensFrom(porta({ opensFrom: 'left' }), { x: 50, y: -20 })).toBe(true)
    // No vão (em cima da linha) não há lado errado.
    expect(doorOpensFrom(porta({ opensFrom: 'left' }), { x: 50, y: 0 })).toBe(true)
  })
})
