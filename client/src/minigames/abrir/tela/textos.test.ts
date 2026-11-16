// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { jogoDoObjetoDaMobilia } from '../objeto'
import { linhaDaArmadilha, resumoDoAchado } from './textos'

describe('cartão de resultado', () => {
  it('a linha da armadilha diz o dano e o efeito com os turnos; sem armadilha, nada', () => {
    expect(linhaDaArmadilha({ armadilha: 'cobra', dano: 8, efeito: 'Envenenado', turnos: 3 })).toBe('A cobra picou: -8 PV. Envenenado por 3 turnos.')
    expect(linhaDaArmadilha({ armadilha: 'aranha', dano: 5, efeito: 'Lento', turnos: 2 })).toBe('A aranha picou: -5 PV. Lento por 2 turnos.')
    expect(linhaDaArmadilha({ armadilha: null, dano: 0, efeito: null, turnos: 0 })).toBeNull()
  })

  it('o achado vazio, com tudo opcional zerado, vira "Estava vazio."', () => {
    expect(resumoDoAchado({ itens: [], moedas: 0 })).toBe('Estava vazio.')
    expect(resumoDoAchado({ itens: [{ nome: 'Corda', quantidade: 1 }, { nome: 'Poção', quantidade: 2 }], moedas: 1 })).toBe('Achou: Corda, Poção (2), 1 moeda.')
  })
})

describe('jogo de cada móvel', () => {
  it('baú, caixa e barril têm cada um o seu jogo', () => {
    expect(jogoDoObjetoDaMobilia('bau')).toBe('bau')
    expect(jogoDoObjetoDaMobilia('caixa')).toBe('caixa')
    expect(jogoDoObjetoDaMobilia('barril')).toBe('barril')
  })
})
