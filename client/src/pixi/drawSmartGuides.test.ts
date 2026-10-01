import { describe, expect, it } from 'vitest'
import { Graphics, type StrokeInstruction } from 'pixi.js'
import type { SmartGuide } from '../lib/smartGuides'
import { SMART_GUIDE_COLOR } from './constants'
import { SMART_GUIDE_MARK_SCREEN_PX, drawSmartGuides } from './drawSmartGuides'

function tracos(g: Graphics): StrokeInstruction[] {
  return g.context.instructions.filter((i): i is StrokeInstruction => i.action === 'stroke')
}

const verticalEntreCentros: SmartGuide = { axis: 'x', position: 150, from: 50, to: 330, marks: [50, 330] }
const horizontal: SmartGuide = { axis: 'y', position: 50, from: 50, to: 650, marks: [50, 350, 650] }

describe('drawSmartGuides — a guia magenta fina do arrasto', () => {
  it('magenta, um traço só para todas as guias, com 1 px de TELA em qualquer zoom', () => {
    for (const escala of [0.25, 1, 2]) {
      const g = new Graphics()
      drawSmartGuides(g, [verticalEntreCentros, horizontal], escala, 1)
      const [traco, ...resto] = tracos(g)
      expect(resto).toHaveLength(0)
      expect(traco?.data.style.color).toBe(SMART_GUIDE_COLOR)
      expect(traco?.data.style.width).toBeCloseTo(1 / escala)
    }
  })

  it('o segmento vai só de uma peça à outra, com o x das pontas em px de tela (não atravessa a tela)', () => {
    const escala = 2
    const g = new Graphics()
    drawSmartGuides(g, [verticalEntreCentros], escala, 1)
    const perna = SMART_GUIDE_MARK_SCREEN_PX / escala
    const caixa = g.getLocalBounds()
    expect(caixa.minY).toBeCloseTo(50 - perna, 0)
    expect(caixa.maxY).toBeCloseTo(330 + perna, 0)
    expect(caixa.maxX - caixa.minX).toBeLessThanOrEqual(2 * perna + 1 / escala + 1e-6)
    // A linha cai no meio do pixel físico (traço nítido), a menos de meio pixel da posição pedida.
    expect(Math.abs((caixa.minX + caixa.maxX) / 2 - 150)).toBeLessThanOrEqual(0.5 / escala + 1e-6)
  })

  it('limpa sempre, mesmo com a lista vazia: a guia do passo anterior some', () => {
    const g = new Graphics()
    drawSmartGuides(g, [verticalEntreCentros], 1, 1)
    expect(tracos(g)).toHaveLength(1)
    drawSmartGuides(g, [], 1, 1)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('resolução 2 (tela retina): continua 1 px de tela, 2 px físicos', () => {
    const g = new Graphics()
    drawSmartGuides(g, [horizontal], 1, 2)
    expect(tracos(g)[0]?.data.style.width).toBeCloseTo(1)
  })
})
