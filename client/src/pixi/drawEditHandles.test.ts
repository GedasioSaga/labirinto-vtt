import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawEditHandles } from './drawEditHandles'
import { createEmptyMap } from '../lib/mapFactory'
import type { Region, Wall } from '../types/map'

/** Conta instruções `action: 'fill'` realmente empilhadas no GraphicsContext da instância. */
function countFillInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill').length
}

/** Conta instruções `action: 'stroke'` realmente empilhadas no GraphicsContext da instância. */
function countStrokeInstructions(g: Graphics): number {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke').length
}

function buildSquareRegion(id: string): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: 'region',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }
}

function buildLooseWall(id: string): Wall {
  return { id, x1: 10, y1: 20, x2: 90, y2: 20, blocksLight: true, blocksMove: true, door: null }
}

function buildLinkedWall(id: string, regionId: string, regionEdgeIndex: number): Wall {
  return { ...buildLooseWall(id), regionId, regionEdgeIndex }
}

describe('drawEditHandles', () => {
  it('sem seleção: não desenha nada', () => {
    const map = createEmptyMap('m', 'M', 30, 20, 64)
    const g = new Graphics()

    drawEditHandles(g, map, null, 'select')

    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('região selecionada: 1 círculo preenchido por vértice + 1 vazado por ponto médio de aresta', () => {
    const region = buildSquareRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length)
    expect(countStrokeInstructions(g)).toBe(region.points.length)
  })

  it('parede solta selecionada: 2 círculos preenchidos (extremos), nenhum vazado', () => {
    const wall = buildLooseWall('w1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), walls: [wall] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'wall', id: 'w1' }, 'select')

    expect(countFillInstructions(g)).toBe(2)
    expect(countStrokeInstructions(g)).toBe(0)
  })

  it('parede vinculada selecionada: delega para os handles da região dona (vértice + meio)', () => {
    const region = buildSquareRegion('r1')
    const wall = buildLinkedWall('w1', 'r1', 0)
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region], walls: [wall] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'wall', id: 'w1' }, 'select')

    expect(countFillInstructions(g)).toBe(region.points.length)
    expect(countStrokeInstructions(g)).toBe(region.points.length)
  })

  it('ferramenta diferente de Selecionar: não desenha nada mesmo com seleção presente', () => {
    const region = buildSquareRegion('r1')
    const map = { ...createEmptyMap('m', 'M', 30, 20, 64), regions: [region] }
    const g = new Graphics()

    drawEditHandles(g, map, { kind: 'region', id: 'r1' }, 'room')

    expect(countFillInstructions(g)).toBe(0)
    expect(countStrokeInstructions(g)).toBe(0)
  })
})
