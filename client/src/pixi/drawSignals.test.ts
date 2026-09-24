import { describe, expect, it } from 'vitest'
import { SIGNAL_EDGE_MARGIN, SIGNAL_RING_DASHES, placeSignal, signalRingDashes } from './drawSignals'

const VIEWPORT = { width: 800, height: 600 }
const CAMERA = { x: 0, y: 0, scale: 1 }

describe('placeSignal', () => {
  it('ponto dentro da tela fica onde está, já convertido pela câmera', () => {
    expect(placeSignal({ x: 100, y: 50 }, { x: 10, y: 20, scale: 2 }, VIEWPORT)).toEqual({ x: 210, y: 120, onScreen: true, angle: 0 })
  })

  it('ponto à direita fora da tela vira seta presa na borda direita, apontando para a direita', () => {
    const place = placeSignal({ x: 5000, y: 300 }, CAMERA, VIEWPORT)
    expect(place.onScreen).toBe(false)
    expect(place.x).toBeCloseTo(VIEWPORT.width - SIGNAL_EDGE_MARGIN)
    expect(place.y).toBeCloseTo(300)
    expect(place.angle).toBeCloseTo(0)
  })

  it('ponto na diagonal acima e à esquerda fica dentro da margem, na reta centro -> ponto', () => {
    const place = placeSignal({ x: -4000, y: -4000 }, CAMERA, VIEWPORT)
    expect(place.onScreen).toBe(false)
    expect(place.x).toBeGreaterThanOrEqual(SIGNAL_EDGE_MARGIN - 1e-6)
    expect(place.y).toBeGreaterThanOrEqual(SIGNAL_EDGE_MARGIN - 1e-6)
    // Um dos lados encosta na margem.
    expect(Math.min(place.x, place.y)).toBeCloseTo(SIGNAL_EDGE_MARGIN)
    const cross = (place.x - 400) * (-4000 - 300) - (place.y - 300) * (-4000 - 400)
    expect(Math.abs(cross)).toBeLessThan(1e-6)
    expect(Math.cos(place.angle)).toBeLessThan(0)
    expect(Math.sin(place.angle)).toBeLessThan(0)
  })

  it('ponto abaixo usa a borda de baixo', () => {
    const place = placeSignal({ x: 400, y: 9000 }, CAMERA, VIEWPORT)
    expect(place.y).toBeCloseTo(VIEWPORT.height - SIGNAL_EDGE_MARGIN)
    expect(place.x).toBeCloseTo(400)
  })
})

describe('signalRingDashes (eco sem destinatário sai tracejado)', () => {
  it('parte a volta em traços iguais com vão entre eles, sem passar de uma volta', () => {
    const dashes = signalRingDashes()
    expect(dashes).toHaveLength(SIGNAL_RING_DASHES)
    expect(dashes[0]?.[0]).toBe(0)
    const size = (dashes[0]?.[1] ?? 0) - (dashes[0]?.[0] ?? 0)
    for (let i = 0; i < dashes.length; i += 1) {
      const [start, end] = dashes[i] ?? [0, 0]
      expect(end - start).toBeCloseTo(size)
      expect(end).toBeGreaterThan(start)
      // Vão de verdade: o próximo traço começa depois de este acabar.
      const next = dashes[i + 1]?.[0] ?? Math.PI * 2
      expect(next).toBeGreaterThan(end)
    }
    expect(dashes[dashes.length - 1]?.[1]).toBeLessThan(Math.PI * 2)
  })
})
