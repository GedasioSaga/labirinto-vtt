import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import { TOKEN_FRAME_COLOR, TOKEN_FRAME_WIDTH } from './constants'
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

/** 1x1 px transparente: forma válida de foto embutida, pequena o bastante para o teste. */
const FOTO_EMBUTIDA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

/** Único filho de `wrapper` que representa o visual do token (Sprite ou
 *  Graphics do círculo) — ring/label também são Graphics/Text, então
 *  distinguir exige olhar o índice 0, que é sempre o visual (ver
 *  ensureSprite/ensureGraphics em tokensRenderer.ts). */
function visualOf(wrapper: Container): Container['children'][number] {
  return wrapper.children[0]
}

describe('createTokensRenderer — nome com tamanho mínimo na tela', () => {
  function labelOf(container: Container): Text {
    const label = (container.children[0] as Container).children.find((c): c is Text => c instanceof Text)
    if (!label) throw new Error('rótulo ausente')
    return label
  }

  it('a 50% o nome de 12 px de mundo vira 11 px de tela; abaixo de 30% some; a 100% volta a escala 1', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [buildToken()], GRID, null, 0.5)
    const label = labelOf(container)
    expect(12 * 0.5 * label.scale.x).toBeCloseTo(11, 6)
    expect(label.visible).toBe(true)

    renderer.setCameraScale(0.2)
    expect(label.visible).toBe(false)

    renderer.draw(container, [buildToken()], GRID)
    expect(label.visible).toBe(false)

    renderer.setCameraScale(1)
    expect(label.visible).toBe(true)
    expect(label.scale.x).toBe(1)
  })
})

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

  it('a foto fica DENTRO da moldura: o lado do sprite é o diâmetro menos a moldura dos dois lados', () => {
    // Mudou de propósito (pedido do usuário, 17/09/2026): antes o sprite
    // ocupava a célula inteira e a foto vazava para os cantos do quadrado.
    // Agora ela é recortada no círculo de raio `raio - TOKEN_FRAME_WIDTH`.
    const token = buildToken({ image: 'C:\\imgs\\heroi.png', size: 2 })
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [token], GRID, null)

    const sprite = visualOf(container.children[0]) as Sprite
    const ladoEsperado = GRID * 2 - TOKEN_FRAME_WIDTH * 2
    expect(sprite.width).toBe(ladoEsperado)
    expect(sprite.height).toBe(ladoEsperado)
  })

  it('o sprite tem máscara circular: a foto sai RECORTADA no círculo, não no quadrado', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [buildToken({ image: 'C:\\imgs\\heroi.png' })], GRID, null)

    const sprite = visualOf(container.children[0]) as Sprite
    const mask = sprite.mask
    expect(mask).toBeInstanceOf(Graphics)
    const desenho = mask as Graphics
    // Preenchimento de verdade, e do tamanho do círculo interno: sem isto a
    // máscara existiria sem recortar nada.
    expect(desenho.context.instructions.filter((i) => i.action === 'fill')).toHaveLength(1)
    expect(desenho.getLocalBounds().width).toBeCloseTo(GRID - TOKEN_FRAME_WIDTH * 2, 6)
  })

  it('a moldura aparece mesmo SEM seleção — foi a queixa: anel só existia no token selecionado', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [buildToken({ image: 'C:\\imgs\\heroi.png' })], GRID, null)

    const ring = container.children[0].children[1] as Graphics
    const strokes = ring.context.instructions.filter((i) => i.action === 'stroke')
    expect(strokes).toHaveLength(1)
    expect((strokes[0]?.data as { style?: { color?: number } })?.style?.color).toBe(TOKEN_FRAME_COLOR)
  })

  it('CONTROLE: token SEM foto não ganha moldura no anel (senão o teste acima passaria por acidente)', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [buildToken({ image: null })], GRID, null)

    const ring = container.children[0].children[1] as Graphics
    expect(ring.context.instructions.filter((i) => i.action === 'stroke')).toHaveLength(0)
  })

  it('a foto embutida do jogador (data URL) desenha sprite igual, sem passar pelo convertFileSrc do Tauri', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    // `image: null` com a foto só em `imageData` é a forma que o host grava
    // quando o JOGADOR escolhe a foto na tela dele.
    renderer.draw(container, [buildToken({ image: null, imageData: FOTO_EMBUTIDA })], GRID, null)

    expect(visualOf(container.children[0])).toBeInstanceOf(Sprite)
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

describe('createTokensRenderer — token "Oculto no editor" vira fantasma', () => {
  /** Anel é o filho 1 do wrapper: [visual, ring, label] (ver ensureGraphics). */
  function ringOf(wrapper: Container): Graphics {
    return wrapper.children[1] as Graphics
  }

  it('continua visível (clicável), bem transparente e com contorno no anel', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [buildToken({ hidden: true })], GRID, null)

    const wrapper = container.children[0]
    expect(wrapper.visible).toBe(true)
    expect(wrapper.alpha).toBeLessThan(0.5)
    expect(ringOf(wrapper).getLocalBounds().width).toBeGreaterThan(0)
  })

  it('token normal não ganha contorno, e desocultar tira o fantasma', () => {
    const container = new Container()
    const renderer = createTokensRenderer()

    renderer.draw(container, [buildToken({ hidden: true })], GRID, null)
    renderer.draw(container, [buildToken({ hidden: false })], GRID, null)

    const wrapper = container.children[0]
    expect(wrapper.alpha).toBe(1)
    expect(ringOf(wrapper).getLocalBounds().width).toBe(0)
  })
})
