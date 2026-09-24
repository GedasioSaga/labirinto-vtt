/**
 * BARRA DE VIDA — o desenho no mapa do mestre. Uma barra FINA logo SOB a
 * ficha, que não cobre o disco, é de CADA ficha e muda quando a vida muda
 * (régua e2e: `e2e/task-jornada-barra-de-vida.spec.ts`, testes 2 e 3).
 */
import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createTokensRenderer } from './tokensRenderer'
import { HEALTH_BAR_COLORS, HEALTH_BAR_LABEL, healthBarLayout, tokenLabelTop } from './drawTokenHealth'
import type { Token, TokenHealth } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

const GRID = 64
/** Raio do disco genérico no editor: meia célula menos 2 (`tokensRenderer.ts`). */
const RAIO = GRID / 2 - 2

function ficha(id: string, health?: TokenHealth): Token {
  const token: Token = { id, characterId: null, name: id, x: 100, y: 200, size: 1, image: null }
  if (health !== undefined) token.health = health
  return token
}

const vida = (current: number, max: number): TokenHealth => ({ current, max, shownToPlayers: false })

function barraDe(wrapper: Container): Graphics | undefined {
  return wrapper.children.find((c): c is Graphics => c instanceof Graphics && c.label === HEALTH_BAR_LABEL)
}

function rotuloDe(wrapper: Container): Text {
  const label = wrapper.children.find((c): c is Text => c instanceof Text)
  if (!label) throw new Error('rótulo ausente')
  return label
}

describe('createTokensRenderer — barra de vida', () => {
  it('ficha sem vida não ganha barra: os mesmos 4 filhos de sempre e o nome colado no disco', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ficha('og')], GRID, null)
    const wrapper = container.children[0]
    expect(barraDe(wrapper)).toBeUndefined()
    // visual, anel, nome e as marcas de condição (sempre presentes, vazias sem condição).
    expect(wrapper.children).toHaveLength(4)
    expect(rotuloDe(wrapper).position.y).toBe(RAIO + 2)
  })

  it('ficha com vida ganha uma barra FINA logo abaixo do disco, centrada e mais estreita que ele', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ficha('og', vida(7, 10))], GRID, null)
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
    createTokensRenderer().draw(container, [ficha('og', vida(7, 10))], GRID, null)
    const wrapper = container.children[0]
    const barra = barraDe(wrapper)
    expect(rotuloDe(wrapper).position.y).toBeGreaterThanOrEqual(barra?.getLocalBounds().maxY ?? Number.POSITIVE_INFINITY)
  })

  it('a barra é de CADA ficha: dar vida ao monstro não desenha nada sob o herói', () => {
    const container = new Container()
    createTokensRenderer().draw(container, [ficha('lu'), ficha('og', vida(7, 10))], GRID, null)
    expect(barraDe(container.children[0])).toBeUndefined()
    expect(barraDe(container.children[1])).toBeDefined()
  })

  it('mudar a vida redesenha a MESMA barra, menor; tirar a vida tira a barra e devolve o nome ao lugar', () => {
    const container = new Container()
    const renderer = createTokensRenderer()
    renderer.draw(container, [ficha('og', vida(10, 10))], GRID, null)
    const wrapper = container.children[0]
    const cheia = barraDe(wrapper)
    const larguraCheia = cheia?.getLocalBounds().width ?? 0

    renderer.draw(container, [ficha('og', vida(3, 10))], GRID, null)
    expect(barraDe(wrapper)).toBe(cheia)
    // A trilha continua do mesmo tamanho: o que encolhe é o preenchimento.
    expect(barraDe(wrapper)?.getLocalBounds().width).toBeCloseTo(larguraCheia, 6)
    const preenchimentos = (cheia?.context.instructions ?? []).filter((i) => i.action === 'fill')
    expect(preenchimentos.length).toBeGreaterThanOrEqual(2)

    renderer.draw(container, [ficha('og')], GRID, null)
    expect(barraDe(wrapper)).toBeUndefined()
    expect(cheia?.destroyed).toBe(true)
    expect(wrapper.children).toHaveLength(4)
    expect(rotuloDe(wrapper).position.y).toBe(RAIO + 2)
  })

  it('vida gravada com lixo (mapa editado à mão) não desenha barra nem derruba o mapa', () => {
    const container = new Container()
    const lixo = { current: 'muita', max: 10 } as unknown as TokenHealth
    expect(() => createTokensRenderer().draw(container, [ficha('og', lixo)], GRID, null)).not.toThrow()
    expect(barraDe(container.children[0])).toBeUndefined()
  })
})

describe('healthBarLayout — a geometria da barra', () => {
  it('o preenchimento acompanha a vida e a cor muda de estado', () => {
    const cheia = healthBarLayout(RAIO, vida(10, 10))
    const pouca = healthBarLayout(RAIO, vida(3, 10))
    const quase = healthBarLayout(RAIO, vida(2, 10))
    expect(pouca.fillWidth).toBeLessThan(cheia.fillWidth)
    expect(pouca.fillWidth).toBeCloseTo(cheia.fillWidth * 0.3, 6)
    expect(cheia.color).toBe(HEALTH_BAR_COLORS.fine)
    expect(pouca.color).toBe(HEALTH_BAR_COLORS.caution)
    expect(quase.color).toBe(HEALTH_BAR_COLORS.danger)
  })

  it('vivo com um fio de vida ainda mostra um ponto de barra; zero mostra a trilha vazia', () => {
    const fio = healthBarLayout(RAIO, vida(1, 419))
    expect(fio.fillWidth).toBeGreaterThan(0)
    expect(healthBarLayout(RAIO, vida(0, 10)).fillWidth).toBe(0)
  })

  it('o nome começa colado no disco sem barra e abaixo da barra com ela', () => {
    const layout = healthBarLayout(RAIO, vida(7, 10))
    expect(tokenLabelTop(RAIO, false)).toBe(RAIO + 2)
    expect(tokenLabelTop(RAIO, true)).toBeGreaterThanOrEqual(layout.y + layout.height)
  })
})
