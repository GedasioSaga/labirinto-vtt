import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

function buildToken(overrides: Partial<Token> = {}): Token {
  return {
    id: 'token-1',
    characterId: null,
    name: 'Herói',
    x: 100,
    y: 200,
    size: 1,
    image: null,
    ...overrides,
  }
}

const GRID = 64

/** Único filho de `wrapper` que representa o visual do token (Sprite ou
 *  Graphics do círculo) — ring/label também são Graphics/Text, então
 *  distinguir exige olhar o índice 0, que é sempre o visual (ver
 *  ensureSprite/ensureGraphics em tokensRenderer.ts). */
function visualOf(wrapper: Container): Container['children'][number] {
  return wrapper.children[0]
}

describe('createTokensRenderer — ciclo de vida (risco nº 3 do plano)', () => {
  it('instanciar, desenhar, destruir e reinstanciar duas vezes: children.length sempre bate com tokens.length', () => {
    const tokens = [buildToken({ id: 't1' }), buildToken({ id: 't2', image: 'C:\\imgs\\heroi.png' })]

    for (let mount = 0; mount < 3; mount += 1) {
      const container = new Container()
      const renderer = createTokensRenderer()

      renderer.draw(container, tokens, GRID, null)
      expect(container.children.length).toBe(tokens.length)

      // Simula o destroy(true, {children:true}) que o PixiCanvas real dispara
      // no unmount do StrictMode — se o cache do renderer vazasse pra fora do
      // closure (bug documentado em drawProps.ts:10-16), o próximo mount
      // reaproveitaria um wrapper/sprite já destruído aqui.
      container.destroy({ children: true })
    }
  })

  it('renderer novo em container novo nunca reaproveita objeto destruído do mount anterior (sem sprite fantasma)', () => {
    const tokens = [buildToken({ id: 't1', image: 'C:\\imgs\\heroi.png' })]

    const containerA = new Container()
    const rendererA = createTokensRenderer()
    rendererA.draw(containerA, tokens, GRID, null)
    const wrapperA = containerA.children[0]
    containerA.destroy({ children: true })
    expect(wrapperA.destroyed).toBe(true)

    const containerB = new Container()
    const rendererB = createTokensRenderer()
    rendererB.draw(containerB, tokens, GRID, null)

    expect(containerB.children.length).toBe(1)
    const wrapperB = containerB.children[0]
    expect(wrapperB).not.toBe(wrapperA)
    expect(wrapperB.destroyed).toBe(false)
  })

  it('redraw sem o token remove o wrapper do container (mesmo padrão de createRegionsRenderer)', () => {
    const tokens = [buildToken({ id: 't1' }), buildToken({ id: 't2' })]
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, tokens, GRID, null)
    const firstWrapper = container.children[0]

    renderer.draw(container, tokens.slice(1), GRID, null)

    expect(container.children.length).toBe(1)
    expect(container.children.includes(firstWrapper)).toBe(false)
    expect(firstWrapper.destroyed).toBe(true)
  })
})

describe('createTokensRenderer — token sem imagem (image: null)', () => {
  it('desenha o círculo genérico, idêntico ao drawTokens.ts original', () => {
    const token = buildToken({ image: null })
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [token], GRID, null)

    const wrapper = container.children[0]
    const visual = visualOf(wrapper)
    expect(visual).toBeInstanceOf(Graphics)
    const g = visual as Graphics
    expect(g.context.instructions.filter((i) => i.action === 'fill')).toHaveLength(1)
    expect(g.context.instructions.filter((i) => i.action === 'stroke')).toHaveLength(1)
    // Não selecionado: traço fino (2), não o de seleção (4).
    const strokeInstruction = g.context.instructions.find((i) => i.action === 'stroke')
    expect((strokeInstruction?.data as { style?: { width?: number } })?.style?.width).toBe(2)
  })

  it('token selecionado ganha traço mais grosso (4) na cor de seleção', () => {
    const token = buildToken({ image: null })
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [token], GRID, token.id)

    const g = visualOf(container.children[0]) as Graphics
    const strokeInstruction = g.context.instructions.find((i) => i.action === 'stroke')
    expect((strokeInstruction?.data as { style?: { width?: number } })?.style?.width).toBe(4)
  })

  it('rótulo de nome é um filho Text do wrapper, com o texto do token', () => {
    const token = buildToken({ name: 'Goblin Batedor', image: null })
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [token], GRID, null)

    const label = container.children[0].children.find((c): c is Text => c instanceof Text)
    expect(label?.text).toBe('Goblin Batedor')
  })
})

describe('createTokensRenderer — token com imagem (image !== null)', () => {
  it('cria um Sprite como visual, não o Graphics de círculo', () => {
    const token = buildToken({ image: 'C:\\imgs\\heroi.png' })
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [token], GRID, null)

    const visual = visualOf(container.children[0])
    expect(visual).toBeInstanceOf(Sprite)
  })

  it('sprite.width/height cobrem o diâmetro inteiro da célula (gridSize * size)', () => {
    const token = buildToken({ image: 'C:\\imgs\\heroi.png', size: 2 })
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [token], GRID, null)

    const sprite = visualOf(container.children[0]) as Sprite
    expect(sprite.width).toBe(GRID * 2)
    expect(sprite.height).toBe(GRID * 2)
  })

  it('trocar de imagem para null no redraw substitui o Sprite pelo círculo genérico (sem restos do sprite antigo)', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [buildToken({ image: 'C:\\imgs\\heroi.png' })], GRID, null)
    const wrapper = container.children[0]
    expect(visualOf(wrapper)).toBeInstanceOf(Sprite)

    renderer.draw(container, [buildToken({ image: null })], GRID, null)

    expect(container.children.length).toBe(1)
    expect(wrapper.children.length).toBe(3) // visual (Graphics) + ring + label, sempre os 3 mesmos slots do wrapper
    expect(visualOf(wrapper)).toBeInstanceOf(Graphics)
  })

  it('trocar de null para imagem no redraw substitui o círculo pelo Sprite', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [buildToken({ image: null })], GRID, null)
    expect(visualOf(container.children[0])).toBeInstanceOf(Graphics)

    renderer.draw(container, [buildToken({ image: 'C:\\imgs\\heroi.png' })], GRID, null)

    expect(container.children.length).toBe(1)
    expect(visualOf(container.children[0])).toBeInstanceOf(Sprite)
  })
})
