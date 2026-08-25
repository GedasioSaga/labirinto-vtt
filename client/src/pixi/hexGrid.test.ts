import { describe, expect, it } from 'vitest'
import { axialToPixel, pixelToAxial, roundAxial, hexCorners, snapToHexGrid, computeVisibleHexCenters } from './hexGrid'

describe('axialToPixel', () => {
  it('origem (0,0) vira pixel (0,0)', () => {
    expect(axialToPixel({ q: 0, r: 0 }, 64)).toEqual({ x: 0, y: 0 })
  })

  it('desloca em q e r conforme o tamanho', () => {
    const p = axialToPixel({ q: 1, r: 0 }, 64)
    expect(p.x).toBeCloseTo(64 * Math.sqrt(3), 5)
    expect(p.y).toBeCloseTo(0, 5)
  })
})

describe('roundAxial', () => {
  it('coordenada já inteira não muda', () => {
    expect(roundAxial({ q: 2, r: -1 })).toEqual({ q: 2, r: -1 })
  })

  it('arredonda pra coordenada cúbica válida (soma zero)', () => {
    const result = roundAxial({ q: 0.6, r: 0.6 })
    const x = result.q
    const z = result.r
    const y = -x - z
    expect(x + y + z).toBe(0)
  })
})

describe('axialToPixel + pixelToAxial round-trip', () => {
  it('centro exato de um hex volta pro mesmo axial', () => {
    const original = { q: 3, r: -2 }
    const pixel = axialToPixel(original, 64)
    expect(pixelToAxial(pixel, 64)).toEqual(original)
  })
})

describe('hexCorners', () => {
  it('retorna 6 pontos, todos à distância `size` do centro', () => {
    const center = { x: 100, y: 200 }
    const size = 64
    const corners = hexCorners(center, size)
    expect(corners).toHaveLength(6)
    for (const corner of corners) {
      const dist = Math.hypot(corner.x - center.x, corner.y - center.y)
      expect(dist).toBeCloseTo(size, 5)
    }
  })
})

describe('snapToHexGrid', () => {
  it('size inválido retorna o ponto sem alterar', () => {
    expect(snapToHexGrid(33, 47, 0)).toEqual({ x: 33, y: 47 })
  })

  it('ponto exatamente no centro de um hex não muda', () => {
    const center = axialToPixel({ q: 2, r: 1 }, 64)
    const snapped = snapToHexGrid(center.x, center.y, 64)
    expect(snapped.x).toBeCloseTo(center.x, 5)
    expect(snapped.y).toBeCloseTo(center.y, 5)
  })
})

describe('computeVisibleHexCenters', () => {
  it('size inválido retorna vazio', () => {
    expect(computeVisibleHexCenters(0, { left: 0, top: 0, right: 100, bottom: 100 })).toEqual([])
  })

  it('viewport razoável retorna centros cobrindo a área (não vazio, não gigantesco)', () => {
    const centers = computeVisibleHexCenters(64, { left: 0, top: 0, right: 640, bottom: 480 })
    expect(centers.length).toBeGreaterThan(10)
    expect(centers.length).toBeLessThan(500)
  })
})
