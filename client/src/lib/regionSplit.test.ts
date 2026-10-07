import { describe, expect, it } from 'vitest'
import { readRegionSplit, splitSecondPart, SPLIT_AT_MAX } from './regionSplit'

/** Sala em duas cores: o recorte do lado de lá da reta. */
const quadrado = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]

function area(points: { x: number; y: number }[]): number {
  let soma = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    soma += a.x * b.y - b.x * a.y
  }
  return Math.abs(soma) / 2
}

describe('splitSecondPart', () => {
  it('em pé no meio: a metade da direita', () => {
    const parte = splitSecondPart(quadrado, { color: '#ff0000', direction: 'vertical', at: 0.5 })
    expect(area(parte)).toBeCloseTo(5000)
    expect(Math.min(...parte.map((p) => p.x))).toBeCloseTo(50)
  })

  it('deitada a 25%: os três quartos de baixo', () => {
    const parte = splitSecondPart(quadrado, { color: '#ff0000', direction: 'horizontal', at: 0.25 })
    expect(area(parte)).toBeCloseTo(7500)
    expect(Math.min(...parte.map((p) => p.y))).toBeCloseTo(25)
  })

  it('diagonal no meio: o triângulo de baixo à direita', () => {
    const parte = splitSecondPart(quadrado, { color: '#ff0000', direction: 'diagonal', at: 0.5 })
    expect(area(parte)).toBeCloseTo(5000)
    expect(parte.every((p) => p.x + p.y >= 100 - 1e-9)).toBe(true)
  })

  it('polígono degenerado não pinta nada', () => {
    expect(splitSecondPart(quadrado.slice(0, 2), { color: '#ff0000', direction: 'vertical', at: 0.5 })).toEqual([])
  })
})

describe('readRegionSplit', () => {
  it('aceita o campo bom e limita o corte', () => {
    expect(readRegionSplit({ color: '#00ff00', direction: 'diagonal', at: 2 })).toEqual({ color: '#00ff00', direction: 'diagonal', at: SPLIT_AT_MAX })
  })

  it('arquivo adulterado vira sala de uma cor', () => {
    expect(readRegionSplit(null)).toBeUndefined()
    expect(readRegionSplit({ color: 'red', direction: 'vertical', at: 0.5 })).toBeUndefined()
    expect(readRegionSplit({ color: '#00ff00', direction: 'torto', at: 0.5 })).toBeUndefined()
    expect(readRegionSplit({ color: '#00ff00', direction: 'vertical', at: Number.NaN })).toBeUndefined()
  })
})
