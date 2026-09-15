import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Circle, FillGradient, Graphics, Matrix, Texture } from 'pixi.js'
import { createLightGradient, createLightsRenderer, LIGHT_MARKER_SCREEN_RADIUS } from './drawLights'
import type { Light } from '../types/map'

function light(overrides: Partial<Light> = {}): Light {
  return { id: 'l1', x: 100, y: 100, radius: 256, color: '#ffaa33', intensity: 0.8, ...overrides }
}

function fills(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill')
}

/** Raio do primeiro círculo do path da instrução. */
function circleRadius(instruction: ReturnType<typeof fills>[number]): number {
  if (instruction.action !== 'fill') return NaN
  const shape = instruction.data.path.shapePath.shapePrimitives[0]?.shape
  return shape instanceof Circle ? shape.radius : NaN
}

/** Alpha (0..255) de uma cor '#rrggbbaa' gerada pelo FillGradient. */
function alphaOf(hexa: string): number {
  return parseInt(hexa.slice(7, 9), 16)
}

describe('drawLights — gradiente radial e marcador (passo 3, F6)', () => {
  let destroySpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom não tem canvas 2D: a textura do gradiente vira um stand-in, e o
    // destroy real (que destruiria o Texture.WHITE compartilhado) só é espionado.
    vi.spyOn(FillGradient.prototype, 'buildGradient').mockImplementation(function (this: FillGradient) {
      this.texture = Texture.WHITE
      this.transform = new Matrix()
    })
    destroySpy = vi.spyOn(FillGradient.prototype, 'destroy').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gradiente: radial, espaço local, centro 0,5/0,5, raio interno 0 e externo 0,5 (campo outerCenter)', () => {
    const gradient = createLightGradient(light())
    expect(gradient.type).toBe('radial')
    expect(gradient.textureSpace).toBe('local')
    expect(gradient.center).toEqual({ x: 0.5, y: 0.5 })
    expect(gradient.outerCenter).toEqual({ x: 0.5, y: 0.5 })
    expect(gradient.innerRadius).toBe(0)
    expect(gradient.outerRadius).toBe(0.5)
  })

  it('paradas sem anel duro: alpha cai de intensidade × 0,35 no centro para 0 na borda', () => {
    const { colorStops } = createLightGradient(light({ intensity: 0.8 }))
    expect(colorStops.map((s) => s.offset)).toEqual([0, 0.6, 1])
    const alphas = colorStops.map((s) => alphaOf(s.color))
    expect(alphas[0]).toBe(Math.round(0.8 * 0.35 * 255))
    expect(alphas[0]).toBeGreaterThan(alphas[1])
    expect(alphas[1]).toBeGreaterThan(alphas[2])
    expect(alphas[2]).toBe(0)
    expect(colorStops[0].color.slice(0, 7)).toBe('#ffaa33')
  })

  it('2 luzes iguais → 1 FillGradient compartilhado', () => {
    const renderer = createLightsRenderer()
    const g = new Graphics()
    renderer.draw(g, [light({ id: 'a' }), light({ id: 'b', x: 500 })])
    expect(renderer.liveGradients()).toBe(1)
    const halos = fills(g).filter((f) => f.action === 'fill' && f.data.style.fill instanceof FillGradient)
    expect(halos).toHaveLength(2)
    const [first, second] = halos
    expect(first.action === 'fill' && second.action === 'fill' && first.data.style.fill === second.data.style.fill).toBe(true)
  })

  it('trocar a intensidade destrói o gradiente antigo e não cresce a contagem (20 trocas)', () => {
    const renderer = createLightsRenderer()
    const g = new Graphics()
    for (let i = 0; i < 20; i++) {
      renderer.draw(g, [light({ intensity: 0.5 + (i % 2) * 0.3 })])
      expect(renderer.liveGradients()).toBe(1)
    }
    expect(destroySpy).toHaveBeenCalledTimes(19)
  })

  it('redesenhar com a mesma luz não destrói nem recria', () => {
    const renderer = createLightsRenderer()
    const g = new Graphics()
    renderer.draw(g, [light()])
    renderer.draw(g, [light()])
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('destroy() do renderer libera todos os gradientes (teardown do canvas)', () => {
    const renderer = createLightsRenderer()
    renderer.draw(new Graphics(), [light({ color: '#ff0000' }), light({ color: '#00ff00' })])
    renderer.destroy()
    expect(destroySpy).toHaveBeenCalledTimes(2)
    expect(renderer.liveGradients()).toBe(0)
  })

  it('marcador de 6 px de TELA: a zoom 200% o raio de mundo é 3; halo com o raio da luz', () => {
    const renderer = createLightsRenderer()
    const g = new Graphics()
    renderer.draw(g, [light({ radius: 256 })], null, 2)
    const [halo, marker] = fills(g)
    expect(circleRadius(halo)).toBe(256)
    expect(circleRadius(marker)).toBe(LIGHT_MARKER_SCREEN_RADIUS / 2)
    expect(marker.action === 'fill' && marker.data.style.color).toBe(0xffaa33)
  })
})
