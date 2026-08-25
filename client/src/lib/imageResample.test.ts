import { describe, expect, it } from 'vitest'
import { computeResampleDimensions } from './imageResample'

describe('computeResampleDimensions', () => {
  it('imagem menor que o teto não é redimensionada', () => {
    expect(computeResampleDimensions(800, 600, 4096)).toEqual({ width: 800, height: 600, needsResample: false })
  })

  it('imagem no teto exato não é redimensionada', () => {
    expect(computeResampleDimensions(4096, 2000, 4096)).toEqual({ width: 4096, height: 2000, needsResample: false })
  })

  it('imagem larga acima do teto escala mantendo proporção', () => {
    const result = computeResampleDimensions(8000, 4000, 4096)
    expect(result.needsResample).toBe(true)
    expect(result.width).toBe(4096)
    expect(result.height).toBe(2048)
  })

  it('imagem alta acima do teto escala mantendo proporção', () => {
    const result = computeResampleDimensions(3000, 6000, 4096)
    expect(result.needsResample).toBe(true)
    expect(result.height).toBe(4096)
    expect(result.width).toBe(2048)
  })
})
