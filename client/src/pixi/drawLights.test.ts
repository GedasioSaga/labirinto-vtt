import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Circle, Container, FillGradient, Graphics, Matrix, Polygon, Texture } from 'pixi.js'
import { createLightGradient, createLightsRenderer, LIGHT_MARKER_SCREEN_RADIUS } from './drawLights'
import type { Segment } from '../lib/visibility'
import type { Light } from '../types/map'

function light(overrides: Partial<Light> = {}): Light {
  return { id: 'l1', x: 100, y: 100, radius: 256, color: '#ffaa33', intensity: 0.8, ...overrides }
}

function fills(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill')
}

/** Só os Graphics: as máscaras vazias e o container do marcador entram na mesma lista de filhos. */
function graphicsChildren(container: Container): Graphics[] {
  return container.children.filter((child): child is Graphics => child instanceof Graphics)
}

/** Halos desenhados: um Graphics por luz, com o preenchimento do gradiente. */
function halos(container: Container): Graphics[] {
  return graphicsChildren(container).filter((g) => fills(g).some((f) => f.action === 'fill' && f.data.style.fill instanceof FillGradient))
}

/** Último filho: os marcadores de origem, por cima de todos os halos. */
function markers(container: Container): Graphics {
  const children = graphicsChildren(container)
  const last = children[children.length - 1]
  if (!last) throw new Error('nenhum Graphics no container de luzes')
  return last
}

/** Raio do primeiro círculo do path da instrução. */
function circleRadius(instruction: ReturnType<typeof fills>[number]): number {
  if (instruction.action !== 'fill') return NaN
  const shape = instruction.data.path.shapePath.shapePrimitives[0]?.shape
  return shape instanceof Circle ? shape.radius : NaN
}

/** Pontos do primeiro polígono do path da instrução, em pares [x, y]. */
function polygonPoints(instruction: ReturnType<typeof fills>[number]): number[] {
  if (instruction.action !== 'fill') return []
  const shape = instruction.data.path.shapePath.shapePrimitives[0]?.shape
  return shape instanceof Polygon ? shape.points : []
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

  it('paradas sem anel duro: alpha cai de intensidade × 0,6 no centro para 0 na borda', () => {
    const { colorStops } = createLightGradient(light({ intensity: 0.8 }))
    expect(colorStops.map((s) => s.offset)).toEqual([0, 0.5, 1])
    const alphas = colorStops.map((s) => alphaOf(s.color))
    expect(alphas[0]).toBe(Math.round(0.8 * 0.6 * 255))
    expect(alphas[0]).toBeGreaterThan(alphas[1])
    expect(alphas[1]).toBeGreaterThan(alphas[2])
    expect(alphas[2]).toBe(0)
    expect(colorStops[0].color.slice(0, 7)).toBe('#ffaa33')
  })

  it('luz a meio raio chega a alpha 0,38 × intensidade: mais que o dobro do halo antigo (0,158)', () => {
    const { colorStops } = createLightGradient(light({ intensity: 1 }))
    const meioRaio = colorStops.find((s) => s.offset === 0.5)
    expect(meioRaio && alphaOf(meioRaio.color)).toBe(Math.round(0.38 * 255))
  })

  it('2 luzes iguais → 1 FillGradient compartilhado, um halo por luz', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [light({ id: 'a' }), light({ id: 'b', x: 500 })])
    expect(renderer.liveGradients()).toBe(1)
    const desenhados = halos(container)
    expect(desenhados).toHaveLength(2)
    const [first, second] = desenhados.map((g) => fills(g)[0])
    expect(first.action === 'fill' && second.action === 'fill' && first.data.style.fill === second.data.style.fill).toBe(true)
  })

  it('trocar a intensidade destrói o gradiente antigo e não cresce a contagem (20 trocas)', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    for (let i = 0; i < 20; i++) {
      renderer.draw(container, [light({ intensity: 0.5 + (i % 2) * 0.3 })])
      expect(renderer.liveGradients()).toBe(1)
    }
    expect(destroySpy).toHaveBeenCalledTimes(19)
  })

  it('redesenhar com a mesma luz não destrói nem recria', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [light()])
    renderer.draw(container, [light()])
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('destroy() do renderer libera todos os gradientes (teardown do canvas)', () => {
    const renderer = createLightsRenderer()
    renderer.draw(new Container(), [light({ color: '#ff0000' }), light({ color: '#00ff00' })])
    renderer.destroy()
    expect(destroySpy).toHaveBeenCalledTimes(2)
    expect(renderer.liveGradients()).toBe(0)
  })

  it('marcador de 6 px de TELA: a zoom 200% o raio de mundo é 3; halo com o raio da luz', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [light({ radius: 256 })], { cameraScale: 2 })
    expect(circleRadius(fills(halos(container)[0])[0])).toBe(256)
    const marker = fills(markers(container))[0]
    expect(circleRadius(marker)).toBe(LIGHT_MARKER_SCREEN_RADIUS / 2)
    expect(marker.action === 'fill' && marker.data.style.color).toBe(0xffaa33)
  })

  it('sem marcador (tela do jogador): nenhum ponto da origem é desenhado', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [light()], { showMarkers: false })
    expect(fills(markers(container))).toHaveLength(0)
    expect(halos(container)).toHaveLength(1)
  })
})

describe('drawLights — a luz para na parede', () => {
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

  /** Parede horizontal em y=300, de x=400 a x=700 (a mesma da jornada da feature). */
  const parede: Segment[] = [{ x1: 400, y1: 300, x2: 700, y2: 300 }]
  const tocha = light({ id: 'tocha', x: 550, y: 250, radius: 300, color: '#ff0000', intensity: 1 })

  /** Máscara do halo: o polígono de alcance da luz. `null` quando o halo é círculo cheio. */
  function mascara(container: Container): Graphics | null {
    const halo = halos(container)[0]
    return halo && halo.mask instanceof Graphics ? halo.mask : null
  }

  /** Vértices do alcance recortado; explode se o halo saiu sem máscara. */
  function alcance(container: Container): number[] {
    const mask = mascara(container)
    if (!mask) throw new Error('halo sem máscara de recorte')
    return polygonPoints(fills(mask)[0])
  }

  it('sem obstáculo nenhum o halo continua círculo cheio, sem máscara', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [tocha])
    expect(mascara(container)).toBeNull()
  })

  it('com a parede no meio, o alcance não passa dela: nenhum vértice atrás de y=300 sob a tocha', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [tocha], { occluders: parede })
    const pontos = alcance(container)
    expect(pontos.length).toBeGreaterThan(6)
    let atrasDaParede = 0
    for (let i = 0; i < pontos.length; i += 2) {
      const x = pontos[i]
      const y = pontos[i + 1]
      // Tolerância de 1 px: o raio que raspa a quina para EM cima da parede.
      if (y > 301 && x > 401 && x < 699) atrasDaParede += 1
    }
    expect(atrasDaParede).toBe(0)
  })

  it('a luz contorna a ponta da parede: o alcance alcança y>300 por fora de x∈[400,700]', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [tocha], { occluders: parede })
    const pontos = alcance(container)
    let contornou = 0
    for (let i = 0; i < pontos.length; i += 2) {
      if (pontos[i + 1] > 320 && (pontos[i] < 400 || pontos[i] > 700)) contornou += 1
    }
    expect(contornou).toBeGreaterThan(0)
  })

  it('luz parada com os mesmos obstáculos reaproveita o recorte (raycast não roda de novo)', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [tocha], { occluders: parede })
    const primeiro = alcance(container)
    renderer.draw(container, [tocha], { occluders: parede })
    expect(alcance(container)).toEqual(primeiro)
  })

  it('luz apagada (raio 0) some da tela: halo invisível, sem máscara e sem preenchimento', () => {
    const renderer = createLightsRenderer()
    const container = new Container()
    renderer.draw(container, [tocha], { occluders: parede })
    expect(halos(container)).toHaveLength(1)
    renderer.draw(container, [{ ...tocha, radius: 0 }], { occluders: parede })
    expect(halos(container)).toHaveLength(0)
    // Ordem dos filhos: [sombra, halo, marcadores] — o halo da 1ª luz é o índice 1.
    const halo = graphicsChildren(container)[1]
    expect(halo.visible).toBe(false)
    // `mask = null` desmonta o efeito: o getter do Pixi volta `undefined`, não `null`.
    expect(halo.mask instanceof Graphics).toBe(false)
  })
})
