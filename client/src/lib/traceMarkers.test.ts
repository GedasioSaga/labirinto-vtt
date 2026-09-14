import { describe, expect, it } from 'vitest'
import { traceMarkers } from './traceMarkers'

const ORANGE = [204, 153, 51, 255]
const GREEN = [0, 107, 0, 255]

function image(width: number, height: number, paint: (x: number, y: number) => boolean): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels.set(paint(x, y) ? ORANGE : GREEN, (y * width + x) * 4)
    }
  }
  return pixels
}

describe('traceMarkers', () => {
  it('sem mancha devolve lista vazia', () => {
    expect(traceMarkers(image(10, 10, () => false), 10, 10)).toEqual([])
  })

  it('bloco 8×3 alinhado vira retângulo 8×3 sem rotação, centro exato e cor média', () => {
    const [marker] = traceMarkers(image(20, 20, (x, y) => x >= 4 && x < 12 && y >= 6 && y < 9), 20, 20)
    expect(marker.w).toBeCloseTo(8)
    expect(marker.h).toBeCloseTo(3)
    expect(Math.abs(marker.rotation) % 180).toBeCloseTo(0)
    expect(marker.cx).toBeCloseTo(8)
    expect(marker.cy).toBeCloseTo(7.5)
    expect(marker.color).toBe('#cc9933')
  })

  it('bloco vertical tem o eixo principal a 90°', () => {
    const [marker] = traceMarkers(image(20, 20, (x, y) => x >= 5 && x < 7 && y >= 2 && y < 12), 20, 20)
    expect(Math.abs(marker.rotation)).toBeCloseTo(90)
    expect(marker.w).toBeCloseTo(10)
    expect(marker.h).toBeCloseTo(2)
  })

  it('duas manchas separadas viram dois marcadores; mancha menor que o mínimo some', () => {
    const markers = traceMarkers(image(30, 10, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 5) || (x >= 20 && x < 25 && y >= 3 && y < 6) || (x === 15 && y === 8)), 30, 10)
    expect(markers).toHaveLength(2)
  })
})
