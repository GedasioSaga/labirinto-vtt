/**
 * OLHOS DO GUARDA no EDITOR: o mestre vê o cone de cada guarda, cortado pelas
 * paredes — é o "o que o guarda vê". Ficha sem vigia, guarda oculto no editor
 * ou camada de fichas escondida não desenham cone.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, TokenWatch, Wall } from '../types/map'
import { drawWatchCones } from './drawNpcWatch'

const GRADE = 50
const LESTE: TokenWatch = { direcao: 0, abertura: 90, alcance: 6 }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function parede(x: number): Wall {
  return { id: 'muro', x1: x, y1: 0, x2: x, y2: 1000, blocksLight: true, blocksMove: true, door: null }
}

function mapa(tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 40, 20, GRADE), tokens, ...extra }
}

function desenhar(map: MapData): Graphics {
  const g = new Graphics()
  drawWatchCones(g, map)
  return g
}

describe('drawWatchCones', () => {
  it('guarda com vigia: o cone aparece à frente dele, até o alcance', () => {
    const g = desenhar(mapa([ficha('guarda', 500, 300, { vigia: LESTE })]))
    expect(g.context.instructions.length).toBeGreaterThan(0)
    const caixa = g.getLocalBounds()
    expect(caixa.minX).toBeGreaterThanOrEqual(500 - 2)
    expect(caixa.maxX).toBeLessThanOrEqual(500 + LESTE.alcance * GRADE + 2)
  })

  it('a parede corta o cone', () => {
    const g = desenhar(mapa([ficha('guarda', 500, 300, { vigia: LESTE })], { walls: [parede(600)] }))
    expect(g.context.instructions.length).toBeGreaterThan(0)
    expect(g.getLocalBounds().maxX).toBeLessThanOrEqual(600 + 2)
  })

  it('sem guarda, oculto no editor ou com a camada de fichas escondida: nada', () => {
    expect(desenhar(mapa([ficha('rato', 500, 300)])).context.instructions).toHaveLength(0)
    expect(desenhar(mapa([ficha('guarda', 500, 300, { vigia: LESTE, hidden: true })])).context.instructions).toHaveLength(0)
    expect(desenhar(mapa([ficha('guarda', 500, 300, { vigia: LESTE })], { hiddenLayers: ['tokens'] })).context.instructions).toHaveLength(0)
  })

  it('redesenhar sem o guarda limpa o cone velho', () => {
    const g = desenhar(mapa([ficha('guarda', 500, 300, { vigia: LESTE })]))
    drawWatchCones(g, mapa([]))
    expect(g.context.instructions).toHaveLength(0)
  })
})
