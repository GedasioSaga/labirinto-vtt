import { describe, expect, it } from 'vitest'
import type { Token, Wall } from '../types/map'
import { DOOR_REACH_CELLS, distanceToWall, findDoorAt, tokenReachesDoor } from './doorReach'

const GRID = 50

function door(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
}

function token(x: number, y: number, size = 1): Token {
  return { id: 't', characterId: null, name: 'Heroi', x, y, size, image: null }
}

describe('distanceToWall', () => {
  it('mede até o SEGMENTO, não até a linha infinita', () => {
    const wall = door('w', 100, 100, 100, 200)
    expect(distanceToWall({ x: 130, y: 150 }, wall)).toBe(30)
    // Além da ponta: a distância é até a ponta (40), não até a linha (30).
    expect(distanceToWall({ x: 130, y: 240 }, wall)).toBeCloseTo(50, 9)
  })

  it('parede de comprimento zero: distância até o ponto', () => {
    expect(distanceToWall({ x: 3, y: 4 }, door('w', 0, 0, 0, 0))).toBe(5)
  })
})

describe('tokenReachesDoor', () => {
  const wall = door('w', 100, 100, 100, 200)

  it('alcança até 1 célula da borda do token e não além', () => {
    // Token de 1 célula: raio 25; alcance 25 + 50 = 75.
    expect(tokenReachesDoor(token(175, 150), wall, GRID)).toBe(true)
    expect(tokenReachesDoor(token(176, 150), wall, GRID)).toBe(false)
    expect(DOOR_REACH_CELLS).toBe(1)
  })

  it('token maior alcança de mais longe (o raio entra na conta)', () => {
    expect(tokenReachesDoor(token(200, 150, 2), wall, GRID)).toBe(true)
  })

  it('parede sem porta nunca é alcançada', () => {
    expect(tokenReachesDoor(token(101, 150), { ...wall, door: null }, GRID)).toBe(false)
  })
})

describe('findDoorAt', () => {
  const perto = door('perto', 100, 100, 100, 200)
  const longe = door('longe', 400, 100, 400, 200)
  const solida: Wall = { ...perto, id: 'solida', x1: 110, y1: 100, x2: 110, y2: 200, door: null }

  it('devolve a porta mais próxima dentro da tolerância e ignora parede sólida', () => {
    expect(findDoorAt([solida, perto, longe], { x: 108, y: 150 }, 20)?.id).toBe('perto')
    expect(findDoorAt([solida, perto, longe], { x: 130, y: 150 }, 20)).toBeNull()
  })

  it('entre duas portas, escolhe a de menor distância', () => {
    const outra = door('outra', 150, 100, 150, 200)
    expect(findDoorAt([perto, outra], { x: 140, y: 150 }, 60)?.id).toBe('outra')
  })
})
