/**
 * ROTA DE PATRULHA no EDITOR: o mestre vê a ronda de cada NPC. Ficha sem rota
 * ou oculta no editor não desenha nada.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, TokenPatrol } from '../types/map'
import { drawPatrolRoutes } from './drawNpcPatrol'

const GRADE = 50

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 40, 20, GRADE), tokens }
}

function desenhar(map: MapData): Graphics {
  const g = new Graphics()
  drawPatrolRoutes(g, map)
  return g
}

const RONDA: TokenPatrol = {
  pontos: [
    { x: 100, y: 100 },
    { x: 600, y: 100 },
    { x: 600, y: 400 },
  ],
  atual: 0,
}

describe('drawPatrolRoutes', () => {
  it('NPC com rota: a linha e os pontos cobrem a ronda inteira, e só ela', () => {
    const g = desenhar(mapa([ficha('guarda', 100, 100, { patrulha: RONDA })]))
    expect(g.context.instructions.length).toBeGreaterThan(0)
    const caixa = g.getLocalBounds()
    const folga = GRADE
    expect(caixa.minX).toBeGreaterThanOrEqual(100 - folga)
    expect(caixa.minX).toBeLessThanOrEqual(100)
    expect(caixa.maxX).toBeGreaterThanOrEqual(600)
    expect(caixa.maxX).toBeLessThanOrEqual(600 + folga)
    expect(caixa.maxY).toBeGreaterThanOrEqual(400)
    expect(caixa.maxY).toBeLessThanOrEqual(400 + folga)
  })

  it('ficha sem rota, ou rota de NPC oculto no editor: nada desenhado', () => {
    expect(desenhar(mapa([ficha('heroi', 100, 100)])).context.instructions).toHaveLength(0)
    expect(desenhar(mapa([ficha('guarda', 100, 100, { patrulha: RONDA, hidden: true })])).context.instructions).toHaveLength(0)
  })

  it('redesenhar depois de apagar a rota limpa o desenho anterior', () => {
    const g = new Graphics()
    drawPatrolRoutes(g, mapa([ficha('guarda', 100, 100, { patrulha: RONDA })]))
    expect(g.context.instructions.length).toBeGreaterThan(0)
    drawPatrolRoutes(g, mapa([ficha('guarda', 100, 100)]))
    expect(g.context.instructions).toHaveLength(0)
  })
})
