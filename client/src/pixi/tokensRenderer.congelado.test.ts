import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * CONGELAR FICHA no mapa do MESTRE: a ficha congelada ganha o floco no alto à
 * esquerda — depois do "Congelar todos" o mestre vê, sem abrir painel, quem
 * está segurado. O floco mora no anel, como o selo do Volto já: o wrapper
 * continua com os slots de sempre.
 */

const GRID = 64

function ficha(overrides: Partial<Token> = {}): Token {
  return { id: 'ficha-ana', characterId: null, name: 'Ana', x: 100, y: 200, size: 1, image: null, ...overrides }
}

function ringOf(container: Container): Graphics {
  const ring = container.children[0]?.children[1]
  if (!(ring instanceof Graphics)) throw new Error('anel ausente')
  return ring
}

describe('createTokensRenderer — floco da ficha congelada', () => {
  it('congelada: o floco sai do disco pelo alto à esquerda, sem slot novo', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ficha({ congelado: true })], GRID)
    const floco = ringOf(container).getLocalBounds()
    const raio = GRID / 2 - 2
    expect(floco.width).toBeGreaterThan(0)
    expect(floco.x).toBeLessThan(-raio)
    expect(floco.y).toBeLessThan(-raio / 2)
    expect(container.children[0]?.children.length).toBe(4)
  })

  it('controle: solta, o anel fica vazio; descongelar apaga o floco', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha()], GRID)
    expect(ringOf(container).getLocalBounds().width).toBe(0)
    renderer.draw(container, [ficha({ congelado: true })], GRID)
    expect(ringOf(container).getLocalBounds().width).toBeGreaterThan(0)
    renderer.draw(container, [ficha()], GRID)
    expect(ringOf(container).getLocalBounds().width).toBe(0)
  })
})
