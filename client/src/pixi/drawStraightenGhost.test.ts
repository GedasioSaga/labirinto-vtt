import { describe, expect, it } from 'vitest'
import { Graphics, type StrokeInstruction } from 'pixi.js'
import { SELECTION_COLOR } from './constants'
import { STRAIGHTEN_GHOST_SCREEN_PX, drawStraightenGhost } from './drawStraightenGhost'

/**
 * Pedido 5, fatia 4: o fantasma da posição de ANTES de endireitar. Linha fina
 * na cor da seleção (minimapa do Resident Evil: nada de traço grosso), com a
 * mesma espessura na tela em qualquer zoom.
 */

function tracos(g: Graphics): StrokeInstruction[] {
  return g.context.instructions.filter((i): i is StrokeInstruction => i.action === 'stroke')
}

const LINHA_TORTA = [
  { x: 219, y: 64 },
  { x: 95, y: 480 },
]
const CAMINHO_TORTO = [
  { x: 0, y: 0 },
  { x: 100, y: 8 },
  { x: 110, y: 108 },
]

describe('drawStraightenGhost — a posição de antes, fina e na cor da seleção', () => {
  it('um moveTo por traço e um lineTo por trecho, num stroke só, na cor da seleção', () => {
    const g = new Graphics()
    drawStraightenGhost(g, [LINHA_TORTA, CAMINHO_TORTO], 1, 1)
    const [traco, ...resto] = tracos(g)
    expect(resto).toHaveLength(0)
    expect(traco?.data.style.color).toBe(SELECTION_COLOR)
    expect(traco?.data.path.instructions.map((i) => [i.action, ...i.data])).toEqual([
      ['moveTo', 219, 64],
      ['lineTo', 95, 480],
      ['moveTo', 0, 0],
      ['lineTo', 100, 8],
      ['lineTo', 110, 108],
    ])
  })

  it('fino em qualquer zoom: a mesma espessura em px de tela, dividida pela escala da câmera', () => {
    for (const escala of [0.25, 1, 3]) {
      const g = new Graphics()
      drawStraightenGhost(g, [LINHA_TORTA], escala, 1)
      expect(tracos(g)[0]?.data.style.width).toBeCloseTo(STRAIGHTEN_GHOST_SCREEN_PX / escala)
    }
  })

  it('tela retina (resolução 2): a mesma espessura em px de tela', () => {
    const g = new Graphics()
    drawStraightenGhost(g, [LINHA_TORTA], 1, 2)
    expect(tracos(g)[0]?.data.style.width).toBeCloseTo(STRAIGHTEN_GHOST_SCREEN_PX)
  })

  it('o canto do Caminho e a emenda dos pedaços da parede com porta saem redondos, sem dente', () => {
    const g = new Graphics()
    drawStraightenGhost(g, [CAMINHO_TORTO], 1, 1)
    expect(tracos(g)[0]?.data.style).toMatchObject({ cap: 'round', join: 'round' })
  })

  it('limpa sempre: o fantasma anterior some, e sem traço nada fica desenhado', () => {
    const g = new Graphics()
    drawStraightenGhost(g, [LINHA_TORTA], 1, 1)
    expect(tracos(g)).toHaveLength(1)
    drawStraightenGhost(g, [], 1, 1)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('traço de menos de dois pontos não tem trecho: fica de fora', () => {
    const g = new Graphics()
    drawStraightenGhost(g, [[{ x: 5, y: 5 }], []], 1, 1)
    expect(g.context.instructions).toHaveLength(0)
  })
})
