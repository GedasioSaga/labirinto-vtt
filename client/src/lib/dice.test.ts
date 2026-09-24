/**
 * DADO ROLADO NA SALA, a parte pura: a expressão que a mesa lê ("2d6+3"), a
 * rolagem (quem rola é o host, com o dado injetável para o teste) e a
 * validação do pedido que chega do jogador.
 */
import { describe, expect, it } from 'vitest'
import {
  DICE_COUNT_MAX,
  DICE_MODIFIER_LIMIT,
  DICE_SIDES,
  MASTER_ROLLER_NAME,
  formatDiceExpression,
  formatDiceTotal,
  parseDiceRequest,
  rollDice,
  rollerLabel,
  secureRollDie,
  type DiceRollEntry,
} from './dice'

describe('dice: expressão em notação padrão', () => {
  it('quantidade, dado e modificador, com o sinal certo', () => {
    expect(formatDiceExpression({ count: 2, sides: 6, modifier: 3 })).toBe('2d6+3')
    expect(formatDiceExpression({ count: 1, sides: 20, modifier: 0 })).toBe('1d20')
    // Menos tipográfico: é o que a tela mostra, e o leitor de tela lê "menos".
    expect(formatDiceExpression({ count: 1, sides: 4, modifier: -5 })).toBe('1d4−5')
  })

  it('total negativo sai com o mesmo menos da expressão; positivo, sem sinal', () => {
    expect(formatDiceTotal(-3)).toBe('−3')
    expect(formatDiceTotal(12)).toBe('12')
    expect(formatDiceTotal(0)).toBe('0')
  })
})

describe('dice: rolagem', () => {
  it('rola um dado por quantidade e soma o modificador', () => {
    const faces = [5, 4]
    const rolagem = rollDice({ count: 2, sides: 6, modifier: 3 }, () => faces.shift() ?? 1)
    expect(rolagem).toEqual({ results: [5, 4], total: 12 })
  })

  it('modificador negativo pode levar o total abaixo de zero', () => {
    expect(rollDice({ count: 1, sides: 4, modifier: -5 }, () => 2)).toEqual({ results: [2], total: -3 })
  })

  it('o dado seguro cai sempre entre 1 e o número de lados, e todas as faces saem', () => {
    for (const sides of DICE_SIDES) {
      const vistas = new Set<number>()
      for (let i = 0; i < sides * 60; i += 1) vistas.add(secureRollDie(sides))
      const faces = [...vistas]
      expect(Math.min(...faces)).toBeGreaterThanOrEqual(1)
      expect(Math.max(...faces)).toBeLessThanOrEqual(sides)
      expect(vistas.size).toBe(sides)
    }
  })
})

describe('dice: pedido do jogador é hostil', () => {
  it('pedido válido volta só com os três campos', () => {
    expect(parseDiceRequest({ count: 2, sides: 6, modifier: 3, results: [6, 6], total: 15 })).toEqual({ count: 2, sides: 6, modifier: 3 })
  })

  it('dado que não existe na mesa, quantidade ou modificador fora da faixa recusam', () => {
    expect(parseDiceRequest({ count: 1, sides: 7, modifier: 0 })).toBeNull()
    expect(parseDiceRequest({ count: 0, sides: 6, modifier: 0 })).toBeNull()
    expect(parseDiceRequest({ count: DICE_COUNT_MAX + 1, sides: 6, modifier: 0 })).toBeNull()
    expect(parseDiceRequest({ count: 1.5, sides: 6, modifier: 0 })).toBeNull()
    expect(parseDiceRequest({ count: 1, sides: 6, modifier: DICE_MODIFIER_LIMIT + 1 })).toBeNull()
    expect(parseDiceRequest({ count: 1, sides: 6, modifier: -DICE_MODIFIER_LIMIT - 1 })).toBeNull()
    expect(parseDiceRequest({ count: 1, sides: 6 })).toBeNull()
    expect(parseDiceRequest({ count: '2', sides: 6, modifier: 0 })).toBeNull()
    expect(parseDiceRequest(null)).toBeNull()
  })

  it('as pontas da faixa valem', () => {
    expect(parseDiceRequest({ count: DICE_COUNT_MAX, sides: 20, modifier: -DICE_MODIFIER_LIMIT })).toEqual({ count: DICE_COUNT_MAX, sides: 20, modifier: -DICE_MODIFIER_LIMIT })
  })
})

describe('dice: quem rolou', () => {
  const base: DiceRollEntry = { id: 'r1', from: 'Ana', count: 1, sides: 20, modifier: 0, results: [7], total: 7, at: 0 }

  it('jogador aparece pelo nome; o mestre, como "Mestre"', () => {
    expect(rollerLabel(base)).toBe('Ana')
    expect(rollerLabel({ ...base, from: MASTER_ROLLER_NAME, master: true })).toBe('Mestre')
  })

  it('jogador que entrou com o nome "Mestre" não se passa pelo mestre', () => {
    expect(rollerLabel({ ...base, from: 'mestre' })).toBe('mestre (jogador)')
    expect(rollerLabel({ ...base, from: 'Mestre' })).toBe('Mestre (jogador)')
  })
})
