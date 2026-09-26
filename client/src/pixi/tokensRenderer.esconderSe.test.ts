import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import { SECRET_ITEM_ALPHA } from './constants'
import type { Token } from '../types/map'
import { HIDDEN_OWN_TOKEN_ALPHA, playerTokenAlpha } from '../lib/tokenHiding'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * ESCONDER-SE na tela: no MESTRE a ficha oculta para jogadores ganha um anel
 * tracejado por fora (é ela que ele procura para "Revelar para todos"); na
 * tela do DONO ela sai esmaecida. Ficha de outro nunca esmaece: esmaecer
 * contaria que ela é segredo.
 */

const GRID = 64

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 'ficha-duda', characterId: null, name: 'Duda', x: 100, y: 200, size: 1, image: null, ...extra }
}

/** O anel da ficha sem foto: o primeiro `Graphics` depois do disco. */
function anelDe(container: Container): Graphics {
  const wrapper = container.children[0]
  if (!(wrapper instanceof Container)) throw new Error('wrapper ausente')
  const ring = wrapper.children.find((c, i): c is Graphics => i > 0 && c instanceof Graphics)
  if (!ring) throw new Error('anel ausente')
  return ring
}

describe('tokensRenderer (mestre): anel tracejado na ficha escondida', () => {
  it('ficha oculta para jogadores: esmaecida e com anel por fora do disco', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ficha({ secret: true })], GRID, null)
    expect(container.children[0]?.alpha).toBe(SECRET_ITEM_ALPHA)
    // O disco vai até GRID/2 - 2: o anel passa dele, visível mesmo sobre a foto.
    expect(anelDe(container).getLocalBounds().width).toBeGreaterThan(GRID - 4)
  })

  it('ficha à vista não ganha anel; "Revelar para todos" (secret desligado) tira o anel na hora', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha()], GRID, null)
    expect(anelDe(container).context.instructions).toHaveLength(0)
    renderer.draw(container, [ficha({ secret: true })], GRID, null)
    expect(anelDe(container).context.instructions.length).toBeGreaterThan(0)
    renderer.draw(container, [ficha({ secret: false })], GRID, null)
    expect(container.children[0]?.alpha).toBe(1)
    expect(anelDe(container).context.instructions).toHaveLength(0)
  })
})

describe('playerTokenAlpha (tela do jogador)', () => {
  it('a própria ficha escondida sai esmaecida; o resto, inteiro', () => {
    expect(playerTokenAlpha(ficha({ secret: true }), true)).toBe(HIDDEN_OWN_TOKEN_ALPHA)
    expect(HIDDEN_OWN_TOKEN_ALPHA).toBeGreaterThan(0.2)
    expect(HIDDEN_OWN_TOKEN_ALPHA).toBeLessThan(1)
    expect(playerTokenAlpha(ficha(), true)).toBe(1)
    expect(playerTokenAlpha(ficha({ secret: true }), false)).toBe(1)
  })
})
