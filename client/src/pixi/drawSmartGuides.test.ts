import { describe, expect, it } from 'vitest'
import { Graphics, type StrokeInstruction } from 'pixi.js'
import type { GapMark, SmartGuide } from '../lib/smartGuides'
import { SMART_GUIDE_COLOR } from './constants'
import { SMART_GUIDE_GAP_TICK_SCREEN_PX, SMART_GUIDE_MARK_SCREEN_PX, drawSmartGuides } from './drawSmartGuides'

function tracos(g: Graphics): StrokeInstruction[] {
  return g.context.instructions.filter((i): i is StrokeInstruction => i.action === 'stroke')
}

const verticalEntreCentros: SmartGuide = { axis: 'x', position: 150, from: 50, to: 330, marks: [50, 330] }
const horizontal: SmartGuide = { axis: 'y', position: 50, from: 50, to: 650, marks: [50, 350, 650] }
const so = (guides: SmartGuide[], gaps: GapMark[] = []) => ({ guides, gaps })

describe('drawSmartGuides — a guia magenta fina do arrasto', () => {
  it('magenta, um traço só para todas as guias, com 1 px de TELA em qualquer zoom', () => {
    for (const escala of [0.25, 1, 2]) {
      const g = new Graphics()
      drawSmartGuides(g, so([verticalEntreCentros, horizontal]), escala, 1)
      const [traco, ...resto] = tracos(g)
      expect(resto).toHaveLength(0)
      expect(traco?.data.style.color).toBe(SMART_GUIDE_COLOR)
      expect(traco?.data.style.width).toBeCloseTo(1 / escala)
    }
  })

  it('o segmento vai só de uma peça à outra, com o x das pontas em px de tela (não atravessa a tela)', () => {
    const escala = 2
    const g = new Graphics()
    drawSmartGuides(g, so([verticalEntreCentros]), escala, 1)
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
    drawSmartGuides(g, so([verticalEntreCentros]), 1, 1)
    expect(tracos(g)).toHaveLength(1)
    drawSmartGuides(g, so([]), 1, 1)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('resolução 2 (tela retina): continua 1 px de tela, 2 px físicos', () => {
    const g = new Graphics()
    drawSmartGuides(g, so([horizontal]), 1, 2)
    expect(tracos(g)[0]?.data.style.width).toBeCloseTo(1)
  })
})

describe('drawSmartGuides — o vão medido (fatia 3)', () => {
  const vaoDeitado: GapMark = { axis: 'x', from: 100, to: 150, at: 20 }
  const vaoEmPe: GapMark = { axis: 'y', from: 100, to: 300, at: 150 }

  it('vão na horizontal: segmento de uma borda à outra, com um tracinho em pé em cada ponta, do mesmo tamanho na tela em qualquer zoom', () => {
    for (const escala of [0.5, 2]) {
      const g = new Graphics()
      drawSmartGuides(g, so([], [vaoDeitado]), escala, 1)
      const meioPixel = 0.5 / escala + 1e-6
      const tracinho = SMART_GUIDE_GAP_TICK_SCREEN_PX / escala
      const caixa = g.getLocalBounds()
      expect(Math.abs(caixa.minX - 100)).toBeLessThanOrEqual(2 * meioPixel)
      expect(Math.abs(caixa.maxX - 150)).toBeLessThanOrEqual(2 * meioPixel)
      expect(Math.abs((caixa.minY + caixa.maxY) / 2 - 20)).toBeLessThanOrEqual(meioPixel)
      expect(caixa.maxY - caixa.minY).toBeGreaterThanOrEqual(2 * tracinho - 1e-6)
      expect(caixa.maxY - caixa.minY).toBeLessThanOrEqual(2 * tracinho + 2 / escala + 1e-6)
    }
  })

  it('vão na vertical: o tracinho das pontas fica deitado', () => {
    const escala = 1
    const g = new Graphics()
    drawSmartGuides(g, so([], [vaoEmPe]), escala, 1)
    const caixa = g.getLocalBounds()
    // Meio pixel de alinhamento e meio de espessura, no máximo.
    expect(Math.abs(caixa.minY - 100)).toBeLessThanOrEqual(1)
    expect(Math.abs(caixa.maxY - 300)).toBeLessThanOrEqual(1)
    expect(Math.abs((caixa.minX + caixa.maxX) / 2 - 150)).toBeLessThanOrEqual(0.5 + 1e-6)
    expect(caixa.maxX - caixa.minX).toBeGreaterThanOrEqual(2 * SMART_GUIDE_GAP_TICK_SCREEN_PX - 1e-6)
  })

  it('guias e vãos saem num traço só (um lote), magenta e de 1 px de tela', () => {
    const g = new Graphics()
    drawSmartGuides(g, so([verticalEntreCentros, horizontal], [vaoDeitado, vaoEmPe]), 2, 1)
    const [traco, ...resto] = tracos(g)
    expect(resto).toHaveLength(0)
    expect(traco?.data.style.color).toBe(SMART_GUIDE_COLOR)
    expect(traco?.data.style.width).toBeCloseTo(0.5)
  })

  it('só vãos, sem guia nenhuma (espaçamento sem alinhamento): ainda desenha', () => {
    const g = new Graphics()
    drawSmartGuides(g, so([], [vaoDeitado]), 1, 1)
    expect(tracos(g)).toHaveLength(1)
  })
})
