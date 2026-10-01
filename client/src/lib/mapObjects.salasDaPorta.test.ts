import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Region, Wall } from '../types/map'
import { mapObjectOf, mapObjectsOf } from './mapObjects'

/**
 * As salas de cada porta na lista "Objetos do mapa" ("Adega e Corredor"). A
 * lista inteira prepara nome e caixa de cada sala uma vez só, e o clique numa
 * linha (`mapObjectOf`) monta a porta sozinha: os dois caminhos precisam dizer
 * as mesmas salas, com as mesmas bordas de sempre.
 */

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#1e8c8c',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

function porta(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' }, ...extra }
}

/** Grade de 50: a porta a até 12,5 (1/4 de célula) do contorno é da sala. */
function cena(extra: Partial<MapData>): MapData {
  return { ...createEmptyMap('map_portas', 'Portas', 40, 16, 50), ...extra }
}

const detalheNaLista = (map: MapData, id: string) => mapObjectsOf(map).find((o) => o.key === `door:${id}`)?.detail
const detalheNoClique = (map: MapData, id: string) => mapObjectOf(map, `door:${id}`)?.detail

const CASA = cena({
  regions: [
    sala('r-corredor', 'Corredor', 0, 0, 500, 500),
    sala('r-adega', '  Adega  ', 500, 0, 900, 500),
    // Sala sem nome e região comum não dão nome a porta nenhuma.
    sala('r-sem-nome', '   ', 900, 0, 1200, 500),
    { ...sala('r-mar', '', 0, 0, 2000, 800), room: undefined },
  ],
  walls: [
    porta('w-meio', 500, 200, 500, 300),
    porta('w-dentro', 200, 100, 300, 100),
    porta('w-perto', 510, 600, 510, 700),
    porta('w-borda', 1210, 200, 1210, 300),
    porta('w-longe', 3000, 3000, 3000, 3100),
    { id: 'w-parede', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null },
  ],
})

describe('salas da porta: a lista inteira e o clique dizem o mesmo', () => {
  it('entre duas salas, as duas, aparadas e em ordem alfabética; dentro de uma, só ela; solta, nada', () => {
    expect(detalheNaLista(CASA, 'w-meio')).toBe('Adega e Corredor')
    expect(detalheNaLista(CASA, 'w-dentro')).toBe('Corredor')
    expect(detalheNaLista(CASA, 'w-longe')).toBe('')
    for (const id of ['w-meio', 'w-dentro', 'w-perto', 'w-borda', 'w-longe']) {
      expect(detalheNaLista(CASA, id), id).toBe(detalheNoClique(CASA, id))
    }
  })

  it('a sala sem nome não dá nome à porta da borda dela', () => {
    expect(detalheNaLista(CASA, 'w-borda')).toBe('')
    expect(detalheNoClique(CASA, 'w-borda')).toBe('')
  })

  it('tolerância de 1/4 de célula: a 10 do contorno é da sala; a 20, não', () => {
    const map = cena({
      regions: [sala('r-sala', 'Sala', 0, 0, 500, 500)],
      walls: [porta('w-10', 510, 200, 510, 300), porta('w-20', 520, 200, 520, 300)],
    })
    expect(detalheNaLista(map, 'w-10')).toBe('Sala')
    expect(detalheNaLista(map, 'w-20')).toBe('')
    expect(detalheNoClique(map, 'w-10')).toBe('Sala')
    expect(detalheNoClique(map, 'w-20')).toBe('')
  })

  it('a sala dona da porta (regionId) entra mesmo sem ponto nenhum e longe dela', () => {
    const fantasma: Region = { ...sala('r-fantasma', 'Fantasma', 0, 0, 0, 0), points: [] }
    const map = cena({
      regions: [fantasma, sala('r-longe', 'Longe', 0, 0, 100, 100)],
      walls: [porta('w-dona', 3000, 3000, 3000, 3100, { regionId: 'r-fantasma' }), porta('w-dona-longe', 3000, 3000, 3000, 3100, { regionId: 'r-longe' })],
    })
    expect(detalheNaLista(map, 'w-dona')).toBe('Fantasma')
    expect(detalheNoClique(map, 'w-dona')).toBe('Fantasma')
    expect(detalheNaLista(map, 'w-dona-longe')).toBe('Longe')
    expect(detalheNoClique(map, 'w-dona-longe')).toBe('Longe')
    // Sem ponto, a sala não vira linha da lista; só dá nome à porta dela.
    expect(mapObjectsOf(map).some((o) => o.key === 'room:r-fantasma')).toBe(false)
  })

  it('nome repetido aparece uma vez; maiúscula diferente fica na ordem do mapa', () => {
    const map = cena({
      regions: [sala('r-c', 'Corredor', 0, 0, 500, 500), sala('r-a1', 'adega', 500, 0, 900, 250), sala('r-a2', 'Adega', 500, 250, 900, 500), sala('r-a3', ' Adega', 500, 0, 900, 500)],
      walls: [porta('w-meio', 500, 200, 500, 300)],
    })
    expect(detalheNaLista(map, 'w-meio')).toBe('adega e Adega e Corredor')
    expect(detalheNoClique(map, 'w-meio')).toBe('adega e Adega e Corredor')
  })

  it('parede sem porta continua fora da lista e do clique', () => {
    expect(mapObjectsOf(CASA).some((o) => o.key === 'door:w-parede')).toBe(false)
    expect(mapObjectOf(CASA, 'door:w-parede')).toBeNull()
    expect(mapObjectOf(CASA, 'door:nao-existe')).toBeNull()
  })

  it('mapa sem porta nenhuma: só as salas, como sempre', () => {
    const map = cena({ regions: [sala('r-sala', 'Sala', 0, 0, 500, 500)], walls: [] })
    expect(mapObjectsOf(map).map((o) => o.key)).toEqual(['room:r-sala'])
  })
})
