import { describe, expect, it } from 'vitest'
import { Graphics, type FillInstruction, type StrokeInstruction } from 'pixi.js'
import { drawDrawings } from './drawDrawings'
import { SELECTION_COLOR } from './constants'
import type { Drawing } from '../types/map'

function strokes(g: Graphics): StrokeInstruction[] {
  return g.context.instructions.filter((i): i is StrokeInstruction => i.action === 'stroke')
}

function fills(g: Graphics): FillInstruction[] {
  return g.context.instructions.filter((i): i is FillInstruction => i.action === 'fill')
}

const rect: Drawing = { id: 'r1', kind: 'rect', x: 0, y: 0, w: 100, h: 50, color: '#ff0000', width: 4, filled: true, fillAlpha: 0.5 }
const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: '#00ff00', width: 3 }

/**
 * Auditoria 14/09: o destaque amarelo pintava por cima da cor real. Agora a
 * seleção é um contorno POR FORA (2 px de tela, sem preencher) e a cor, o
 * preenchimento e a espessura reais continuam iguais aos de não selecionado.
 */
describe('drawDrawings — seleção como contorno por fora', () => {
  it('não selecionado: só o traço real', () => {
    const g = new Graphics()
    drawDrawings(g, [rect], null)
    expect(strokes(g)).toHaveLength(1)
    expect(strokes(g)[0].data.style).toMatchObject({ color: 0xff0000, width: 4 })
  })

  it('retângulo selecionado: cor, preenchimento e espessura reais intactos + contorno por fora em SELECTION_COLOR', () => {
    const g = new Graphics()
    drawDrawings(g, [rect], 'r1', 1)
    expect(fills(g)).toHaveLength(1)
    expect(fills(g)[0].data.style).toMatchObject({ color: 0xff0000, alpha: 0.5 })
    const [outline, real] = strokes(g)
    expect(real.data.style).toMatchObject({ color: 0xff0000, width: 4 })
    // alignment 0 = fora da forma; largura = meia espessura real (que já sai
    // para fora) + 2 px de tela.
    expect(outline.data.style).toMatchObject({ color: SELECTION_COLOR, alignment: 0, width: 4 / 2 + 2 })
  })

  it('contorno de seleção tem 2 px de TELA: a zoom 200% ele vale 1 de mundo', () => {
    const g = new Graphics()
    drawDrawings(g, [rect], 'r1', 2)
    expect(strokes(g)[0].data.style.width).toBe(4 / 2 + 1)
  })

  it('linha selecionada: contorno é um traço mais largo POR BAIXO (desenhado antes) do traço real', () => {
    const g = new Graphics()
    drawDrawings(g, [line], 'l1', 1)
    const [outline, real] = strokes(g)
    expect(outline.data.style).toMatchObject({ color: SELECTION_COLOR, width: 3 + 2 * 2 })
    expect(real.data.style).toMatchObject({ color: 0x00ff00, width: 3 })
  })
})
