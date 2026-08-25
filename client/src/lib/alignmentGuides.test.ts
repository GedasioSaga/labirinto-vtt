import { describe, expect, it } from 'vitest'
import { computeAlignment, ALIGNMENT_THRESHOLD } from './alignmentGuides'

describe('computeAlignment', () => {
  it('sem candidato próximo retorna ponto original e guides vazio', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 500, y: 500 }])
    expect(result).toEqual({ point: { x: 100, y: 100 }, guides: [] })
  })

  it('candidato dentro do threshold no eixo x snapa só x', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 103, y: 500 }])
    expect(result.point).toEqual({ x: 103, y: 100 })
    expect(result.guides).toEqual([{ axis: 'x', position: 103 }])
  })

  it('candidato dentro do threshold nos dois eixos snapa os dois', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 104, y: 97 }])
    expect(result.point).toEqual({ x: 104, y: 97 })
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { axis: 'x', position: 104 },
        { axis: 'y', position: 97 },
      ]),
    )
    expect(result.guides).toHaveLength(2)
  })

  it('dois candidatos concorrentes no mesmo eixo, o mais próximo vence', () => {
    const result = computeAlignment(
      { x: 100, y: 100 },
      [
        { x: 105, y: 500 },
        { x: 102, y: 500 },
      ],
    )
    expect(result.point.x).toBe(102)
    expect(result.guides).toEqual([{ axis: 'x', position: 102 }])
  })

  it('candidato exatamente no limite do threshold snapa (inclusive)', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 100 + ALIGNMENT_THRESHOLD, y: 500 }])
    expect(result.point.x).toBe(100 + ALIGNMENT_THRESHOLD)
    expect(result.guides).toEqual([{ axis: 'x', position: 100 + ALIGNMENT_THRESHOLD }])
  })

  it('candidato um pixel além do threshold não snapa (exclusive)', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 100 + ALIGNMENT_THRESHOLD + 1, y: 500 }])
    expect(result.point).toEqual({ x: 100, y: 100 })
    expect(result.guides).toEqual([])
  })
})
