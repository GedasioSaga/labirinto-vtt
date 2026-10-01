import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text, Ticker } from 'pixi.js'
import { createTokensRenderer, TURN_RING_LABEL, TURN_RING_PULSE_FROM_SCALE, type TokensMotion } from './tokensRenderer'
import { TURN_RING_GAP } from './constants'
import { CONDITION_MARKS_LABEL } from './drawTokenConditions'
import { theme } from '../theme'
import type { Token } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

const GRID = 50
const PULSO_MS = Number.parseFloat(theme.motion.base)

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null }
}

function wrapperDe(container: Container, index: number): Container {
  const wrapper = container.children[index]
  if (!(wrapper instanceof Container)) throw new Error('sem wrapper')
  return wrapper
}

/** O anel da vez: Graphics próprio, achado pelo nome (ver tokensRenderer.ts). */
function anelDaVez(container: Container, index: number): Graphics | undefined {
  return wrapperDe(container, index).children.find((c): c is Graphics => c instanceof Graphics && c.label === TURN_RING_LABEL)
}

function larguraDoAnelDaVez(container: Container, index: number): number {
  return anelDaVez(container, index)?.getLocalBounds().width ?? 0
}

/** O anel da ficha (filho 1 do wrapper: 0 é o visual) — moldura, seleção e selos, não mais a vez. */
function larguraDoAnelDaFicha(container: Container, index: number): number {
  const ring = wrapperDe(container, index).children[1]
  if (!(ring instanceof Graphics)) throw new Error('sem anel')
  return ring.getLocalBounds().width
}

/** Relógio de mentira: `quadro(ms)` anda o tempo e emite um quadro do Ticker real do Pixi. */
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

describe('createTokensRenderer — a ficha da vez fica destacada no mapa do mestre', () => {
  it('só a ficha da vez ganha o anel por fora do disco, e ele sai quando a vez sai', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    const raio = GRID / 2 - 2

    renderer.draw(container, tokens, GRID, null, 1)
    expect(anelDaVez(container, 0)).toBeUndefined()
    expect(anelDaVez(container, 1)).toBeUndefined()

    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    expect(anelDaVez(container, 0)).toBeUndefined()
    expect(larguraDoAnelDaVez(container, 1)).toBeGreaterThanOrEqual(2 * (raio + TURN_RING_GAP))
    // O anel da vez é dele: o anel da ficha (moldura, selos) continua vazio no disco sem foto.
    expect(larguraDoAnelDaFicha(container, 1)).toBe(0)

    renderer.draw(container, tokens, GRID, null, 1, null)
    expect(anelDaVez(container, 1)).toBeUndefined()
  })

  it('a ficha sem a vez guarda os 4 filhos de sempre (visual, anel, nome, marcas)', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha('lanterna', 100), ficha('machado', 400)], GRID, null, 1, 'machado')
    expect(wrapperDe(container, 0).children).toHaveLength(4)
  })

  it('o anel da vez fica logo acima do anel da ficha e por baixo do nome e das marcas, como era', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ficha('machado', 400)], GRID, null, 1, 'machado')
    const wrapper = wrapperDe(container, 0)
    const vez = anelDaVez(container, 0)
    if (!vez) throw new Error('sem anel da vez')
    const indiceDoNome = wrapper.children.findIndex((c) => c instanceof Text)
    const indiceDasMarcas = wrapper.children.findIndex((c) => c.label === CONDITION_MARKS_LABEL)
    expect(wrapper.getChildIndex(vez)).toBe(2)
    expect(wrapper.getChildIndex(vez)).toBeLessThan(indiceDoNome)
    expect(wrapper.getChildIndex(vez)).toBeLessThan(indiceDasMarcas)
  })
})

describe('createTokensRenderer — o anel da vez entra com pulso quando a vez passa', () => {
  it('a vez passa: o anel nasce maior e transparente e fecha sobre a ficha no tempo base do tema', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')

    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    const anel = anelDaVez(container, 1)
    if (!anel) throw new Error('sem anel da vez')
    expect(anel.scale.x).toBeCloseTo(TURN_RING_PULSE_FROM_SCALE, 9)
    expect(anel.alpha).toBe(0)

    quadro(PULSO_MS / 2)
    expect(anel.scale.x).toBeLessThan(TURN_RING_PULSE_FROM_SCALE)
    expect(anel.scale.x).toBeGreaterThan(1)
    expect(anel.alpha).toBeGreaterThan(0)
    expect(anel.alpha).toBeLessThan(1)

    quadro(PULSO_MS / 2)
    expect(anel.scale.x).toBe(1)
    expect(anel.alpha).toBe(1)
    // Parado, não custa nada: o renderer sai do relógio.
    expect(ticker.count).toBe(0)
  })

  it('redesenhar com a MESMA vez (arrasto, seleção) não recomeça o pulso nem pulsa de novo depois', () => {
    const { motion, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')
    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    quadro(PULSO_MS / 2)
    const anel = anelDaVez(container, 1)
    if (!anel) throw new Error('sem anel da vez')
    const meio = anel.scale.x

    renderer.draw(container, tokens, GRID, 'machado', 1, 'machado')
    expect(anel.scale.x).toBe(meio)
    quadro(PULSO_MS)
    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    expect(anel.scale.x).toBe(1)
    expect(anel.alpha).toBe(1)
  })

  it('abrir o mapa com o combate andando: o anel já está lá, sem pulso', () => {
    const { motion, ticker } = relogio()
    const container = new Container()
    createTokensRenderer(motion).draw(container, [ficha('machado', 400)], GRID, null, 1, 'machado')
    const anel = anelDaVez(container, 0)
    expect(anel?.scale.x).toBe(1)
    expect(anel?.alpha).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('movimento reduzido: o anel aparece parado, sem entrar no relógio', () => {
    const { motion, ticker } = relogio(true)
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')
    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    expect(anelDaVez(container, 1)?.scale.x).toBe(1)
    expect(anelDaVez(container, 1)?.alpha).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('vez passada pelo teclado (Shift+N): atalho não anima, o anel aparece parado', () => {
    const { motion, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')
    renderer.semPulsoDaVez(() => renderer.draw(container, tokens, GRID, null, 1, 'machado'))
    expect(anelDaVez(container, 1)?.scale.x).toBe(1)
    expect(anelDaVez(container, 1)?.alpha).toBe(1)
    expect(ticker.count).toBe(0)

    // Depois do atalho, a vez passada pelo painel volta a pulsar.
    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')
    expect(anelDaVez(container, 0)?.alpha).toBe(0)
  })

  it('a vez anda de novo no meio do pulso: a ficha anterior perde o anel e a nova pulsa do começo', () => {
    const { motion, quadro } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')
    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    quadro(PULSO_MS / 3)

    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')
    expect(anelDaVez(container, 1)).toBeUndefined()
    expect(anelDaVez(container, 0)?.scale.x).toBeCloseTo(TURN_RING_PULSE_FROM_SCALE, 9)
    expect(anelDaVez(container, 0)?.alpha).toBe(0)
  })

  it('CASO OBRIGATÓRIO: a ficha da vez sai do mapa no meio do pulso — o quadro seguinte não quebra e o relógio solta', () => {
    const { motion, quadro, ticker } = relogio()
    const container = new Container()
    const renderer = createTokensRenderer(motion)
    renderer.draw(container, [ficha('lanterna', 100), ficha('machado', 400)], GRID, null, 1, 'lanterna')
    renderer.draw(container, [ficha('lanterna', 100), ficha('machado', 400)], GRID, null, 1, 'machado')
    renderer.draw(container, [ficha('lanterna', 100)], GRID, null, 1, 'machado')
    expect(() => quadro(16)).not.toThrow()
    expect(ticker.count).toBe(0)
  })

  it('sem relógio de quadros (exportação de imagem, testes antigos): o anel aparece parado', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const tokens = [ficha('lanterna', 100), ficha('machado', 400)]
    renderer.draw(container, tokens, GRID, null, 1, 'lanterna')
    renderer.draw(container, tokens, GRID, null, 1, 'machado')
    expect(anelDaVez(container, 1)?.scale.x).toBe(1)
    expect(anelDaVez(container, 1)?.alpha).toBe(1)
  })
})
