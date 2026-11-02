/**
 * Ordem da iniciativa (docs/planos/dbt-batalha.md, seção 5): 20 natural na
 * frente (entre eles, a DES bruta), o resto pelo total e a DES no empate;
 * empate de tudo rola de novo.
 */
import { describe, expect, it } from 'vitest'
import { ordenarIniciativa } from './ordem'

function rolagens(valores: readonly number[]): () => number {
  let i = 0
  return () => {
    const valor = valores[i % valores.length]
    i += 1
    return valor
  }
}

describe('ordenarIniciativa', () => {
  it('20 natural vai na frente mesmo com total menor', () => {
    const { ordem } = ordenarIniciativa(
      [
        { id: 'a', d20: 19, total: 30, destreza: 10 },
        { id: 'b', d20: 20, total: 22, destreza: 10 },
      ],
      rolagens([1]),
    )
    expect(ordem).toEqual(['b', 'a'])
  })

  it('total igual: a DES maior vai primeiro, sem rolar', () => {
    const rolar = rolagens([7])
    const { ordem, desempates } = ordenarIniciativa(
      [
        { id: 'a', d20: 10, total: 18, destreza: 12 },
        { id: 'b', d20: 11, total: 18, destreza: 16 },
      ],
      rolar,
    )
    expect(ordem).toEqual(['b', 'a'])
    expect(desempates.size).toBe(0)
  })

  it('total e DES iguais: rola de novo e guarda o desempate', () => {
    const { ordem, desempates } = ordenarIniciativa(
      [
        { id: 'a', d20: 10, total: 18, destreza: 14 },
        { id: 'b', d20: 10, total: 18, destreza: 14 },
      ],
      rolagens([5, 12]),
    )
    expect(ordem).toEqual(['b', 'a'])
    expect(desempates.get('a')).toBe(5)
    expect(desempates.get('b')).toBe(12)
  })
})
