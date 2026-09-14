import { describe, expect, it } from 'vitest'
import { orangeMarkerWeight, refineMarker } from './refineMarkers'
import { traceMarkers } from './traceMarkers'

const ORANGE = [204, 153, 51]
const GREEN = [0, 107, 0]
const SUPER = 8

/** Retângulo laranja antisserrilhado (supersample 8×8) sobre verde. */
function antialiasedRect(size: number, cx: number, cy: number, w: number, h: number, degrees: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4)
  const rad = (degrees * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let hits = 0
      for (let j = 0; j < SUPER; j += 1) {
        for (let i = 0; i < SUPER; i += 1) {
          const dx = px + (i + 0.5) / SUPER - cx
          const dy = py + (j + 0.5) / SUPER - cy
          const u = dx * ux + dy * uy
          const v = -dx * uy + dy * ux
          if (Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2) hits += 1
        }
      }
      const c = hits / (SUPER * SUPER)
      pixels.set([0, 1, 2].map((k) => Math.round(GREEN[k] * (1 - c) + ORANGE[k] * c)).concat(255), (py * size + px) * 4)
    }
  }
  return pixels
}

describe('orangeMarkerWeight', () => {
  it('laranja cheio pesa 1; verde, preto e cinza pesam 0', () => {
    expect(orangeMarkerWeight(204, 153, 51, 255)).toBe(1)
    expect(orangeMarkerWeight(0, 107, 0, 255)).toBe(0)
    expect(orangeMarkerWeight(0, 0, 0, 255)).toBe(0)
    expect(orangeMarkerWeight(127, 133, 127, 255)).toBe(0)
  })
})

describe('refineMarker', () => {
  it('porta girada 30° de 7×2,4 centrada fora da grade: centro, tamanho e ângulo subpixel', () => {
    const size = 30
    const pixels = antialiasedRect(size, 14.3, 15.6, 7, 2.4, 30)
    const [rough] = traceMarkers(pixels, size, size, { isMarker: (r, g, b, a) => orangeMarkerWeight(r, g, b, a) > 0.3 })
    const refined = refineMarker(rough, pixels, size, size, { weight: orangeMarkerWeight })
    expect(refined.cx).toBeCloseTo(14.3, 1)
    expect(refined.cy).toBeCloseTo(15.6, 1)
    expect(refined.w).toBeCloseTo(7, 0)
    expect(Math.abs(refined.h - 2.4)).toBeLessThan(0.35)
    expect(((refined.rotation % 180) + 180) % 180).toBeCloseTo(30, 0)
  })

  it('sem laranja em volta devolve o marcador original', () => {
    const pixels = antialiasedRect(20, -50, -50, 1, 1, 0)
    const marker = { cx: 10, cy: 10, w: 4, h: 2, rotation: 0, color: '#cc9933', pixelCount: 8 }
    expect(refineMarker(marker, pixels, 20, 20, { weight: orangeMarkerWeight })).toBe(marker)
  })
})
