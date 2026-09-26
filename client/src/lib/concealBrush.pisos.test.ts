import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { ConcealZone, MapData, RegionPoint } from '../types/map'
import { cellKeyAt, paintRevealBrush, unveiledCellsOf } from './concealBrush'

/**
 * PISOS NA MESMA CENA no pincel de revelar: o traço do mestre no 1º piso pinta
 * só as zonas do 1º piso. A zona do térreo que fica embaixo, no mesmo lugar do
 * plano, o mestre nem vê nessa hora — e é o jogador do térreo que passaria a
 * ver o que ela esconde.
 */
const AREA: RegionPoint[] = [
  { x: 500, y: 20 },
  { x: 980, y: 20 },
  { x: 980, y: 580 },
  { x: 500, y: 580 },
]

const TRACO: RegionPoint[] = [
  { x: 560, y: 450 },
  { x: 940, y: 450 },
]

const TESOURO: ConcealZone = { id: 'z-terreo', name: 'Sala do tesouro', revealed: false, points: AREA }
const SOTAO: ConcealZone = { id: 'y-piso1', name: 'Sótão', revealed: false, points: AREA, piso: 1 }

function cena(zonas: ConcealZone[]): MapData {
  return { ...createEmptyMap('m', 'M', 20, 12, 50), concealZones: zonas }
}

const zona = (mapa: MapData, id: string): ConcealZone => {
  const achada = mapa.concealZones.find((z) => z.id === id)
  if (achada === undefined) throw new Error(`zona ${id} sumiu do mapa`)
  return achada
}

describe('pincel de revelar por piso', () => {
  it('pintar no 1º piso revela a zona do 1º piso e não toca a do térreo embaixo', () => {
    const r = paintRevealBrush(cena([TESOURO, SOTAO]), TRACO, 25, 'revelar', 1)
    expect(r.hitZone).toBe(true)
    expect(unveiledCellsOf(zona(r.map, 'y-piso1')).has(cellKeyAt({ x: 800, y: 450 }))).toBe(true)
    expect(zona(r.map, 'z-terreo').unveiledCells).toBeUndefined()
    expect(zona(r.map, 'z-terreo')).toBe(TESOURO)
  })

  it('1º piso sem zona ali: nada muda, o mesmo mapa volta e o aviso de pincel sem zona aparece', () => {
    const antes = cena([TESOURO])
    const r = paintRevealBrush(antes, TRACO, 25, 'revelar', 1)
    expect(r.hitZone).toBe(false)
    expect(r.map).toBe(antes)
  })

  it('esconder no 1º piso não apaga o que o mestre pintou na zona do térreo', () => {
    const pintadoNoTerreo = paintRevealBrush(cena([TESOURO, SOTAO]), TRACO, 25, 'revelar', 0).map
    const celulasTerreo = unveiledCellsOf(zona(pintadoNoTerreo, 'z-terreo'))
    expect(celulasTerreo.has(cellKeyAt({ x: 800, y: 450 }))).toBe(true)
    expect(zona(pintadoNoTerreo, 'y-piso1').unveiledCells).toBeUndefined()

    const escondidoNoPiso1 = paintRevealBrush(pintadoNoTerreo, TRACO, 25, 'esconder', 1).map
    expect(unveiledCellsOf(zona(escondidoNoPiso1, 'z-terreo'))).toEqual(celulasTerreo)
  })

  it('mapa de um piso só (zona sem campo piso) pinta no térreo como sempre', () => {
    const r = paintRevealBrush(cena([TESOURO]), TRACO, 25, 'revelar', 0)
    expect(r.hitZone).toBe(true)
    expect(unveiledCellsOf(zona(r.map, 'z-terreo')).has(cellKeyAt({ x: 800, y: 450 }))).toBe(true)
  })
})
