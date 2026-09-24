import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import { TURN_RING_GAP } from './constants'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

const GRID = 50

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null }
}

/** O anel de cada ficha (filho 1 do wrapper: 0 é o visual, ver tokensRenderer.ts). */
function larguraDoAnel(container: Container, index: number): number {
  const wrapper = container.children[index]
  if (!(wrapper instanceof Container)) throw new Error('sem wrapper')
  const ring = wrapper.children[1]
  if (!(ring instanceof Graphics)) throw new Error('sem anel')
  return ring.getLocalBounds().width
}

describe('createTokensRenderer — a ficha da vez fica destacada no mapa do mestre', () => {
  it('só a ficha da vez ganha o anel por fora do disco, e ele sai quando a vez sai', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    const raio = GRID / 2 - 2

    renderer.draw(container, tokens, GRID, null, 1)
    expect(larguraDoAnel(container, 0)).toBe(0)
    expect(larguraDoAnel(container, 1)).toBe(0)

    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    expect(larguraDoAnel(container, 0)).toBe(0)
    expect(larguraDoAnel(container, 1)).toBeGreaterThanOrEqual(2 * (raio + TURN_RING_GAP))

    renderer.draw(container, tokens, GRID, null, 1, null)
    expect(larguraDoAnel(container, 1)).toBe(0)
  })
})
