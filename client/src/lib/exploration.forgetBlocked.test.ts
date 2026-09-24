import { describe, expect, it } from 'vitest'
import { countExploredCells, createExploration, forgetBlocked, isPointExplored, markRings } from './exploration'
import type { RegionPoint } from '../types/map'

/**
 * Memória retomada contra área proibida nova: o que o mestre escondeu depois
 * (zona oculta, sala secreta) sai inteiro — até a célula que só encosta nela e
 * o contorno lembrado que passa por ela —, e o resto fica.
 */

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

describe('forgetBlocked: área proibida que apareceu depois da memória', () => {
  it('apaga toda célula que toca a área e o contorno que encosta nela; o resto continua lembrado', () => {
    const exp = createExploration({ width: 1000, height: 400, grid: 40 })
    markRings(exp, [retangulo(0, 0, 1000, 400)])
    const antes = countExploredCells(exp)
    expect(exp.rings.length).toBe(1)
    // Área proibida que NÃO cai na grade de células (célula de 10 px): a borda só encosta.
    forgetBlocked(exp, [retangulo(505, 105, 695, 295)])
    expect(isPointExplored(exp, { x: 600, y: 200 })).toBe(false)
    // Célula da borda, que só encosta na área (x 500..510), também sai.
    expect(isPointExplored(exp, { x: 502, y: 200 })).toBe(false)
    expect(isPointExplored(exp, { x: 698, y: 200 })).toBe(false)
    // O contorno que passa por cima dela sai; longe dela, as células continuam.
    expect(exp.rings).toEqual([])
    expect(exp.ringVertices).toBe(0)
    expect(isPointExplored(exp, { x: 100, y: 100 })).toBe(true)
    // 20 x 20 células de 10 px tocadas (colunas 500..700 e linhas 100..300), nenhuma a mais.
    expect(antes).toBe(100 * 40)
    expect(countExploredCells(exp)).toBe(antes - 20 * 20)
  })

  it('sem área proibida, nada muda', () => {
    const exp = createExploration({ width: 1000, height: 400, grid: 40 })
    markRings(exp, [retangulo(0, 0, 1000, 400)])
    const antes = countExploredCells(exp)
    forgetBlocked(exp, [])
    expect(countExploredCells(exp)).toBe(antes)
    expect(exp.rings.length).toBe(1)
  })
})
