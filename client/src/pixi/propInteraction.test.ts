import { describe, expect, it } from 'vitest'
import { findPropAt } from './propInteraction'
import type { Prop } from '../types/map'

const propA: Prop = { id: 'a', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }
const propB: Prop = { id: 'b', src: '/b.png', x: 200, y: 200, width: 64, height: 64, linkedMapPath: null }

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

describe('findPropAt — o tapete fica no chão', () => {
  const tapete: Prop = { id: 'tapete', src: '', x: 0, y: 0, width: 120, height: 80, linkedMapPath: null, mobilia: 'tapete' }
  const cadeira: Prop = { id: 'cadeira', src: '', x: 0, y: 0, width: 20, height: 20, linkedMapPath: null, mobilia: 'cadeira' }

  it('clicar na cadeira em cima do tapete pega a cadeira, mesmo com o tapete depois na lista', () => {
    expect(findPropAt([cadeira, tapete], { x: 5, y: 5 })?.id).toBe('cadeira')
    expect(findPropAt([tapete, cadeira], { x: 5, y: 5 })?.id).toBe('cadeira')
  })

  it('fora da cadeira, o tapete; entre dois tapetes, o de cima', () => {
    expect(findPropAt([cadeira, tapete], { x: 50, y: 30 })?.id).toBe('tapete')
    const outro: Prop = { ...tapete, id: 'outro' }
    expect(findPropAt([tapete, outro, cadeira], { x: 50, y: 30 })?.id).toBe('outro')
  })
})
