import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Region, Stair, Token, Wall } from '../types/map'
import { createExploration, markAll } from './exploration'
import { filterMapForPlayer, pisoDoJogador } from './fogFilter'
import { createEmptyMap, setTokenPosition } from './mapFactory'
import { comFichaNoPiso, escadaDaFicha } from './pisos'

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

  it('a ficha chega com o piso dela: no 1º piso com piso 1, no térreo sem o campo (a lista branca leva o piso)', () => {
    const lá = filterMapForPlayer(predio(), 'p2', { p1: ['lia'], p2: ['caio'] }, RADIUS)
    expect(lá.map.tokens.map((t) => [t.id, t.piso])).toEqual([['caio', 1]])
    const embaixo = filterMapForPlayer(predio(), 'p1', { p1: ['lia'], p2: ['caio'] }, RADIUS)
    expect(embaixo.map.tokens.map((t) => t.id)).toEqual(['lia'])
    expect('piso' in embaixo.map.tokens[0]).toBe(false)
  })

  it('no 1º piso, encostado na escada, o recorte faz a escada levar de volta ao térreo, não ao 1º piso', () => {
    const map: MapData = { ...predio(), tokens: [token('caio', 500, 500, { piso: 1 })] }
    const view = filterMapForPlayer(map, 'p2', { p2: ['caio'] }, RADIUS)
    const caio = view.map.tokens.find((t) => t.id === 'caio')
    if (caio === undefined) throw new Error('a ficha do Caio não chegou ao recorte')
    expect(escadaDaFicha(view.map, caio)).toEqual({ stairId: 'escada', destino: 0 })
  })

  it('ficha do mesmo jogador em outro piso não sai no recorte', () => {
    const view = filterMapForPlayer(predio(), 'p1', { p1: ['lia', 'caio'] }, RADIUS)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['lia'])
    expect(view.eyes.map((e) => e.tokenId)).toEqual(['lia'])
  })
})

/**
 * VAZAMENTO ENTRE PISOS pelo que anda com a ficha: o pino PRESO a ela
 * (`presoA`) e a ficha que ela LEVA (`levadoPor`) seguem o x/y dela
 * (`setTokenPosition`). Se ficassem no térreo quando ela sobe, quem ficou
 * embaixo veria os dois andando pelo caminho de quem está no 1º piso.
 */
describe('fogFilter — pisos: o que anda com a ficha não entrega quem subiu', () => {
  function terreoComCaio(): MapData {
    return {
      ...createEmptyMap('predio', 'Prédio', 25, 25, 40),
      tokens: [token('lia', 500, 500), token('caio', 500, 500), token('ferido', 520, 500, { levadoPor: 'caio' })],
      pins: [pino('balao', 500, 480, { presoA: 'caio' })],
      stairs: [ESCADA],
    }
  }
  const DONOS = { A: ['lia'], B: ['caio'] }

  it('o Caio sobe a escada e anda lá em cima: a Lia, no térreo, não recebe o pino preso nem a ficha levada', () => {
    // O caminho do host: `token.piso` → `comFichaNoPiso` → `token.move` → `setTokenPosition`.
    const map = setTokenPosition(comFichaNoPiso(terreoComCaio(), 'caio', 1), 'caio', 800, 700)
    const view = filterMapForPlayer(map, 'A', DONOS, RADIUS)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['lia'])
    expect(view.map.pins.map((p) => p.id)).toEqual([])
    // Quem subiu recebe os dois, lá em cima, onde ele está.
    const lá = filterMapForPlayer(map, 'B', DONOS, RADIUS)
    expect(lá.map.tokens.map((t) => [t.id, t.x, t.y])).toEqual([
      ['caio', 800, 700],
      ['ferido', 820, 700],
    ])
    expect(lá.map.pins.map((p) => [p.id, p.x, p.y])).toEqual([['balao', 800, 680]])
  })

  it('pino preso e ficha levada que ficaram num piso sem a ficha (arquivo feito à mão) não saem no recorte deste piso', () => {
    const base = terreoComCaio()
    const map: MapData = { ...base, tokens: base.tokens.map((t) => (t.id === 'caio' ? { ...t, piso: 1 } : t)) }
    const view = filterMapForPlayer(map, 'A', DONOS, RADIUS)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['lia'])
    expect(view.map.pins.map((p) => p.id)).toEqual([])
    // A ficha levada que é do PRÓPRIO jogador continua saindo para ele: é ele quem a move.
    const doDono = filterMapForPlayer(map, 'A', { A: ['lia', 'ferido'], B: ['caio'] }, RADIUS)
    expect(doDono.map.tokens.map((t) => t.id)).toEqual(['lia', 'ferido'])
  })

  it('sem piso nenhum, o pino preso e a ficha levada à vista continuam saindo (nada muda no mapa de um piso)', () => {
    const view = filterMapForPlayer(terreoComCaio(), 'A', DONOS, RADIUS)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['lia', 'caio', 'ferido'])
    expect(view.map.pins.map((p) => p.id)).toEqual(['balao'])
  })
})
