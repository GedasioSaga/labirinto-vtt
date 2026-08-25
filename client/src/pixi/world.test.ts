import { describe, expect, it } from 'vitest'
import { clampScale, panBy, zoomAt, MIN_SCALE, MAX_SCALE } from './world'

describe('clampScale', () => {
  it('mantém valor dentro do intervalo', () => {
    expect(clampScale(1)).toBe(1)
  })

  it('trava no mínimo', () => {
    expect(clampScale(0)).toBe(MIN_SCALE)
  })

  it('trava no máximo', () => {
    expect(clampScale(999)).toBe(MAX_SCALE)
  })
})

describe('panBy', () => {
  it('desloca x/y e preserva escala', () => {
    const result = panBy({ x: 10, y: 10, scale: 2 }, 5, -3)
    expect(result).toEqual({ x: 15, y: 7, scale: 2 })
  })
})

describe('zoomAt', () => {
  it('mantém o ponto do mundo sob o cursor fixo ao aplicar zoom', () => {
    const camera = { x: 0, y: 0, scale: 1 }
    const pointer = { x: 400, y: 300 }

    const worldBefore = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }

    const next = zoomAt(camera, pointer, -100)

    const worldAfter = {
      x: (pointer.x - next.x) / next.scale,
      y: (pointer.y - next.y) / next.scale,
    }

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6)
  })

  it('wheel negativo (scroll pra cima) aumenta o zoom', () => {
    const next = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, -100)
    expect(next.scale).toBeGreaterThan(1)
  })

  it('wheel positivo (scroll pra baixo) diminui o zoom', () => {
    const next = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100)
    expect(next.scale).toBeLessThan(1)
  })
})
