/**
 * BARRA DE VIDA — o desenho no mapa do mestre. Uma barra FINA logo SOB a
 * ficha, que não cobre o disco, é de CADA ficha e muda quando a vida muda
 * (régua e2e: `e2e/task-jornada-barra-de-vida.spec.ts`, testes 2 e 3).
 *
 * Desde a fatia 10 a vida vem da ficha do sistema ligada ao token
 * (`lib/vidaDaFicha.ts`), pelo parâmetro `vidas` do `draw`. A vida antiga
 * gravada no token (`Token.health`) fica no arquivo e não desenha nada.
 */
import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createTokensRenderer, type TokensRenderer } from './tokensRenderer'
import { HEALTH_BAR_COLORS, HEALTH_BAR_LABEL, healthBarLayout, tokenLabelTop } from './drawTokenHealth'
import type { Token, TokenHealth } from '../types/map'
import type { VidaDaFicha } from '../lib/vidaDaFicha'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

const GRID = 64
/** Raio do disco genérico no editor: meia célula menos 2 (`tokensRenderer.ts`). */
const RAIO = GRID / 2 - 2

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 100, y: 200, size: 1, image: null, ...extra }
}

const vida = (atual: number, maximo: number): VidaDaFicha => ({ atual, maximo })
const amount = (current: number, max: number) => ({ current, max })

/** O desenho do editor com as vidas das fichas ligadas (o resto no padrão). */
function desenhar(renderer: TokensRenderer, container: Container, tokens: Token[], vidas: Record<string, VidaDaFicha> = {}): void {
  renderer.draw(container, tokens, GRID, null, undefined, undefined, undefined, undefined, new Map(Object.entries(vidas)))
}

function barraDe(wrapper: Container): Graphics | undefined {
  return wrapper.children.find((c): c is Graphics => c instanceof Graphics && c.label === HEALTH_BAR_LABEL)
}

function rotuloDe(wrapper: Container): Text {
  const label = wrapper.children.find((c): c is Text => c instanceof Text)
  if (!label) throw new Error('rótulo ausente')
  return label
}

describe('createTokensRenderer — barra de vida da ficha do sistema', () => {
  it('ficha sem ficha do sistema não ganha barra: os mesmos 4 filhos de sempre e o nome colado no disco', () => {
    const container = new Container()
    desenhar(createTokensRenderer(), container, [ficha('og')])
    const wrapper = container.children[0]
    expect(barraDe(wrapper)).toBeUndefined()
    // visual, anel, nome e as marcas de condição (sempre presentes, vazias sem condição).
    expect(wrapper.children).toHaveLength(4)
    expect(rotuloDe(wrapper).position.y).toBe(RAIO + 2)
  })

  it('a vida antiga gravada no token (decisão 4.4) fica no arquivo e não desenha barra', () => {
    const container = new Container()
    const antiga: TokenHealth = { current: 7, max: 10, shownToPlayers: true }
    desenhar(createTokensRenderer(), container, [ficha('og', { health: antiga })])
    expect(barraDe(container.children[0])).toBeUndefined()
  })

  it('ficha ligada com vida ganha uma barra FINA logo abaixo do disco, centrada e mais estreita que ele', () => {
    const container = new Container()
    desenhar(createTokensRenderer(), container, [ficha('og')], { og: vida(7, 10) })
    const barra = barraDe(container.children[0])
    expect(barra, 'a ficha com vida deveria ter a barra').toBeDefined()
    const caixa = barra?.getLocalBounds()
    if (!caixa) throw new Error('sem caixa')
    // Abaixo do contorno de seleção (raio + 2): a barra não cobre o disco.
    expect(caixa.minY).toBeGreaterThanOrEqual(RAIO + 2)
    // Fina: bem menos alta que o disco.
    expect(caixa.maxY - caixa.minY).toBeLessThanOrEqual(RAIO / 4)
    // Não passa da largura da ficha e fica no meio dela.
    expect(caixa.maxX - caixa.minX).toBeLessThanOrEqual(2 * RAIO)
    expect(Math.abs((caixa.maxX + caixa.minX) / 2)).toBeLessThan(1)
  })

  it('o nome desce para baixo da barra, sem os dois se atropelarem', () => {
    const container = new Container()
    desenhar(createTokensRenderer(), container, [ficha('og')], { og: vida(7, 10) })
    const wrapper = container.children[0]
    const barra = barraDe(wrapper)
    expect(rotuloDe(wrapper).position.y).toBeGreaterThanOrEqual(barra?.getLocalBounds().maxY ?? Number.POSITIVE_INFINITY)
  })

  it('a barra é de CADA ficha: a vida do monstro não desenha nada sob o herói', () => {
    const container = new Container()
    desenhar(createTokensRenderer(), container, [ficha('lu'), ficha('og')], { og: vida(7, 10) })
    expect(barraDe(container.children[0])).toBeUndefined()
    expect(barraDe(container.children[1])).toBeDefined()
  })

  it('a ficha mudou (dano pela sala): o MESMO token redesenha a MESMA barra, menor; desligar a ficha tira a barra', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    const og = ficha('og')
    desenhar(renderer, container, [og], { og: vida(10, 10) })
    const wrapper = container.children[0]
    const cheia = barraDe(wrapper)
    const larguraCheia = cheia?.getLocalBounds().width ?? 0

    // O token é o MESMO objeto: só a ficha do sistema mudou.
    desenhar(renderer, container, [og], { og: vida(3, 10) })
    expect(barraDe(wrapper)).toBe(cheia)
    // A trilha continua do mesmo tamanho: o que encolhe é o preenchimento.
    expect(barraDe(wrapper)?.getLocalBounds().width).toBeCloseTo(larguraCheia, 6)
    const preenchimentos = (cheia?.context.instructions ?? []).filter((i) => i.action === 'fill')
    expect(preenchimentos.length).toBeGreaterThanOrEqual(2)

    desenhar(renderer, container, [og])
    expect(barraDe(wrapper)).toBeUndefined()
    expect(cheia?.destroyed).toBe(true)
    expect(wrapper.children).toHaveLength(4)
    expect(rotuloDe(wrapper).position.y).toBe(RAIO + 2)
  })

  it('HP grande da ficha (600 mil) desenha a proporção certa, sem teto escondido', () => {
    const container = new Container()
    desenhar(createTokensRenderer(), container, [ficha('og')], { og: vida(300_000, 600_000) })
    expect(barraDe(container.children[0])).toBeDefined()
    const metade = healthBarLayout(RAIO, amount(300_000, 600_000))
    expect(metade.fillWidth).toBeCloseTo(healthBarLayout(RAIO, amount(5, 10)).fillWidth, 6)
  })
})

describe('healthBarLayout — a geometria da barra', () => {
  it('o preenchimento acompanha a vida e a cor muda de estado', () => {
    const cheia = healthBarLayout(RAIO, amount(10, 10))
    const pouca = healthBarLayout(RAIO, amount(3, 10))
    const quase = healthBarLayout(RAIO, amount(2, 10))
    expect(pouca.fillWidth).toBeLessThan(cheia.fillWidth)
    expect(pouca.fillWidth).toBeCloseTo(cheia.fillWidth * 0.3, 6)
    expect(cheia.color).toBe(HEALTH_BAR_COLORS.fine)
    expect(pouca.color).toBe(HEALTH_BAR_COLORS.caution)
    expect(quase.color).toBe(HEALTH_BAR_COLORS.danger)
  })

  it('vivo com um fio de vida ainda mostra um ponto de barra; zero mostra a trilha vazia', () => {
    const fio = healthBarLayout(RAIO, amount(1, 419))
    expect(fio.fillWidth).toBeGreaterThan(0)
    expect(healthBarLayout(RAIO, amount(0, 10)).fillWidth).toBe(0)
  })

  it('o nome começa colado no disco sem barra e abaixo da barra com ela', () => {
    const layout = healthBarLayout(RAIO, amount(7, 10))
    expect(tokenLabelTop(RAIO, false)).toBe(RAIO + 2)
    expect(tokenLabelTop(RAIO, true)).toBeGreaterThanOrEqual(layout.y + layout.height)
  })
})
