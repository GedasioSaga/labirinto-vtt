import { describe, expect, it } from 'vitest'
import { findPropAt } from './propInteraction'
import type { Prop } from '../types/map'

const propA: Prop = { id: 'a', src: '/a.png', x: 0, y: 0, width: 64, height: 64 }
const propB: Prop = { id: 'b', src: '/b.png', x: 200, y: 200, width: 64, height: 64 }

describe('findPropAt', () => {
  it('retorna o prop cujo retângulo contém o ponto', () => {
    expect(findPropAt([propA, propB], { x: 10, y: -10 })?.id).toBe('a')
  })

  it('retorna null fora de qualquer retângulo', () => {
    expect(findPropAt([propA, propB], { x: 1000, y: 1000 })).toBeNull()
  })

  it('ponto exatamente na borda conta como dentro', () => {
    expect(findPropAt([propA], { x: 32, y: 0 })?.id).toBe('a')
  })

  it('quando dois props se sobrepõem, retorna o do topo (último do array)', () => {
    const overlappingB: Prop = { ...propB, x: 0, y: 0 }
    expect(findPropAt([propA, overlappingB], { x: 0, y: 0 })?.id).toBe('b')
  })
})
