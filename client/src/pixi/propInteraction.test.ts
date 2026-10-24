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

describe('findPropAt — objeto girado (revisão da MT5)', () => {
  // Sebe de 2 x 0,5 casa (100 x 25) girada 90°: na tela ela fica em pé (25 x 100).
  const sebe: Prop = { id: 'sebe', src: '', x: 0, y: 0, width: 100, height: 25, linkedMapPath: null, mobilia: 'sebe', rotation: 90 }

  it('o clique no desenho girado pega o objeto; fora dele (onde só a caixa sem giro passava), não', () => {
    expect(findPropAt([sebe], { x: 0, y: 45 })?.id).toBe('sebe')
    expect(findPropAt([sebe], { x: 5, y: -45 })?.id).toBe('sebe')
    expect(findPropAt([sebe], { x: 45, y: 0 })).toBeNull()
  })

  it('giro de 45°: a ponta da diagonal pega, o canto da caixa sem giro não', () => {
    const tapete: Prop = { id: 'longo', src: '', x: 0, y: 0, width: 200, height: 50, linkedMapPath: null, mobilia: 'tapeteLongo', rotation: 45 }
    expect(findPropAt([tapete], { x: 63, y: 63 })?.id).toBe('longo')
    expect(findPropAt([tapete], { x: 95, y: -20 })).toBeNull()
  })

  it('sem giro (ou giro 0), a caixa de sempre', () => {
    expect(findPropAt([{ ...sebe, rotation: 0 }], { x: 45, y: 0 })?.id).toBe('sebe')
    expect(findPropAt([{ ...sebe, rotation: undefined }], { x: 45, y: 0 })?.id).toBe('sebe')
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
