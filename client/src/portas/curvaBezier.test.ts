import { describe, expect, it } from 'vitest'
import { criarCurvaBezier, curvaBezierEmCss, curvaBezierValida } from './curvaBezier'
import { easeOutCubic } from '../transicoes/curvas'

/** CURVA DE TEMPO POR SENTIDO da porta (22/10/2026): cubic-bezier com os 4 números em [0, 1]. */
describe('curvaBezier', () => {
  it('válida só com 4 números finitos entre 0 e 1 (assim nunca volta nem passa do alvo)', () => {
    expect(curvaBezierValida([0.37, 0, 0.63, 1])).toBe(true)
    expect(curvaBezierValida([0, 0, 1, 1])).toBe(true)
    for (const torta of [[0.3, -0.1, 0.6, 1], [0.3, 0, 0.6, 1.2], [0.3, 0, 0.6], [0.3, 0, 0.6, 1, 0], [0.3, 0, Number.NaN, 1], ['0.3', 0, 0.6, 1], 'ease', null, undefined]) {
      expect(curvaBezierValida(torta)).toBe(false)
    }
  })

  it('a linear é a identidade, e as pontas são 0 e 1', () => {
    const linear = criarCurvaBezier([0, 0, 1, 1])
    for (const t of [0, 0.1, 0.33, 0.5, 0.9, 1]) expect(linear(t)).toBeCloseTo(t, 6)
    const qualquer = criarCurvaBezier([0.7, 0, 0.84, 0])
    expect(qualquer(0)).toBe(0)
    expect(qualquer(1)).toBe(1)
  })

  it('bate com a easeOutCubic de sempre no cubic-bezier(0.33, 1, 0.68, 1) dela', () => {
    const curva = criarCurvaBezier([0.33, 1, 0.68, 1])
    for (let i = 0; i <= 20; i += 1) expect(Math.abs(curva(i / 20) - easeOutCubic(i / 20))).toBeLessThan(0.02)
  })

  it('toda curva válida sobe sempre e fica em [0, 1]: 2000 pontos, 200 curvas sorteadas', () => {
    let semente = 7
    const sorteio = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648
      return semente / 2147483648
    }
    const tortas: string[] = []
    for (let k = 0; k < 200; k += 1) {
      const pontos = [sorteio(), sorteio(), sorteio(), sorteio()] as const
      const curva = criarCurvaBezier([...pontos])
      let anterior = 0
      for (let i = 0; i <= 2000; i += 1) {
        const y = curva(i / 2000)
        if (y < anterior - 1e-9 || y < 0 || y > 1) tortas.push(`${pontos.join(',')} em ${i / 2000}: ${y}`)
        anterior = y
      }
    }
    expect(tortas).toEqual([])
  })

  it('em CSS, para a medalha da ficha andar na mesma curva', () => {
    expect(curvaBezierEmCss([0.37, 0, 0.63, 1])).toBe('cubic-bezier(0.37, 0, 0.63, 1)')
  })
})
