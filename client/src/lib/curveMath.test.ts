import { describe, expect, it } from 'vitest'
import { simplifyToControlPoints, catmullRomToBezierSegments } from './curveMath'

describe('simplifyToControlPoints', () => {
  it('2 pontos retorna os 2', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    expect(simplifyToControlPoints(points)).toEqual(points)
  })

  it('pontos todos a menos de minDistance colapsam pro primeiro+último', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]
    expect(simplifyToControlPoints(points, 24)).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }])
  })

  it('pontos espalhados mantêm os que estão longe o bastante', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 31, y: 0 },
      { x: 70, y: 0 },
    ]
    expect(simplifyToControlPoints(points, 24)).toEqual([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 70, y: 0 },
    ])
  })
})

describe('catmullRomToBezierSegments', () => {
  it('2 pontos gera 1 segmento cujo end é o segundo ponto', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    const segments = catmullRomToBezierSegments(points)
    expect(segments).toHaveLength(1)
    expect(segments[0].end).toEqual({ x: 10, y: 10 })
  })

  it('3+ pontos gera points.length - 1 segmentos, cada end bate com o ponto seguinte', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 10 }]
    const segments = catmullRomToBezierSegments(points)
    expect(segments).toHaveLength(3)
    expect(segments[0].end).toEqual(points[1])
    expect(segments[1].end).toEqual(points[2])
    expect(segments[2].end).toEqual(points[3])
  })
})
