import { describe, expect, it } from 'vitest'
import { compileFloor } from './floorSdf'
import { minimapCoverage, traceFloorPieces, traceFloorRings } from './traceImage'

const GREEN = [0, 107, 0, 255]
const BLACK = [0, 0, 0, 255]

/** Imagem RGBA sintética: `paint(x, y)` decide se o pixel é chão. */
function image(width: number, height: number, paint: (x: number, y: number) => boolean): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels.set(paint(x, y) ? GREEN : BLACK, (y * width + x) * 4)
    }
  }
  return pixels
}

const inBox = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1

describe('traceFloorRings', () => {
  it('imagem sem chão não gera contorno', () => {
    expect(traceFloorRings(image(10, 10, () => false), 10, 10)).toEqual([])
  })

  it('quadrado de 20×20 px vira um anel de área 400 nas arestas dos pixels', () => {
    const rings = traceFloorRings(image(40, 40, (x, y) => inBox(x, y, 10, 10, 30, 30)), 40, 40)
    expect(rings).toHaveLength(1)
    // Marching squares corta meio pixel² em cada canto.
    expect(rings[0].area).toBeCloseTo(400 - 4 * 0.125, 1)
    expect(Math.min(...rings[0].points.map((p) => p.x))).toBeCloseTo(10, 0)
  })

  it('retângulo de recorte ignora o que está fora dele', () => {
    const pixels = image(40, 40, (x, y) => inBox(x, y, 2, 2, 8, 8) || inBox(x, y, 20, 20, 30, 30))
    expect(traceFloorRings(pixels, 40, 40, { rect: { x: 15, y: 15, w: 25, h: 25 } })).toHaveLength(1)
  })
})

describe('traceFloorRings com cobertura', () => {
  it('pixel de borda meio coberto põe a borda no meio dele, não na aresta', () => {
    const width = 40
    const pixels = new Uint8ClampedArray(width * width * 4)
    for (let y = 0; y < width; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside = x >= 10 && x < 30 && y >= 10 && y < 30
        const halfGray = x === 9 && y >= 10 && y < 30
        pixels.set(inside ? GREEN : halfGray ? [66, 66, 66, 255] : BLACK, (y * width + x) * 4)
      }
    }
    const [ring] = traceFloorRings(pixels, width, width, { coverage: minimapCoverage, tolerance: 0 })
    const leftXs = ring.points.filter((p) => p.y > 12 && p.y < 28).map((p) => p.x)
    expect(Math.min(...leftXs)).toBeCloseTo(9.5, 1)
  })
})

describe('traceFloorPieces com recuo', () => {
  it('recuo emagrece o chão e engorda o buraco pela mesma distância', () => {
    const pixels = image(60, 60, (x, y) => inBox(x, y, 5, 5, 55, 55) && !inBox(x, y, 20, 20, 40, 40))
    const pieces = traceFloorPieces(pixels, 60, 60, { inset: 0.8 }, (i) => `p${i}`)
    expect(pieces.map((p) => p.modifiers.grow)).toEqual([-0.8, 0.8])
    const floor = compileFloor(pieces)
    expect(floor.sample(5.5, 30)).toBeGreaterThan(0)
    expect(floor.sample(6, 30)).toBeLessThan(0)
    expect(floor.sample(19.5, 30)).toBeGreaterThan(0)
  })
})

describe('traceFloorPieces', () => {
  it('buraco vira subtração e ilha dentro do buraco vira soma, nessa ordem', () => {
    const pixels = image(60, 60, (x, y) => (inBox(x, y, 5, 5, 55, 55) && !inBox(x, y, 15, 15, 45, 45)) || inBox(x, y, 25, 25, 35, 35))
    const pieces = traceFloorPieces(pixels, 60, 60, {}, (i) => `p${i}`)
    expect(pieces.map((p) => p.op)).toEqual(['add', 'subtract', 'add'])
    const floor = compileFloor(pieces)
    expect(floor.sample(10, 10)).toBeLessThan(0)
    expect(floor.sample(20, 20)).toBeGreaterThan(0)
    expect(floor.sample(30, 30)).toBeLessThan(0)
  })
})
