import { describe, expect, it } from 'vitest'
import { snapToGrid, findTokenAt } from './tokenInteraction'
import type { Token } from '../types/map'

describe('snapToGrid', () => {
  it('arredonda pro múltiplo mais próximo', () => {
    expect(snapToGrid(30, 40, 64)).toEqual({ x: 0, y: 64 })
    expect(snapToGrid(10, 10, 64)).toEqual({ x: 0, y: 0 })
  })

  it('gridSize inválido retorna o ponto sem alterar', () => {
    expect(snapToGrid(33, 47, 0)).toEqual({ x: 33, y: 47 })
  })
})

const tokenA: Token = { id: 'a', characterId: null, name: 'A', x: 0, y: 0, size: 1 }
const tokenB: Token = { id: 'b', characterId: null, name: 'B', x: 100, y: 100, size: 1 }

describe('findTokenAt', () => {
  it('retorna o token dentro do raio de clique', () => {
    const hit = findTokenAt([tokenA, tokenB], { x: 5, y: 5 }, 64)
    expect(hit?.id).toBe('a')
  })

  it('retorna null quando não há token perto', () => {
    const hit = findTokenAt([tokenA, tokenB], { x: 500, y: 500 }, 64)
    expect(hit).toBeNull()
  })

  it('quando dois tokens se sobrepõem, retorna o do topo (último do array)', () => {
    const overlappingB: Token = { ...tokenB, x: 0, y: 0 }
    const hit = findTokenAt([tokenA, overlappingB], { x: 0, y: 0 }, 64)
    expect(hit?.id).toBe('b')
  })
})
