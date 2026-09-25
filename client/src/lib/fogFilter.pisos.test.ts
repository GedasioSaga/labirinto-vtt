import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Region, Stair, Token, Wall } from '../types/map'
import { createExploration, markAll } from './exploration'
import { filterMapForPlayer, pisoDoJogador } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PISOS NA MESMA CENA no recorte: o jogador recebe só o piso da ficha dele.
 * Os pisos estão EMPILHADOS no mesmo lugar do plano (como no prédio de
 * verdade): sem o recorte por piso, a sala, a ficha e o pino do outro piso
 * cairiam dentro da visão dele.
 */
function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, name: string, extra: Partial<Region> = {}): Region {
  const points = [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 900 },
    { x: 100, y: 900 },
  ]
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name }, ...extra }
}

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: `texto-${id}`, image: null, ...extra }
}

const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 500, y1: 450, x2: 500, y2: 550 }], stepWidth: 40, levaAoPiso: 1 }

function predio(): MapData {
  return {
    ...createEmptyMap('predio', 'Prédio', 25, 25, 40),
    walls: [
      // Térreo: nenhuma parede entre a Lia e o fundo da sala.
      wall('muro-terreo', 100, 950, 900, 950),
      // 1º piso: parede que corta a sala ao meio em x=300 — só vale lá em cima.
      wall('divisoria-primeiro', 300, 100, 300, 900, { piso: 1 }),
    ],
    regions: [sala('hall', 'Hall de entrada'), sala('biblioteca', 'Biblioteca proibida', { piso: 1 })],
    tokens: [token('lia', 500, 500), token('caio', 520, 520, { piso: 1 }), token('guarda', 200, 500, { piso: 1 })],
    pins: [pino('bau', 600, 600), pino('diario', 620, 620, { piso: 1 })],
    stairs: [ESCADA],
  }
}

const RADIUS = 700

describe('fogFilter — pisos na mesma cena', () => {
  it('no térreo: nada do 1º piso chega, nem com tudo ao alcance da visão', () => {
    const view = filterMapForPlayer(predio(), 'p1', { p1: ['lia'], p2: ['caio'] }, RADIUS)
    const json = JSON.stringify(view.map)
    expect(json).toContain('Hall de entrada')
    expect(json).toContain('texto-bau')
    expect(json).not.toContain('Biblioteca proibida')
    expect(json).not.toContain('caio')
    expect(json).not.toContain('guarda')
    expect(json).not.toContain('texto-diario')
    expect(json).not.toContain('divisoria-primeiro')
    // A escada que liga os dois pisos sai, com o piso a que leva.
    expect(view.map.stairs.map((s) => [s.id, s.levaAoPiso])).toEqual([['escada', 1]])
  })

  it('no 1º piso: só o 1º piso, e a visão para na parede DELE, não na do térreo', () => {
    const view = filterMapForPlayer(predio(), 'p2', { p1: ['lia'], p2: ['caio'] }, RADIUS)
    const json = JSON.stringify(view.map)
    expect(json).toContain('Biblioteca proibida')
    expect(json).toContain('texto-diario')
    expect(json).not.toContain('Hall de entrada')
    expect(json).not.toContain('nome-lia')
    expect(json).not.toContain('texto-bau')
    expect(json).not.toContain('muro-terreo')
    // O guarda está do outro lado da divisória do 1º piso: fora da visão.
    expect(view.map.tokens.map((t) => t.id)).toEqual(['caio'])
    expect(view.map.stairs.map((s) => s.id)).toEqual(['escada'])
  })

  it('memória do térreo (tudo explorado) não abre o 1º piso para quem está no térreo', () => {
    const map = predio()
    const exp = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    markAll(exp)
    const view = filterMapForPlayer(map, 'p1', { p1: ['lia'] }, RADIUS, exp)
    const json = JSON.stringify(view.map)
    expect(json).toContain('Hall de entrada')
    expect(json).not.toContain('Biblioteca proibida')
    expect(json).not.toContain('divisoria-primeiro')
  })

  it('pisoDoJogador: a primeira ficha que é olho; sem olho, a primeira ficha; sem ficha, térreo', () => {
    const map = predio()
    expect(pisoDoJogador(map, 'p2', { p2: ['caio', 'lia'] })).toBe(1)
    expect(pisoDoJogador(map, 'p1', { p1: ['lia', 'caio'] })).toBe(0)
    const semVisao = new Map([['caio', { tarefa: '', ate: null, visao: false }]])
    expect(pisoDoJogador(map, 'p2', { p2: ['caio'] }, semVisao)).toBe(1)
    expect(pisoDoJogador(map, 'p3', {})).toBe(0)
  })

  it('ficha do mesmo jogador em outro piso não sai no recorte', () => {
    const view = filterMapForPlayer(predio(), 'p1', { p1: ['lia', 'caio'] }, RADIUS)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['lia'])
    expect(view.eyes.map((e) => e.tokenId)).toEqual(['lia'])
  })
})
