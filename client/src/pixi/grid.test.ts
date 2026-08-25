import { describe, expect, it } from 'vitest'
import { computeVisibleGridLines } from './grid'

describe('computeVisibleGridLines', () => {
  it('retorna vazio para cellSize inválido', () => {
    expect(computeVisibleGridLines(0, { left: 0, top: 0, right: 100, bottom: 100 })).toEqual([])
    expect(computeVisibleGridLines(-5, { left: 0, top: 0, right: 100, bottom: 100 })).toEqual([])
  })

  it('viewport alinhado ao grid gera linhas nas posições exatas', () => {
    const lines = computeVisibleGridLines(50, { left: 0, top: 0, right: 100, bottom: 100 })
    const xs = lines.filter((l) => l.axis === 'x').map((l) => l.position)
    const ys = lines.filter((l) => l.axis === 'y').map((l) => l.position)
    expect(xs).toEqual([0, 50, 100])
    expect(ys).toEqual([0, 50, 100])
  })

  it('viewport desalinhado começa na primeira linha de grid antes do canto', () => {
    const lines = computeVisibleGridLines(50, { left: 10, top: 10, right: 90, bottom: 90 })
    const xs = lines.filter((l) => l.axis === 'x').map((l) => l.position)
    expect(xs[0]).toBe(0)
    expect(xs[xs.length - 1]).toBeGreaterThanOrEqual(90)
  })
})
