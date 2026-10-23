import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { criarMovel, movelComOutroTipo } from './mobilia'

/*
 * "Tipo" do painel trocando para uma PEÇA NOVA (MT4): a peça nova sai sempre
 * com textura e o painel dela não tem "Preencher" (nem como religar), então o
 * "Preencher" desligado do móvel de antes não vai junto. As cores vão: o
 * desenho lê o material mais perto delas.
 */

const GRADE = 50

const mesaSemFundo: Prop = {
  ...criarMovel('mesa', { x: 300, y: 200 }, GRADE, 'm1'),
  mobiliaPreenchido: false,
  mobiliaCor: '#8b4513',
  mobiliaCorDaLinha: '#c0392b',
}

describe('movelComOutroTipo para uma peça nova', () => {
  it('não herda o "Preencher" desligado; as cores e o resto ficam', () => {
    const poco = movelComOutroTipo(mesaSemFundo, 'poco', GRADE)
    expect(poco).not.toHaveProperty('mobiliaPreenchido')
    expect(poco.mobilia).toBe('poco')
    expect(poco.mobiliaCor).toBe('#8b4513')
    expect(poco.mobiliaCorDaLinha).toBe('#c0392b')
    expect({ x: poco.x, y: poco.y }).toEqual({ x: 300, y: 200 })
  })

  it('vale para as 9 peças novas, e a de lado (barraca, carroça) também', () => {
    for (const tipo of ['mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca'] as const) {
      expect(movelComOutroTipo(mesaSemFundo, tipo, GRADE), tipo).not.toHaveProperty('mobiliaPreenchido')
    }
  })

  it('entre os móveis de antes o "Preencher" desligado continua indo junto', () => {
    expect(movelComOutroTipo(mesaSemFundo, 'bau', GRADE).mobiliaPreenchido).toBe(false)
  })

  it('móvel sem nenhum campo opcional vira peça nova sem ganhar campo nenhum', () => {
    const caixa = criarMovel('caixa', { x: 0, y: 0 }, GRADE, 'c1')
    const vaso = movelComOutroTipo(caixa, 'vaso', GRADE)
    expect(Object.keys(vaso).sort()).toEqual(Object.keys(caixa).sort())
  })
})
