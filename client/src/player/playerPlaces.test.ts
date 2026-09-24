/**
 * LUGARES — a parte pura: o que a tela do jogador guarda de cada lugar por onde
 * passou (só o desenho do chão e das paredes, nunca ficha, pino ou nome do
 * mestre), a ordem da primeira visita, o nome que ELE deu, e o rótulo de cada
 * ponto conhecido da cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, isPointExplored, markRings, type Exploration } from '../lib/exploration'
import { filterMapForPlayer } from '../lib/fogFilter'
import type { MapData, Pin, Region, RegionPoint } from '../types/map'
import type { StorageLike } from './playerConnection'
import {
  PLACE_NAMES_KEY,
  exploredOutline,
  loadPlaceNames,
  pinLabel,
  placeLabel,
  placeSketch,
  rememberPlace,
  savePlaceName,
  withPlaceName,
} from './playerPlaces'

function mapa(id: string): MapData {
  const base = createEmptyMap(id, 'Cripta Rubra', 30, 10, 50)
  const sala: Region = {
    id: 'r1',
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ],
    tag: '',
    fillColor: '#445566',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Sala do Trono', nameHiddenFromPlayers: false },
  }
  return {
    ...base,
    regions: [sala],
    tokens: [{ id: 'b', characterId: null, name: 'Bruno', x: 50, y: 50, size: 1, image: null }],
    pins: [{ id: 'p', x: 60, y: 60, kind: 'exclamacao', description: 'Altar', image: null }],
    walls: [
      { id: 'w1', x1: 0, y1: 0, x2: 200, y2: 0, blocksLight: true, blocksMove: true, door: null },
      { id: 'w2', x1: 0, y1: 200, x2: 200, y2: 200, blocksLight: true, blocksMove: true, door: { kind: 'normal', open: false, locked: false } },
    ],
  }
}

function explorado(ate: number): Exploration {
  const exp = createExploration({ width: 1500, height: 500, grid: 50 })
  markRings(exp, [
    [
      { x: 0, y: 0 },
      { x: ate, y: 0 },
      { x: ate, y: ate },
      { x: 0, y: ate },
    ],
  ])
  return exp
}

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

describe('placeSketch: o desenho guardado do lugar', () => {
  it('leva chão, polígono das salas e paredes (com a porta marcada), sem ficha, pino nem nome', () => {
    const sketch = placeSketch(mapa('m1'))
    expect(sketch.width).toBe(1500)
    expect(sketch.height).toBe(500)
    expect(sketch.rooms).toHaveLength(1)
    expect(sketch.walls.map((w) => w.door)).toEqual([false, true])
    const texto = JSON.stringify(sketch)
    expect(texto).not.toContain('Bruno')
    expect(texto).not.toContain('Altar')
    expect(texto).not.toContain('Sala do Trono')
    expect(texto).not.toContain('Cripta Rubra')
  })
})

describe('rememberPlace: a lista de lugares visitados', () => {
  it('numera na ordem da primeira visita e, na volta, atualiza sem trocar o número', () => {
    const um = rememberPlace([], 'l1', mapa('m1'), explorado(100), [], undefined)
    const dois = rememberPlace(um, 'l2', mapa('m2'), explorado(100), [], ['l1', 'l2'])
    expect(dois.map((p) => [p.id, p.number])).toEqual([
      ['l1', 1],
      ['l2', 2],
    ])
    const maisExplorado = explorado(400)
    const volta = rememberPlace(dois, 'l1', mapa('m1'), maisExplorado, [], ['l2', 'l1'])
    expect(volta.map((p) => [p.id, p.number])).toEqual([
      ['l1', 1],
      ['l2', 2],
    ])
    expect(volta[0]?.explored).toBe(maisExplorado)
    // O outro lugar fica como estava quando ele saiu de lá.
    expect(volta[1]).toBe(dois[1])
  })

  it('o que o host já não lembra (Esconder planta) sai; o número novo nunca repete um antigo', () => {
    const tres = ['l1', 'l2', 'l3'].reduce((lista, id) => rememberPlace(lista, id, mapa(id), explorado(100), [], undefined), rememberPlace([], 'l0', mapa('l0'), explorado(100), [], undefined))
    expect(tres).toHaveLength(4)
    const semL1 = rememberPlace(tres, 'l4', mapa('m4'), explorado(100), [], ['l0', 'l2', 'l3', 'l4'])
    expect(semL1.map((p) => [p.id, p.number])).toEqual([
      ['l0', 1],
      ['l2', 3],
      ['l3', 4],
      ['l4', 5],
    ])
  })
})

describe('rememberPlace: zona oculta do mestre', () => {
  const ZONA: RegionPoint[] = [
    { x: 400, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 400, y: 1000 },
  ]

  function cripta(zonaAtiva: boolean): MapData {
    const base = createEmptyMap('m1', 'Cripta Rubra', 20, 20, 50)
    const sala: Region = {
      id: 'r1',
      points: [
        { x: 300, y: 300 },
        { x: 500, y: 300 },
        { x: 500, y: 500 },
        { x: 300, y: 500 },
      ],
      tag: '',
      fillColor: '#445566',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Sala do Trono', nameHiddenFromPlayers: false },
    }
    return {
      ...base,
      regions: [sala],
      tokens: [{ id: 't', characterId: null, name: 'Eva', x: 250, y: 250, size: 1, image: null }],
      concealZones: zonaAtiva ? [{ id: 'z', points: ZONA, name: 'Cofre', revealed: false }] : [],
    }
  }

  it('explorou, o mestre ligou a zona por cima: o lugar guarda a zona do snapshot, porque o explorado e a Sala não esquecem', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 50 })
    const antes = filterMapForPlayer(cripta(false), 'p1', { p1: ['t'] }, 400, exp)
    markRings(exp, antes.vision)
    const depois = filterMapForPlayer(cripta(true), 'p1', { p1: ['t'] }, 400, exp)
    markRings(exp, depois.vision)
    // Por que a miniatura precisa da zona: a célula de dentro continua explorada e a Sala sai inteira.
    expect(isPointExplored(exp, { x: 420, y: 420 })).toBe(true)
    expect(placeSketch(depois.map).rooms[0]?.points.map((p) => p.x)).toContain(500)

    const [lugar] = rememberPlace([], 'l1', depois.map, exp, depois.concealed, undefined)
    if (lugar === undefined) throw new Error('sem lugar')
    expect(lugar.concealed).toEqual([ZONA])
    // Cópia: o snapshot seguinte não mexe no que ficou guardado.
    expect(lugar.concealed[0]).not.toBe(depois.concealed[0])
    // Nem o nome da zona nem o da Sala entram no que o lugar guarda.
    expect(JSON.stringify(lugar)).not.toContain('Cofre')
  })

  it('o mestre revelou a zona e ele voltou: a cobertura sai; anel sem área nunca entra', () => {
    const [comZona] = rememberPlace([], 'l1', cripta(true), undefined, [ZONA, [{ x: 0, y: 0 }, { x: 10, y: 10 }]], undefined)
    if (comZona === undefined) throw new Error('sem lugar')
    expect(comZona.concealed).toEqual([ZONA])
    const [revelado] = rememberPlace([comZona], 'l1', cripta(false), undefined, [], undefined)
    expect(revelado?.number).toBe(1)
    expect(revelado?.concealed).toEqual([])
  })
})

describe('nome do lugar dado pelo jogador', () => {
  it('sem nome é "Lugar N"; o nome dele vale por jogador e sobrevive a reabrir a página', () => {
    const storage = new MemoryStorage()
    const [lugar] = rememberPlace([], 'l2', mapa('m2'), explorado(100), [], undefined)
    if (lugar === undefined) throw new Error('sem lugar')
    expect(placeLabel({ ...lugar, number: 2 }, {})).toBe('Lugar 2')
    savePlaceName(storage, 'p1', 'l2', '  Mercado  ')
    expect(loadPlaceNames(storage, 'p1')).toEqual({ l2: 'Mercado' })
    expect(placeLabel({ ...lugar, number: 2 }, loadPlaceNames(storage, 'p1'))).toBe('Mercado')
    // Outro jogador (ou outra sala do mestre, com outro id de jogador) não herda o nome.
    expect(loadPlaceNames(storage, 'p9')).toEqual({})
    // Apagar o nome volta ao "Lugar N".
    savePlaceName(storage, 'p1', 'l2', '   ')
    expect(loadPlaceNames(storage, 'p1')).toEqual({})
  })

  it('armazenamento torto, cheio ou bloqueado não derruba a tela', () => {
    const torto = new MemoryStorage()
    torto.setItem(PLACE_NAMES_KEY, '{"p1": {"l1": 7, "l2": "Porto"}, "p2": 3}')
    expect(loadPlaceNames(torto, 'p1')).toEqual({ l2: 'Porto' })
    torto.setItem(PLACE_NAMES_KEY, 'não é json')
    expect(loadPlaceNames(torto, 'p1')).toEqual({})
    const bloqueado: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('cheio')
      },
      removeItem: () => {},
    }
    expect(loadPlaceNames(bloqueado, 'p1')).toEqual({})
    expect(() => savePlaceName(bloqueado, 'p1', 'l1', 'Porto')).not.toThrow()
    expect(loadPlaceNames(null, 'p1')).toEqual({})
  })

  it('withPlaceName: troca, limpa e apaga só na cópia, sem tocar no armazenamento nem no original', () => {
    const antes = { l1: 'Porto' }
    expect(withPlaceName(antes, 'l2', '  Mercado  ')).toEqual({ l1: 'Porto', l2: 'Mercado' })
    expect(withPlaceName(antes, 'l1', '   ')).toEqual({})
    expect(withPlaceName(antes, 'l1', 'x'.repeat(80))).toEqual({ l1: 'x'.repeat(32) })
    expect(antes).toEqual({ l1: 'Porto' })
  })

  it('nome longo é cortado no mesmo teto do nome do personagem', () => {
    const storage = new MemoryStorage()
    savePlaceName(storage, 'p1', 'l1', 'x'.repeat(80))
    expect(loadPlaceNames(storage, 'p1').l1).toBe('x'.repeat(32))
  })
})

describe('pinLabel: como o ponto aparece na lista', () => {
  it('a primeira linha da descrição; sem descrição, o tipo do pino', () => {
    const base: Pin = { id: 'p', x: 0, y: 0, kind: 'exclamacao', description: 'Portas do Templo\nGrandes, de bronze.', image: null }
    expect(pinLabel(base)).toBe('Portas do Templo')
    expect(pinLabel({ ...base, description: '', kind: 'viagem' })).toBe('Pino de viagem')
    expect(pinLabel({ ...base, description: '   ', icon: 'bau' })).toBe('Ponto de interesse — Baú')
  })
})

describe('exploredOutline: o recorte da miniatura', () => {
  it('só as células exploradas viram forma, e a caixa abraça só elas', () => {
    const outline = exploredOutline(explorado(100))
    expect(outline.path.length).toBeGreaterThan(0)
    expect(outline.box).not.toBeNull()
    expect(outline.box?.x).toBe(0)
    expect(outline.box?.y).toBe(0)
    expect(outline.box?.width).toBeGreaterThanOrEqual(100)
    expect(outline.box?.width).toBeLessThan(200)
    const nada = exploredOutline(createExploration({ width: 1500, height: 500, grid: 50 }))
    expect(nada.path).toBe('')
    expect(nada.box).toBeNull()
  })
})
