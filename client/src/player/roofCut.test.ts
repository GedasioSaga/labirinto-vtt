import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { applyRoofCut } from './roofCut'

/**
 * O telhado do prédio abre SÓ no cone que o host mandou (`glimpses`): o recorte
 * é uma máscara invertida no telhado, e sem cone nenhum o telhado fica inteiro.
 */
function fills(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

const CONE = [
  [
    { x: 500, y: 250 },
    { x: 600, y: 250 },
    { x: 600, y: 350 },
    { x: 500, y: 350 },
  ],
]

describe('applyRoofCut', () => {
  it('com cone: desenha o recorte e o põe como máscara invertida do telhado', () => {
    const roofs = new Graphics()
    const cut = new Graphics()
    applyRoofCut(roofs, cut, CONE)
    expect(fills(cut)).toHaveLength(1)
    expect(roofs.mask).toBe(cut)
  })

  it('sem cone: recorte vazio e telhado sem máscara (inteiro)', () => {
    const roofs = new Graphics()
    const cut = new Graphics()
    applyRoofCut(roofs, cut, CONE)
    applyRoofCut(roofs, cut, [])
    expect(fills(cut)).toHaveLength(0)
    // Sem máscara: o getter do pixi devolve `undefined`.
    expect(roofs.mask ?? null).toBeNull()
  })
})
