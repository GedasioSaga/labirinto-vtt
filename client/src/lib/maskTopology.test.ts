import { describe, expect, it } from 'vitest'
import { maskTopology } from './maskTopology'

const W = 60
const H = 40

function image(paint: (x: number, y: number) => boolean): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) pixels.set(paint(x, y) ? [0, 107, 0, 255] : [0, 0, 0, 255], (y * W + x) * 4)
  }
  return pixels
}

const box = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1

describe('maskTopology', () => {
  it('conta ilhas e buracos fechados; buraco pequeno (< 12 px) e fundo da borda não contam', () => {
    const pixels = image(
      (x, y) =>
        (box(x, y, 5, 5, 35, 35) && !box(x, y, 10, 10, 20, 20) && !box(x, y, 25, 25, 27, 27)) || box(x, y, 42, 10, 52, 20),
    )
    expect(maskTopology(pixels, W, { x: 0, y: 0, w: W, h: H })).toEqual({ islands: 2, holes: 1 })
  })

  it('respeita o retângulo dentro da imagem', () => {
    const pixels = image((x, y) => box(x, y, 5, 5, 35, 35) || box(x, y, 42, 10, 52, 20))
    expect(maskTopology(pixels, W, { x: 40, y: 0, w: 20, h: H })).toEqual({ islands: 1, holes: 0 })
  })
})
