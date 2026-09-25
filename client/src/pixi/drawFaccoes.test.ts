/**
 * FILTRO "QUEM MANDA AQUI" no editor: cada distrito (e cada sala com facção
 * própria) ganha a cor chapada e translúcida da facção. Filtro desligado ou
 * mapa sem facção: nada desenhado.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { andar6 } from '../lib/__fixtures__/andar6'
import { pinturaDeFaccoes } from '../lib/faccoes'
import { drawFaccoes } from './drawFaccoes'

describe('drawFaccoes', () => {
  it('pinta os distritos do andar 6 dentro da área deles', () => {
    const g = new Graphics()
    drawFaccoes(g, pinturaDeFaccoes(andar6()))
    expect(g.context.instructions.length).toBe(3)
    const caixa = g.getLocalBounds()
    // Norte e Sul ocupam x 0-1000, y 0-1200; o Mercado (x 1000-2000) fica de fora.
    expect(caixa.minX).toBe(0)
    expect(caixa.maxX).toBe(1000)
    expect(caixa.maxY).toBe(1200)
  })

  it('sem pintura (filtro desligado): limpa o que havia', () => {
    const g = new Graphics()
    drawFaccoes(g, pinturaDeFaccoes(andar6()))
    drawFaccoes(g, [])
    expect(g.context.instructions).toHaveLength(0)
  })
})
