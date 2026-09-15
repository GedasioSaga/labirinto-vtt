import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawStairs } from './drawStairs'
import { SELECTION_COLOR, STAIR_COLOR } from './constants'
import type { Stair } from '../types/map'

function buildStair(overrides: Partial<Stair> = {}): Stair {
  return {
    id: 's1',
    shape: 'straight',
    segments: [{ x1: 0, y1: 0, x2: 200, y2: 0 }],
    stepWidth: 64,
    direction: 'up',
    ...overrides,
  } as Stair
}

function strokes(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

function fills(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

describe('drawStairs — seleção como contorno por fora', () => {
  it('sem seleção: nada em SELECTION_COLOR', () => {
    const g = new Graphics()
    drawStairs(g, [buildStair()], null)
    expect(strokes(g).some((s) => s.data.style.color === SELECTION_COLOR)).toBe(false)
  })

  it('selecionada: contorno amarelo vem ANTES (por baixo) e a escada real mantém a cor dela', () => {
    const gPlain = new Graphics()
    const gSelected = new Graphics()
    drawStairs(gPlain, [buildStair()], null)
    drawStairs(gSelected, [buildStair()], 's1')

    const selectedStrokes = strokes(gSelected)
    const yellow = selectedStrokes.filter((s) => s.data.style.color === SELECTION_COLOR)
    const real = selectedStrokes.filter((s) => s.data.style.color !== SELECTION_COLOR)
    expect(yellow.length).toBeGreaterThan(0)
    // Os traços reais são idênticos aos da escada não selecionada: nada pintado de amarelo.
    expect(real.map((s) => [s.data.style.color, s.data.style.width])).toEqual(
      strokes(gPlain).map((s) => [s.data.style.color, s.data.style.width]),
    )
    expect(real.every((s) => s.data.style.color === STAIR_COLOR)).toBe(true)
    expect(selectedStrokes.indexOf(yellow[yellow.length - 1])).toBeLessThan(selectedStrokes.indexOf(real[0]))
    // Seta continua preenchida na cor da escada.
    expect(fills(gSelected).map((f) => (f.data.style as { color: number }).color)).toEqual([STAIR_COLOR])
  })

  it('contorno tem espessura fixa na tela: a 50% de zoom fica 2x mais largo em mundo', () => {
    const outlineWidth = (scale: number) => {
      const g = new Graphics()
      drawStairs(g, [buildStair()], 's1', scale)
      return strokes(g)[0].data.style.width
    }
    // degrau medium (2) + 2 px de tela de cada lado
    expect(outlineWidth(1)).toBeCloseTo(2 + 4, 6)
    expect(outlineWidth(0.5)).toBeCloseTo(2 + 8, 6)
  })
})
