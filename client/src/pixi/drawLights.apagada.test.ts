import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, FillGradient, Graphics, Matrix, Texture } from 'pixi.js'
import { createLightsRenderer } from './drawLights'
import type { Light } from '../types/map'

/**
 * ESTADO DO MUNDO — luz apagada pelo estado ("energia desligada"): no editor
 * do mestre ela some como luz (sem halo), mas o marcador continua lá, vazado,
 * para ele achar e religar.
 */
function light(overrides: Partial<Light> = {}): Light {
  return { id: 'l1', x: 100, y: 100, radius: 256, color: '#ffaa33', intensity: 0.8, ...overrides }
}

function graphicsChildren(container: Container): Graphics[] {
  return container.children.filter((child): child is Graphics => child instanceof Graphics)
}

/** Halos VISÍVEIS com o preenchimento do gradiente. */
function halosVisiveis(container: Container): Graphics[] {
  return graphicsChildren(container).filter(
    (g) => g.visible && g.context.instructions.some((i) => i.action === 'fill' && i.data.style.fill instanceof FillGradient),
  )
}

function marcadores(container: Container): Graphics {
  const children = graphicsChildren(container)
  const last = children[children.length - 1]
  if (!last) throw new Error('nenhum Graphics no container de luzes')
  return last
}

describe('drawLights — luz apagada pelo estado do mundo', () => {
  beforeEach(() => {
    vi.spyOn(FillGradient.prototype, 'buildGradient').mockImplementation(function (this: FillGradient) {
      this.texture = Texture.WHITE
      this.transform = new Matrix()
    })
    vi.spyOn(FillGradient.prototype, 'destroy').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('apagada: nenhum halo; acesa ao lado: um halo', () => {
    const container = new Container()
    const renderer = createLightsRenderer()
    renderer.draw(container, [light({ id: 'apagada', apagada: true }), light({ id: 'acesa', x: 400 })])
    expect(halosVisiveis(container)).toHaveLength(1)
  })

  it('apagada: o marcador continua, só com o contorno (sem preenchimento da cor)', () => {
    const container = new Container()
    const renderer = createLightsRenderer()
    renderer.draw(container, [light({ apagada: true })])
    const instrucoes = marcadores(container).context.instructions
    expect(instrucoes.filter((i) => i.action === 'stroke').length).toBeGreaterThan(0)
    expect(instrucoes.filter((i) => i.action === 'fill')).toHaveLength(0)
  })

  it('religar (a mesma luz sem apagada) volta o halo', () => {
    const container = new Container()
    const renderer = createLightsRenderer()
    renderer.draw(container, [light({ apagada: true })])
    expect(halosVisiveis(container)).toHaveLength(0)
    renderer.draw(container, [light()])
    expect(halosVisiveis(container)).toHaveLength(1)
  })
})
