import { describe, expect, it } from 'vitest'
import type { MapLine } from '../types/map'
import { rasterizeMinimap } from './minimapRaster'
import { grayStrokeWeight } from './refineLines'
import { traceDottedLines } from './traceDotted'

const SIZE = 90
const isBackground = (r: number, g: number, b: number) => (g < 40 && r + g + b < 120 ? 1 : 0)

/** Chão verde inteiro com uma linha pontilhada rasterizada com período 3 e ponto 1,35 × 1,4 (medidas do Mapa3). */
function dottedScene(line: MapLine): Uint8ClampedArray {
  return rasterizeMinimap(
    {
      originX: 0,
      originY: 0,
      width: SIZE,
      height: SIZE,
      floor: { sample: () => -100, bounds: { minX: 0, minY: 0, maxX: SIZE, maxY: SIZE }, lipschitz: 1 },
      lines: [line],
      markers: [],
    },
    { background: [0, 0, 0], floor: [0, 107, 0], stroke: null, strokeAlpha: 1, strokeWidth: 1, lineAlpha: 0.955, samples: 4 },
  )
}

describe('traceDottedLines', () => {
  it('recupera o pontilhado vertical: posição, período 3 e medidas do ponto', () => {
    const truth: MapLine = {
      id: 't',
      points: [{ x: 40.2, y: 10.7 }, { x: 40.2, y: 76.7 }],
      closed: false,
      dotted: true,
      color: '#858585',
      width: 1.4,
      dotPeriod: 3,
      dotLength: 1.35,
    }
    const pixels = dottedScene(truth)
    const lines = traceDottedLines(pixels, SIZE, SIZE, { rect: { x: 0, y: 0, w: SIZE, h: SIZE }, weight: grayStrokeWeight, isBackground, color: '#858585' }, (i) => `d-${i}`)
    expect(lines).toHaveLength(1)
    const [line] = lines
    expect(line.dotted).toBe(true)
    expect(line.dotPeriod).toBeCloseTo(3, 1)
    for (const p of line.points) expect(p.x).toBeCloseTo(40.2, 1)
    expect(Math.abs((line.dotLength as number) - 1.35)).toBeLessThan(0.3)
    expect(Math.abs(line.width - 1.4)).toBeLessThan(0.3)
    // Primeiro e último ponto nas pontas verdadeiras (22 pontos entre 10,7 e 76,7).
    const ys = line.points.map((p) => p.y).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(10.7, 0)
    expect(ys[ys.length - 1]).toBeCloseTo(76.7, 0)
  })

  it('pontos em caixa alinhada à tela: mede largura na linha vertical e altura na horizontal', () => {
    // Cobertura analítica exata (área da caixa dentro do pixel), como o antisserrilhado contínuo
    // dos mapas de referência. O rasterizador 4×4 quantiza a cobertura em quartos e encurta o ponto.
    const DOT_W = 1.85
    const DOT_H = 1.42
    const centers: { x: number; y: number }[] = []
    for (let y = 10.6; y <= 70.6 + 1e-9; y += 3) centers.push({ x: 20.3, y })
    for (let x = 30.4; x <= 84.4 + 1e-9; x += 3) centers.push({ x, y: 80.4 })
    const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
    const pixels = new Uint8ClampedArray(SIZE * SIZE * 4)
    for (let py = 0; py < SIZE; py += 1) {
      for (let px = 0; px < SIZE; px += 1) {
        let coverage = 0
        for (const c of centers) {
          coverage += overlap(px, px + 1, c.x - DOT_W / 2, c.x + DOT_W / 2) * overlap(py, py + 1, c.y - DOT_H / 2, c.y + DOT_H / 2)
        }
        coverage = Math.min(1, coverage)
        const mix = (base: number) => Math.round(base * (1 - coverage) + 133 * coverage)
        pixels.set([mix(0), mix(107), mix(0), 255], (py * SIZE + px) * 4)
      }
    }
    const lines = traceDottedLines(pixels, SIZE, SIZE, { rect: { x: 0, y: 0, w: SIZE, h: SIZE }, weight: grayStrokeWeight, isBackground, color: '#858585' }, (i) => `d-${i}`)
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(Math.abs((line.dotWidth as number) - DOT_W)).toBeLessThan(0.3)
      expect(Math.abs((line.dotHeight as number) - DOT_H)).toBeLessThan(0.3)
      expect(line.dotPeriod).toBeCloseTo(3, 1)
    }
  })

  it('linha contínua não vira pontilhado', () => {
    const solid: MapLine = { id: 's', points: [{ x: 10.5, y: 40.5 }, { x: 80.5, y: 40.5 }], closed: false, dotted: false, color: '#858585', width: 1.4 }
    const lines = traceDottedLines(dottedScene(solid), SIZE, SIZE, { rect: { x: 0, y: 0, w: SIZE, h: SIZE }, weight: grayStrokeWeight, isBackground, color: '#858585' }, (i) => `d-${i}`)
    expect(lines).toHaveLength(0)
  })
})
