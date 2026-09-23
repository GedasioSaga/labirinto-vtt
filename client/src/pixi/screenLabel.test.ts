import { describe, expect, it } from 'vitest'
import { LABEL_MIN_SCREEN_PX, LABEL_MIN_ZOOM, screenLabelSizing } from './screenLabel'

describe('screenLabelSizing', () => {
  it('zoom que já mostra a fonte >= 11 px de tela: escala 1', () => {
    expect(screenLabelSizing(19.2, 1)).toEqual({ visible: true, scale: 1 })
    expect(screenLabelSizing(19.2, 0.6)).toEqual({ visible: true, scale: 1 })
    expect(screenLabelSizing(12, 4)).toEqual({ visible: true, scale: 1 })
  })

  it.each([0.3, 0.35, 0.5])('zoom %s: compensa até exatamente 11 px de tela', (zoom) => {
    const sizing = screenLabelSizing(19.2, zoom)
    expect(sizing.visible).toBe(true)
    expect(19.2 * zoom * sizing.scale).toBeCloseTo(LABEL_MIN_SCREEN_PX, 9)
  })

  it('abaixo de 30% o rótulo some; em 30% exato ainda aparece', () => {
    expect(screenLabelSizing(19.2, 0.25).visible).toBe(false)
    expect(screenLabelSizing(19.2, LABEL_MIN_ZOOM - 1e-6).visible).toBe(false)
    expect(screenLabelSizing(19.2, LABEL_MIN_ZOOM).visible).toBe(true)
  })

  it('fonte de token (12) a 50%: 6 px viraria 11 px', () => {
    expect(12 * 0.5 * screenLabelSizing(12, 0.5).scale).toBeCloseTo(11, 9)
  })

  it('entrada inválida não esconde nem escala', () => {
    expect(screenLabelSizing(19.2, Number.NaN)).toEqual({ visible: true, scale: 1 })
    expect(screenLabelSizing(0, 0.5)).toEqual({ visible: true, scale: 1 })
  })
})
