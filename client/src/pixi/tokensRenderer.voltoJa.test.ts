import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { AWAY_TOKEN_ALPHA, createTokensRenderer } from './tokensRenderer'
import { SECRET_ITEM_ALPHA } from './constants'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * "VOLTO JÁ" no mapa do mestre: a ficha de quem saiu da mesa ganha o selo de
 * ausente (um disco pequeno no alto à direita) e o disco dela fica apagado, para
 * o mestre ver no canvas, sem abrir painel, que aquela ficha está travada
 * esperando. Só o disco apaga: o selo e o nome continuam nítidos.
 */

const GRID = 64

function ficha(overrides: Partial<Token> = {}): Token {
  return { id: 'ficha-ana', characterId: null, name: 'Ana', x: 100, y: 200, size: 1, image: null, ...overrides }
}

/** O visual da ficha (círculo ou foto) é o filho 0 do wrapper. */
function visualOf(container: Container): Container {
  const visual = container.children[0]?.children[0]
  if (visual === undefined) throw new Error('visual ausente')
  return visual
}

/** O selo mora no anel (filho 1): o wrapper continua com os 3 slots de sempre. */
function ringOf(container: Container): Graphics {
  const ring = container.children[0]?.children[1]
  if (!(ring instanceof Graphics)) throw new Error('anel ausente')
  return ring
}

describe('createTokensRenderer — selo de ausente do Volto já', () => {
  it('ficha de quem está no Volto já ganha o selo no alto à direita e fica apagada', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha()], GRID, null, 1, null, new Set(['ficha-ana']))

    const wrapper = container.children[0]
    expect(wrapper.alpha).toBe(1)
    expect(visualOf(container).alpha).toBe(AWAY_TOKEN_ALPHA)
    expect(AWAY_TOKEN_ALPHA).toBeLessThan(1)
    expect(AWAY_TOKEN_ALPHA).toBeGreaterThan(0.3)
    const selo = ringOf(container).getLocalBounds()
    const raio = GRID / 2 - 2
    // O selo sai do disco pelo alto à direita: é lá que o olho do mestre o acha.
    expect(selo.x + selo.width).toBeGreaterThan(raio)
    expect(selo.y).toBeLessThan(-raio / 2)
    expect(selo.width).toBeGreaterThan(0)
    expect(wrapper.children.length).toBe(3)
  })

  it('controle: ficha de quem está à mesa não ganha selo nem apaga', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha(), ficha({ id: 'ficha-bruno', name: 'Bruno' })], GRID, null, 1, null, new Set(['ficha-bruno']))
    expect(visualOf(container).alpha).toBe(1)
    expect(ringOf(container).getLocalBounds().width).toBe(0)
  })

  it('ao voltar, o selo sai e a ficha volta ao normal', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha()], GRID, null, 1, null, new Set(['ficha-ana']))
    renderer.draw(container, [ficha()], GRID, null, 1, null, new Set())
    expect(visualOf(container).alpha).toBe(1)
    expect(ringOf(container).getLocalBounds().width).toBe(0)
  })

  it('ficha secreta no Volto já continua secreta: o selo não a torna mais visível', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha({ secret: true })], GRID, null, 1, null, new Set(['ficha-ana']))
    expect(container.children[0].alpha).toBe(SECRET_ITEM_ALPHA)
    expect(visualOf(container).alpha).toBe(AWAY_TOKEN_ALPHA)
    expect(ringOf(container).getLocalBounds().width).toBeGreaterThan(0)
  })

  it('ficha com foto também ganha o selo, e a foto apaga no lugar do círculo', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha({ image: 'imgs/ana.png' })], GRID, null, 1, null, new Set(['ficha-ana']))
    expect(visualOf(container).alpha).toBe(AWAY_TOKEN_ALPHA)
    // A moldura da foto já ocupa o raio inteiro: o selo é o que passa dela.
    const raio = GRID / 2
    const selo = ringOf(container).getLocalBounds()
    expect(selo.x + selo.width).toBeGreaterThan(raio + 1)
    expect(selo.y).toBeLessThan(-raio - 1)
  })
})
