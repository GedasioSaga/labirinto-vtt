import { beforeEach, describe, expect, it } from 'vitest'
import { buildBlocosShape, type Bloco } from '../lib/floorBlocks'
import { buildFloorPiece } from '../lib/floorTool'
import { createEmptyMap } from '../lib/mapFactory'
import { selecaoDoLacoNoPiso } from '../lib/pisoEmEdicao'
import type { FloorPiece, MapData, Region, Wall } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * PISOS NA MESMA CENA no editor: o mestre edita o 1º piso por cima do térreo
 * e nada do que ele faz lá apaga o térreo que ele não está vendo.
 */
const CELL = 40

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

const paredesDaSala = (prefixo: string, regionId: string, extra: Partial<Wall> = {}): Wall[] => [
  wall(`${prefixo}-n`, 100, 100, 900, 100, { regionId, ...extra }),
  wall(`${prefixo}-l`, 900, 100, 900, 900, { regionId, ...extra }),
  wall(`${prefixo}-s`, 900, 900, 100, 900, { regionId, ...extra }),
  wall(`${prefixo}-o`, 100, 900, 100, 100, { regionId, ...extra }),
]

function quadrado(de: number, ate: number): Bloco[] {
  const out: Bloco[] = []
  for (let col = de; col <= ate; col += 1) for (let row = de; row <= ate; row += 1) out.push({ col, row })
  return out
}

function pecaDeBlocos(id: string, blocos: Bloco[], extra: Partial<FloorPiece> = {}): FloorPiece {
  const shape = buildBlocosShape(CELL, blocos)
  if (shape === null) throw new Error('quadrado sem célula')
  return { ...buildFloorPiece(id, shape, 'add'), ...extra }
}

function torre(): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 25, 25, CELL),
    regions: [sala('hall', 'Hall de entrada'), sala('biblioteca', 'Biblioteca', { piso: 1 })],
    walls: [...paredesDaSala('hall', 'hall'), ...paredesDaSala('bib', 'biblioteca', { piso: 1 })],
    floor: [pecaDeBlocos('chao-hall', quadrado(2, 6)), pecaDeBlocos('chao-bib', quadrado(2, 6), { piso: 1 })],
  }
}

const store = () => useMapStore.getState()
const cellsDe = (id: string): number => {
  const peca = store().map.floor.find((p) => p.id === id)
  return peca?.shape.kind === 'blocos' ? peca.shape.cells.length : -1
}

beforeEach(() => {
  store().loadMap(torre())
  store().setPisoAtivo(1)
})

describe('mapStore — editar o 1º piso não mexe no térreo', () => {
  it('laço sobre a Biblioteca + Delete: a Biblioteca sai, o Hall e as paredes hall-* ficam', () => {
    store().setSelection(selecaoDoLacoNoPiso(store().map, store().pisoAtivo, { x1: 50, y1: 50, x2: 950, y2: 950 }))
    store().removeSelected()
    const map = store().map
    expect(map.regions.map((r) => r.id)).toEqual(['hall'])
    expect(map.walls.map((w) => w.id)).toEqual(['hall-n', 'hall-l', 'hall-s', 'hall-o'])
  })

  it('borracha do pincel no 1º piso: corta só a peça da Biblioteca, o chão do Hall fica inteiro', () => {
    store().eraseFloorBlocks([{ col: 4, row: 4 }], CELL)
    expect(cellsDe('chao-hall')).toBe(25)
    expect(cellsDe('chao-bib')).toBe(24)
    expect(store().past).toHaveLength(1)
  })

  it('borracha no 1º piso onde só o térreo tem chão: nada muda, nenhum Ctrl+Z gasto', () => {
    store().loadMap({ ...torre(), floor: [pecaDeBlocos('chao-hall', quadrado(2, 6))] })
    store().setPisoAtivo(1)
    const antes = store().map
    store().eraseFloorBlocks([{ col: 4, row: 4 }], CELL)
    expect(store().map).toBe(antes)
    expect(cellsDe('chao-hall')).toBe(25)
    expect(store().past).toHaveLength(0)
  })
})
