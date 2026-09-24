/**
 * O desenho da barra de vida é UM só para o mapa do mestre e para a tela do
 * jogador (`player/PlayerView.tsx` chama `drawTokenHealthBar` direto). Aqui o
 * contrato do desenho em si: trilha sempre, preenchimento só com vida, e nada
 * quando a ficha não tem barra.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { TokenHealth } from '../types/map'
import { drawTokenHealthBar, HEALTH_BAR_COLORS, healthBarLayout } from './drawTokenHealth'

/** Raio do disco do jogador numa grade de 50 (`tokenRadius` em PlayerView.tsx). */
const RAIO = 25

const vida = (current: number, max: number): TokenHealth => ({ current, max, shownToPlayers: true })

function preenchimentos(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

function corDo(instrucao: ReturnType<typeof preenchimentos>[number]): number | undefined {
  return (instrucao.data as { style?: { color?: number } }).style?.color
}

describe('drawTokenHealthBar', () => {
  it('sem vida não desenha nada — e limpa a barra que havia', () => {
    const g = new Graphics()
    drawTokenHealthBar(g, RAIO, vida(6, 10))
    expect(preenchimentos(g).length).toBeGreaterThan(0)
    drawTokenHealthBar(g, RAIO, null)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('com vida: a trilha escura e, por cima, o preenchimento na cor do estado', () => {
    const g = new Graphics()
    drawTokenHealthBar(g, RAIO, vida(60, 100))
    const fills = preenchimentos(g)
    expect(fills).toHaveLength(2)
    expect(corDo(fills[1])).toBe(HEALTH_BAR_COLORS.fine)
  })

  it('vida zerada: só a trilha, vazia — a ficha caída continua com barra', () => {
    const g = new Graphics()
    drawTokenHealthBar(g, RAIO, vida(0, 100))
    expect(preenchimentos(g)).toHaveLength(1)
  })

  it('a barra fica inteira abaixo do disco e dentro da largura da ficha', () => {
    const g = new Graphics()
    drawTokenHealthBar(g, RAIO, vida(41, 100))
    const caixa = g.getLocalBounds()
    const layout = healthBarLayout(RAIO, vida(41, 100))
    expect(caixa.minY).toBeGreaterThan(RAIO)
    expect(caixa.maxX - caixa.minX).toBeLessThan(2 * RAIO)
    expect(layout.color).toBe(HEALTH_BAR_COLORS.caution)
  })
})
