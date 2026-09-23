import { describe, expect, it } from 'vitest'
import {
  previousEdgeIndex,
  regionEdgeMidpoints,
  syncLinkedWallsToPoints,
  remapForInsert,
  remapForRemove,
  translateLinkedWalls,
  linkLooseWallsToRooms,
} from './roomLink'
import type { Region, RegionPoint, Wall } from '../types/map'

/** Quadrado com o vértice `index` trocado por (x, y). */
function movedVertex(index: number, x: number, y: number): RegionPoint[] {
  return SQUARE_POINTS.map((p, i) => (i === index ? { x, y } : p))
}

const DOOR = { open: false, locked: false, kind: 'normal' as const }

/** Quadrado com a aresta 0 (A→B) partida por porta: 0..40, porta 40..60, 60..100. */
function squareWithDoorOnTop(): Wall[] {
  const [, w1, w2, w3] = squareWalls()
  const piece = (id: string, x1: number, x2: number, door: Wall['door'] = null): Wall => ({
    id, x1, y1: 0, x2, y2: 0, blocksLight: true, blocksMove: true, door, regionId: REGION, regionEdgeIndex: 0,
  })
  return [piece('antes', 0, 40), piece('porta', 40, 60, DOOR), piece('depois', 60, 100), w1, w2, w3]
}

const REGION = 'r1'

// Fixture base: quadrado A(0,0) B(100,0) C(100,100) D(0,100), com
// w0=aresta0(A→B) w1=aresta1(B→C) w2=aresta2(C→D) w3=aresta3(D→A).
function squareWalls(): Wall[] {
  return [
    { id: 'w0', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 0 },
    { id: 'w1', x1: 100, y1: 0, x2: 100, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 1 },
    { id: 'w2', x1: 100, y1: 100, x2: 0, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 2 },
    { id: 'w3', x1: 0, y1: 100, x2: 0, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 3 },
  ]
}

const SQUARE_POINTS: RegionPoint[] = [
  { x: 0, y: 0 }, // A
  { x: 100, y: 0 }, // B
  { x: 100, y: 100 }, // C
  { x: 0, y: 100 }, // D
]

describe('previousEdgeIndex', () => {
  it('caso normal: aresta anterior à 2 é a 1', () => {
    expect(previousEdgeIndex(2, 4)).toBe(1)
  })

  it('wrap: aresta anterior à 0 é a última (n-1)', () => {
    expect(previousEdgeIndex(0, 4)).toBe(3)
  })
})

describe('regionEdgeMidpoints', () => {
  it('ponto médio de cada aresta do quadrado, incluindo o wrap da última pra primeira', () => {
    expect(regionEdgeMidpoints(SQUARE_POINTS)).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ])
  })
})

describe('syncLinkedWallsToPoints', () => {
  it('a. move vértice 1 (B) para (200,50): w1 vira início da aresta, w0 vira fim; w2/w3 intocadas', () => {
    const walls = squareWalls()
    const [w0, w1, w2, w3] = walls

    const result = syncLinkedWallsToPoints(walls, REGION, SQUARE_POINTS, movedVertex(1, 200, 50))

    expect(result.find((w) => w.id === 'w1')).toEqual({ ...w1, x1: 200, y1: 50 })
    expect(result.find((w) => w.id === 'w0')).toEqual({ ...w0, x2: 200, y2: 50 })
    expect(result.find((w) => w.id === 'w2')).toBe(w2)
    expect(result.find((w) => w.id === 'w3')).toBe(w3)
  })

  it('b. move vértice 0 (A, caso de wrap) para (-50,-50): w0 muda x1/y1, w3 muda x2/y2 (nunca x1/y1 de w3)', () => {
    const walls = squareWalls()
    const [w0, , , w3] = walls

    const result = syncLinkedWallsToPoints(walls, REGION, SQUARE_POINTS, movedVertex(0, -50, -50))

    const newW0 = result.find((w) => w.id === 'w0')!
    const newW3 = result.find((w) => w.id === 'w3')!
    expect(newW0).toEqual({ ...w0, x1: -50, y1: -50 })
    expect(newW3).toEqual({ ...w3, x2: -50, y2: -50 })
    expect(newW3.x1).toBe(0)
    expect(newW3.y1).toBe(100)
  })

  it('c. door/blocksLight/blocksMove sobrevivem intactos numa parede resincronizada', () => {
    const walls = squareWalls()
    walls[1] = { ...walls[1], door: { open: false, locked: false, kind: 'normal' }, blocksLight: false }

    const result = syncLinkedWallsToPoints(walls, REGION, SQUARE_POINTS, movedVertex(1, 200, 50))

    const newW1 = result.find((w) => w.id === 'w1')!
    expect(newW1.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(newW1.blocksLight).toBe(false)
    expect(newW1.blocksMove).toBe(true)
  })

  it('pedaços da aresta com porta: largura dobra e a porta fica no mesmo ponto proporcional, com o mesmo tamanho relativo', () => {
    const wider = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]
    const result = syncLinkedWallsToPoints(squareWithDoorOnTop(), REGION, SQUARE_POINTS, wider)
    expect(result.find((w) => w.id === 'antes')).toMatchObject({ x1: 0, x2: 80, y1: 0, y2: 0 })
    expect(result.find((w) => w.id === 'porta')).toMatchObject({ x1: 80, x2: 120, door: DOOR, regionEdgeIndex: 0 })
    expect(result.find((w) => w.id === 'depois')).toMatchObject({ x1: 120, x2: 200 })
    // Aresta 3 (D→A) não mudou: mesma referência.
    const original = squareWithDoorOnTop()
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ x1: 200, y1: 0, x2: 200, y2: 100 })
    expect(result.find((w) => w.id === 'w3')).toEqual(original.find((w) => w.id === 'w3'))
  })

  it('pedaço desenhado ao contrário (x1 no fim da aresta) continua ao contrário', () => {
    const reversed: Wall = { id: 'rev', x1: 60, y1: 0, x2: 40, y2: 0, blocksLight: true, blocksMove: true, door: DOOR, regionId: REGION, regionEdgeIndex: 0 }
    const [moved] = syncLinkedWallsToPoints([reversed], REGION, SQUARE_POINTS, movedVertex(0, -100, 0))
    expect(moved).toMatchObject({ x1: 20, y1: 0, x2: -20, y2: 0 })
  })
})

describe('remapForInsert', () => {
  it('d. insere na aresta 2 (C→D) no ponto M(150,100): split de w2 gera 5 paredes', () => {
    const walls = squareWalls()

    const result = remapForInsert(walls, REGION, 2, 'wNovo', 150, 100, SQUARE_POINTS[2], SQUARE_POINTS[3])

    expect(result).toHaveLength(5)
    expect(result.find((w) => w.id === 'w0')).toMatchObject({ regionEdgeIndex: 0, x1: 0, y1: 0, x2: 100, y2: 0 })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ regionEdgeIndex: 1, x1: 100, y1: 0, x2: 100, y2: 100 })
    expect(result.find((w) => w.id === 'w2')).toMatchObject({ regionEdgeIndex: 2, x1: 100, y1: 100, x2: 150, y2: 100 })
    expect(result.find((w) => w.id === 'wNovo')).toMatchObject({ regionEdgeIndex: 3, x1: 150, y1: 100, x2: 0, y2: 100 })
    expect(result.find((w) => w.id === 'w3')).toMatchObject({ regionEdgeIndex: 4, x1: 0, y1: 100, x2: 0, y2: 0 })
  })

  it('e. wrap: insere depois da última aresta (3) — nova nasce com índice 4, nada existente troca de índice', () => {
    const walls = squareWalls()

    const result = remapForInsert(walls, REGION, 3, 'wNovo', -50, 50, SQUARE_POINTS[3], SQUARE_POINTS[0])

    expect(result.find((w) => w.id === 'wNovo')).toMatchObject({ regionEdgeIndex: 4, x1: -50, y1: 50 })
    expect(result.find((w) => w.id === 'w0')).toMatchObject({ regionEdgeIndex: 0 })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ regionEdgeIndex: 1 })
    expect(result.find((w) => w.id === 'w2')).toMatchObject({ regionEdgeIndex: 2 })
  })

  it('f. aresta sem parede (buraco): só remapeia índices, nenhuma parede nova nasce', () => {
    const walls = squareWalls().filter((w) => w.id !== 'w2')

    const result = remapForInsert(walls, REGION, 2, 'wNovo', 150, 100, SQUARE_POINTS[2], SQUARE_POINTS[3])

    expect(result).toHaveLength(3)
    expect(result.find((w) => w.id === 'wNovo')).toBeUndefined()
    expect(result.find((w) => w.id === 'w0')).toMatchObject({ regionEdgeIndex: 0 })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ regionEdgeIndex: 1 })
    expect(result.find((w) => w.id === 'w3')).toMatchObject({ regionEdgeIndex: 4 })
  })

  it('aresta com porta: cada pedaço vai para a metade em que está; a porta cortada pelo ponto novo não se parte', () => {
    // Ponto novo no meio da aresta 0 (50,0), dentro da porta (40..60): empate, a porta vai inteira para a aresta 0.
    const result = remapForInsert(squareWithDoorOnTop(), REGION, 0, 'wNovo', 50, 0, SQUARE_POINTS[0], SQUARE_POINTS[1])
    expect(result.find((w) => w.id === 'antes')).toMatchObject({ regionEdgeIndex: 0, x1: 0, x2: 40 })
    expect(result.find((w) => w.id === 'porta')).toMatchObject({ regionEdgeIndex: 0, x1: 40, x2: 60, door: DOOR })
    expect(result.find((w) => w.id === 'wNovo')).toBeUndefined()
    expect(result.find((w) => w.id === 'depois')).toMatchObject({ regionEdgeIndex: 1, x1: 60, x2: 100 })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ regionEdgeIndex: 2 })
  })

  it('parede comum cortada pelo ponto novo continua fazendo split (só a porta fica inteira)', () => {
    const result = remapForInsert(squareWithDoorOnTop(), REGION, 0, 'wNovo', 20, 0, SQUARE_POINTS[0], SQUARE_POINTS[1])
    expect(result.find((w) => w.id === 'antes')).toMatchObject({ regionEdgeIndex: 0, x1: 0, x2: 20, door: null })
    expect(result.find((w) => w.id === 'wNovo')).toMatchObject({ regionEdgeIndex: 1, x1: 20, x2: 40, door: null })
    const porta = result.find((w) => w.id === 'porta')
    expect(porta).toMatchObject({ regionEdgeIndex: 1, door: DOOR })
    // Reparametrizada na aresta nova (20..100): conta em ponto flutuante, daí toBeCloseTo.
    expect(porta?.x1).toBeCloseTo(40)
    expect(porta?.x2).toBeCloseTo(60)
  })
})

describe('remapForRemove', () => {
  it('g. remove o vértice 1 (B) do resultado do caso (d) — sobrevivente é w0 (A→C), w1 some', () => {
    // 5 pontos: A(0,0) B(100,0) C(100,100) M(150,100) D(0,100)
    const walls: Wall[] = [
      { id: 'w0', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 0 },
      { id: 'w1', x1: 100, y1: 0, x2: 100, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 1 },
      { id: 'w2', x1: 100, y1: 100, x2: 150, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 2 },
      { id: 'wNovo', x1: 150, y1: 100, x2: 0, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 3 },
      { id: 'w3', x1: 0, y1: 100, x2: 0, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: REGION, regionEdgeIndex: 4 },
    ]
    const A = { x: 0, y: 0 }
    const C = { x: 100, y: 100 }

    const result = remapForRemove(walls, REGION, 1, 5, A, C)

    expect(result.find((w) => w.id === 'w1')).toBeUndefined()
    expect(result.find((w) => w.id === 'w0')).toMatchObject({ regionEdgeIndex: 0, x1: 0, y1: 0, x2: 100, y2: 100 })
    expect(result.find((w) => w.id === 'w2')).toMatchObject({ regionEdgeIndex: 1 })
    expect(result.find((w) => w.id === 'wNovo')).toMatchObject({ regionEdgeIndex: 2 })
    expect(result.find((w) => w.id === 'w3')).toMatchObject({ regionEdgeIndex: 3 })
  })

  it('h. remove o vértice 0 (A, caso de wrap) do quadrado original — sobrevivente é w3 (D→B) com índice 2, w0 some', () => {
    const walls = squareWalls()
    const D = { x: 0, y: 100 }
    const B = { x: 100, y: 0 }

    const result = remapForRemove(walls, REGION, 0, 4, D, B)

    expect(result.find((w) => w.id === 'w0')).toBeUndefined()
    expect(result.find((w) => w.id === 'w3')).toMatchObject({ regionEdgeIndex: 2, x1: 0, y1: 100, x2: 100, y2: 0 })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ regionEdgeIndex: 0 })
    expect(result.find((w) => w.id === 'w2')).toMatchObject({ regionEdgeIndex: 1 })
  })

  it('i. sobrevivente da aresta anterior não existe: promove a parede da aresta index em vez de nada sobrar', () => {
    const walls = squareWalls().filter((w) => w.id !== 'w0') // some a parede da aresta "prev" (0)
    const A: RegionPoint = { x: 0, y: 0 }
    const C: RegionPoint = { x: 100, y: 100 }

    const result = remapForRemove(walls, REGION, 1, 4, A, C)

    // w1 (aresta1, B→C) é promovida: vira a mesclada A→C na aresta 0.
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ regionEdgeIndex: 0, x1: 0, y1: 0, x2: 100, y2: 100 })
    expect(result.find((w) => w.id === 'w2')).toMatchObject({ regionEdgeIndex: 1 })
    expect(result.find((w) => w.id === 'w3')).toMatchObject({ regionEdgeIndex: 2 })
    expect(result).toHaveLength(3)
  })
})

describe('remapForRemove com porta', () => {
  it('remover o vértice B funde as arestas 0 e 1 e mantém porta e pedaços na posição proporcional', () => {
    // Aresta 0 (A→B, 100) com porta 40..60 e aresta 1 (B→C, 100) inteira: fundida A→C mede o dobro no parâmetro.
    const result = remapForRemove(squareWithDoorOnTop(), REGION, 1, 4, SQUARE_POINTS[0], SQUARE_POINTS[2], SQUARE_POINTS[1])
    expect(result).toHaveLength(6)
    expect(result.find((w) => w.id === 'porta')).toMatchObject({ regionEdgeIndex: 0, x1: 20, y1: 20, x2: 30, y2: 30, door: DOOR })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ regionEdgeIndex: 0, x1: 50, y1: 50, x2: 100, y2: 100 })
    expect(result.find((w) => w.id === 'w2')).toMatchObject({ regionEdgeIndex: 1 })
    expect(result.find((w) => w.id === 'w3')).toMatchObject({ regionEdgeIndex: 2 })
  })
})

describe('linkLooseWallsToRooms (migração)', () => {
  const room = (id: string, points: RegionPoint[]): Region => ({ id, points, tag: '', fillColor: '#000', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: id } })
  const loose = (id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall => ({ id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door })

  it('parede solta sobre uma aresta de uma Sala volta a ser dela; fora da borda ou em borda de duas Salas fica solta', () => {
    const casa = room('casa', SQUARE_POINTS)
    const vizinha = room('vizinha', [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }])
    const walls = [loose('porta', 40, 0.3, 60, 0, DOOR), loose('dentro', 10, 50, 90, 50), loose('divisa', 100, 20, 100, 60), loose('comprida', -10, 0, 60, 0)]
    const result = linkLooseWallsToRooms([casa, vizinha], walls)
    expect(result.find((w) => w.id === 'porta')).toMatchObject({ regionId: 'casa', regionEdgeIndex: 0, door: DOOR })
    expect(result.find((w) => w.id === 'dentro')?.regionId).toBeUndefined()
    expect(result.find((w) => w.id === 'divisa')?.regionId).toBeUndefined()
    expect(result.find((w) => w.id === 'comprida')?.regionId).toBeUndefined()
  })

  it('nada a vincular (ou região comum sem room) devolve a mesma referência', () => {
    const walls = [loose('a', 0, 0, 50, 0)]
    const areaComum: Region = { ...room('x', SQUARE_POINTS), room: undefined }
    expect(linkLooseWallsToRooms([areaComum], walls)).toBe(walls)
  })
})

describe('translateLinkedWalls', () => {
  it('j. desloca as paredes vinculadas por (dx,dy) e ignora parede de outro regionId (mesma referência)', () => {
    const walls = squareWalls()
    const outra: Wall = { id: 'wOutra', x1: 500, y1: 500, x2: 600, y2: 500, blocksLight: true, blocksMove: true, door: null, regionId: 'outro' }
    const withOutra = [...walls, outra]

    const result = translateLinkedWalls(withOutra, REGION, 50, -20)

    expect(result.find((w) => w.id === 'w0')).toMatchObject({ x1: 50, y1: -20, x2: 150, y2: -20 })
    expect(result.find((w) => w.id === 'w1')).toMatchObject({ x1: 150, y1: -20, x2: 150, y2: 80 })
    expect(result.find((w) => w.id === 'w2')).toMatchObject({ x1: 150, y1: 80, x2: 50, y2: 80 })
    expect(result.find((w) => w.id === 'w3')).toMatchObject({ x1: 50, y1: 80, x2: 50, y2: -20 })
    expect(result.find((w) => w.id === 'wOutra')).toBe(outra)
  })
})
