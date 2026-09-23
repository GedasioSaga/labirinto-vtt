import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { buildFloorMask } from './floorMask'
import type { Region, Wall } from '../types/map'

function fills(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'fill')
}

function region(id: string, overrides: Partial<Region> = {}): Region {
  return {
    id,
    points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }, { x: 0, y: 64 }],
    tag: '',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    ...overrides,
  }
}

function wallOf(regionId: string): Wall {
  return { id: `${regionId}-w0`, x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId, regionEdgeIndex: 0 }
}

describe('floorMask — silhueta do piso para a máscara da grade', () => {
  it('Região sem paredes não entra (não é Sala): máscara vazia', () => {
    const g = new Graphics()
    expect(buildFloorMask(g, [region('solta')], [], [])).toBe(false)
    expect(fills(g)).toHaveLength(0)
  })

  it('Sala com paredes entra, inclusive sem preenchimento (filled=false) e oculta', () => {
    const regions = [region('a'), region('b', { filled: false }), region('c', { secret: true })]
    const walls = [wallOf('a'), wallOf('b'), wallOf('c')]
    const g = new Graphics()
    expect(buildFloorMask(g, regions, walls, [])).toBe(true)
    expect(fills(g)).toHaveLength(3)
  })

  it('Região degenerada (menos de 3 pontos) fica de fora', () => {
    const g = new Graphics()
    expect(buildFloorMask(g, [region('d', { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })], [wallOf('d')], [])).toBe(false)
    expect(fills(g)).toHaveLength(0)
  })

  it('chão por peças: 1 fill por anel externo, buraco recortado', () => {
    const g = new Graphics()
    const ring = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }]
    const hole = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }, { x: 100, y: 200 }]
    expect(buildFloorMask(g, [], [], [{ outer: ring, holes: [hole] }])).toBe(true)
    expect(fills(g)).toHaveLength(1)
  })

  it('redesenhar limpa o anterior (sem acumular instruções)', () => {
    const g = new Graphics()
    buildFloorMask(g, [region('a')], [wallOf('a')], [])
    buildFloorMask(g, [region('a')], [wallOf('a')], [])
    expect(fills(g)).toHaveLength(1)
  })
})
