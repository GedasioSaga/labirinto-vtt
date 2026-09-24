import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Light } from '../types/map'
import { drawFarLights, farLightPoints, FAR_LIGHT_CORE_SCREEN_RADIUS } from './drawFarLights'

function luz(id: string, extra: Partial<Light> = {}): Light {
  return { id, x: 100, y: 200, radius: 300, color: '#ffcc00', intensity: 0.8, ...extra }
}

function fills(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill').length
}

describe('pontos de luz vistos de longe (tela do jogador)', () => {
  it('só a luz que chegou como ponto (marcada e com raio 0) vira ponto aceso', () => {
    const pontos = farLightPoints([luz('halo-comum'), luz('marcada-na-visao', { vistaDeLonge: true }), luz('ponto', { vistaDeLonge: true, radius: 0 })])
    expect(pontos.map((l) => l.id)).toEqual(['ponto'])
  })

  it('cada ponto é um brilho e um miolo; sem ponto, nada é desenhado', () => {
    const g = new Graphics()
    drawFarLights(g, [luz('a', { vistaDeLonge: true, radius: 0 }), luz('b', { vistaDeLonge: true, radius: 0, x: 900 })], 1)
    expect(fills(g)).toBe(4)
    drawFarLights(g, [luz('halo-comum')], 1)
    expect(fills(g)).toBe(0)
  })

  it('o tamanho é de tela: com zoom 0,5 o miolo tem o dobro em px de mundo', () => {
    const g = new Graphics()
    drawFarLights(g, [luz('a', { vistaDeLonge: true, radius: 0 })], 0.5)
    const bounds = g.getLocalBounds()
    expect(fills(g)).toBe(2)
    // O brilho envolve o miolo; o miolo sozinho já mede 2x o raio de tela / zoom.
    expect(bounds.width).toBeGreaterThanOrEqual((2 * FAR_LIGHT_CORE_SCREEN_RADIUS) / 0.5)
  })
})
