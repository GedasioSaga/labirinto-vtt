import { describe, expect, it, vi } from 'vitest'
import { Container, Ticker } from 'pixi.js'
import { createTokensRenderer, TOKEN_LIFT_SCALE, type TokenGlideContext, type TokensMotion } from './tokensRenderer'
import { TOKEN_GLIDE_MS } from '../player/tokenGlide'
import { theme } from '../theme'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * A ficha na mão do mestre e a ficha que o jogador anda, no mapa do mestre:
 * pegar levanta a ficha da mesa, soltar assenta; o passo do jogador desliza
 * do lugar antigo ao novo. O resto (arrasto, setas, desfazer) continua pulando
 * direto, porque foi a mão do mestre que pôs a ficha lá.
 */

const GRID = 50
const LEVANTAR_MS = Number.parseFloat(theme.motion.fast)
const ASSENTAR_MS = Number.parseFloat(theme.motion.base)
const NENHUM: ReadonlySet<string> = new Set()

function ficha(id: string, x: number, y = 100): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function relogio(reduzido = false) {
  const ticker = new Ticker()
  let agora = 1000
  const motion: TokensMotion = { ticker, reducedMotion: () => reduzido, now: () => agora }
  return {
    ticker,
    motion,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

function wrapperDe(container: Container, index: number): Container {
  const wrapper = container.children[index]
  if (!(wrapper instanceof Container)) throw new Error('sem wrapper')
  return wrapper
}

function cena(remoteMoveIds: ReadonlySet<string> = NENHUM, sceneId = 'torre'): TokenGlideContext {
  return { sceneId, remoteMoveIds }
}

describe('levantar — a ficha na mão do mestre sai da mesa', () => {
  it('pegar: cresce até TOKEN_LIFT_SCALE no tempo curto do tema e fica assim enquanto está na mão', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID)

    renderer.levantar('a')
    const wrapper = wrapperDe(container, 0)
    expect(wrapper.scale.x).toBe(1)
    quadro(LEVANTAR_MS / 2)
    expect(wrapper.scale.x).toBeGreaterThan(1)
    expect(wrapper.scale.x).toBeLessThan(TOKEN_LIFT_SCALE)
    quadro(LEVANTAR_MS / 2)
    expect(wrapper.scale.x).toBeCloseTo(TOKEN_LIFT_SCALE, 9)
    expect(wrapper.scale.y).toBeCloseTo(TOKEN_LIFT_SCALE, 9)
    expect(ticker.count).toBe(0)
  })

  it('soltar: assenta de volta em 1 no tempo base do tema', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID)
    renderer.levantar('a')
    quadro(LEVANTAR_MS)

    renderer.levantar(null)
    quadro(ASSENTAR_MS / 2)
    const wrapper = wrapperDe(container, 0)
    expect(wrapper.scale.x).toBeLessThan(TOKEN_LIFT_SCALE)
    expect(wrapper.scale.x).toBeGreaterThan(1)
    quadro(ASSENTAR_MS / 2)
    expect(wrapper.scale.x).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('soltar no meio do levantar: assenta de onde está, sem subir até o fim antes', () => {
    const { motion, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID)
    renderer.levantar('a')
    quadro(LEVANTAR_MS / 3)
    const wrapper = wrapperDe(container, 0)
    const meio = wrapper.scale.x

    renderer.levantar(null)
    quadro(1)
    expect(wrapper.scale.x).toBeLessThanOrEqual(meio)
    quadro(ASSENTAR_MS)
    expect(wrapper.scale.x).toBe(1)
  })

  it('pegar outra ficha: a anterior assenta e a nova levanta', () => {
    const { motion, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100), ficha('b', 300)], GRID)
    renderer.levantar('a')
    quadro(LEVANTAR_MS)

    renderer.levantar('b')
    quadro(ASSENTAR_MS)
    expect(wrapperDe(container, 0).scale.x).toBe(1)
    expect(wrapperDe(container, 1).scale.x).toBeCloseTo(TOKEN_LIFT_SCALE, 9)
  })

  it('o redesenho de cada passo do arrasto não desfaz a escala da ficha na mão', () => {
    const { motion, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID)
    renderer.levantar('a')
    quadro(LEVANTAR_MS / 2)
    renderer.draw(container, [ficha('a', 150)], GRID, 'a')
    quadro(LEVANTAR_MS)
    renderer.draw(container, [ficha('a', 200)], GRID, 'a')
    expect(wrapperDe(container, 0).scale.x).toBeCloseTo(TOKEN_LIFT_SCALE, 9)
  })

  it('id que não está no mapa (clone ainda não desenhado): ignorado, sem relógio', () => {
    const { motion, ticker } = relogio()
    const renderer = createTokensRenderer(motion)
    renderer.draw(new Container(), [ficha('a', 100)], GRID)
    expect(() => renderer.levantar('fantasma')).not.toThrow()
    expect(ticker.count).toBe(0)
  })

  it('movimento reduzido: a ficha não muda de tamanho', () => {
    const { motion, quadro, ticker } = relogio(true)
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID)
    renderer.levantar('a')
    quadro(LEVANTAR_MS)
    expect(wrapperDe(container, 0).scale.x).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('sem relógio de quadros: a ficha não muda de tamanho', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha('a', 100)], GRID)
    renderer.levantar('a')
    expect(wrapperDe(container, 0).scale.x).toBe(1)
  })

  it('CASO OBRIGATÓRIO: a ficha some no meio do levantar — o quadro seguinte não quebra e o relógio solta', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID)
    renderer.levantar('a')
    renderer.draw(container, [], GRID)
    expect(() => quadro(16)).not.toThrow()
    expect(ticker.count).toBe(0)
    expect(() => renderer.levantar(null)).not.toThrow()
  })

  it('desmonte (cancelarAnimacoes): sai do relógio na hora', () => {
    const { motion, ticker } = relogio()
    const renderer = createTokensRenderer(motion)
    renderer.draw(new Container(), [ficha('a', 100)], GRID)
    renderer.levantar('a')
    expect(ticker.count).toBe(1)
    renderer.cancelarAnimacoes()
    expect(ticker.count).toBe(0)
  })
})

describe('deslize — a ficha que o JOGADOR andou percorre o caminho na tela do mestre', () => {
  it('passo do jogador: parte do lugar antigo e chega ao novo em TOKEN_GLIDE_MS', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena())

    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena(new Set(['a'])))
    const wrapper = wrapperDe(container, 0)
    expect(wrapper.x).toBe(100)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(wrapper.x).toBeGreaterThan(100)
    expect(wrapper.x).toBeLessThan(300)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(wrapper.x).toBe(300)
    expect(wrapper.y).toBe(100)
    expect(ticker.count).toBe(0)
  })

  it('ficha que o MESTRE mexeu (arrasto, setas, desfazer): vai direto, sem deslize', () => {
    const { motion, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena())
    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena())
    expect(wrapperDe(container, 0).x).toBe(300)
    expect(ticker.count).toBe(0)
  })

  it('redesenho sem relação no meio do deslize (seleção, outra ficha) não corta o caminho', () => {
    const { motion, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100), ficha('b', 500)], GRID, null, 1, null, undefined, cena())
    renderer.draw(container, [ficha('a', 300), ficha('b', 500)], GRID, null, 1, null, undefined, cena(new Set(['a'])))
    quadro(TOKEN_GLIDE_MS / 4)
    const antes = wrapperDe(container, 0).x

    renderer.draw(container, [ficha('a', 300), ficha('b', 500)], GRID, 'b', 1, null, undefined, cena())
    expect(wrapperDe(container, 0).x).toBeGreaterThanOrEqual(antes)
    expect(wrapperDe(container, 0).x).toBeLessThan(300)
    quadro(TOKEN_GLIDE_MS)
    expect(wrapperDe(container, 0).x).toBe(300)
  })

  it('o mestre mexe na ficha no meio do deslize (Ctrl+Z, setas): ela vai direto ao lugar novo', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena())
    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena(new Set(['a'])))
    quadro(TOKEN_GLIDE_MS / 4)

    renderer.draw(container, [ficha('a', 100, 400)], GRID, null, 1, null, undefined, cena())
    expect(wrapperDe(container, 0).position).toMatchObject({ x: 100, y: 400 })
    quadro(16)
    expect(wrapperDe(container, 0).position).toMatchObject({ x: 100, y: 400 })
    expect(ticker.count).toBe(0)
  })

  it('a ficha na mão do mestre não desliza atrás do ponteiro, nem com passo do jogador', () => {
    const { motion } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena())
    renderer.levantar('a')
    renderer.draw(container, [ficha('a', 300)], GRID, 'a', 1, null, undefined, cena(new Set(['a'])))
    expect(wrapperDe(container, 0).x).toBe(300)
  })

  it('troca de cena: a ficha aparece no lugar, sem atravessar a tela', () => {
    const { motion } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena(NENHUM, 'torre'))
    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena(new Set(['a']), 'cripta'))
    expect(wrapperDe(container, 0).x).toBe(300)
  })

  it('desenho sem contexto de deslize (exportação de imagem): tudo no lugar final, deslize em curso acaba já', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena())
    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena(new Set(['a'])))
    quadro(TOKEN_GLIDE_MS / 4)

    renderer.draw(container, [ficha('a', 300)], GRID)
    expect(wrapperDe(container, 0).x).toBe(300)
    quadro(16)
    expect(ticker.count).toBe(0)
  })

  it('movimento reduzido: o passo do jogador vai direto', () => {
    const { motion } = relogio(true)
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena())
    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena(new Set(['a'])))
    expect(wrapperDe(container, 0).x).toBe(300)
  })

  it('ficha que acabou de aparecer (entrou na cena pelo jogador): aparece no lugar', () => {
    const { motion } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [], GRID, null, 1, null, undefined, cena())
    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena(new Set(['a'])))
    expect(wrapperDe(container, 0).x).toBe(300)
  })

  it('CASO OBRIGATÓRIO: a ficha some no meio do deslize — o quadro seguinte não quebra e o relógio solta', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('a', 100)], GRID, null, 1, null, undefined, cena())
    renderer.draw(container, [ficha('a', 300)], GRID, null, 1, null, undefined, cena(new Set(['a'])))
    renderer.draw(container, [], GRID, null, 1, null, undefined, cena())
    expect(() => quadro(16)).not.toThrow()
    expect(ticker.count).toBe(0)
  })
})
