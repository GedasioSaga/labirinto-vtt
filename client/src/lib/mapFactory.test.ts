import { describe, expect, it } from 'vitest'
import {
  createEmptyMap,
  addWall,
  removeWall,
  addLight,
  removeLight,
  addRegion,
  removeRegion,
  addRoom,
  updateWallPoint,
  moveWall,
  updateRegionPoint,
  insertRegionPoint,
  removeRegionPoint,
  moveRegion,
  linkRegionWalls,
  smoothRegion,
  addToken,
  removeToken,
  setTokenPosition,
  addProp,
  removeProp,
  setPropPosition,
  setShowGrid,
  setGridShape,
  addDrawing,
  removeDrawing,
  setWallDoor,
  addDoorOnWall,
  setScenarioLink,
  insertCurvePoint,
  removeCurvePoint,
  moveCurve,
} from './mapFactory'
import type { Wall, Light, Region, Token, Prop, Drawing } from '../types/map'
import { buildRoomFromDraft } from './drawingFactory'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }
const light: Light = { id: 'l1', x: 32, y: 32, radius: 8, color: '#ffaa33', intensity: 0.8 }
const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }], tag: 'trap', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }
const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 }

describe('createEmptyMap', () => {
  it('cria mapa com defaults corretos', () => {
    const map = createEmptyMap('map_1', 'Teste', 30, 20, 64)
    expect(map).toEqual({
      id: 'map_1',
      name: 'Teste',
      width: 30,
      height: 20,
      grid: 64,
      gridShape: 'square',
      showGrid: true,
      background: { type: 'color', src: '#2b2b2b' },
      walls: [],
      lights: [],
      regions: [],
      tokens: [],
      props: [],
      drawings: [],
      fog: { mode: 'none', revealed: [] },
      ownerId: null,
      scenarioLink: null,
    })
  })
})

describe('addWall/removeWall', () => {
  it('adiciona sem mutar o mapa original', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const next = addWall(map, wall)
    expect(map.walls).toHaveLength(0)
    expect(next.walls).toEqual([wall])
  })

  it('remove só a parede com o id informado', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), wall)
    const withSecond = addWall(map, { ...wall, id: 'w2' })
    const next = removeWall(withSecond, 'w1')
    expect(next.walls.map((w) => w.id)).toEqual(['w2'])
  })
})

describe('addLight/removeLight', () => {
  it('funciona igual a wall', () => {
    const map = addLight(createEmptyMap('m', 'x', 10, 10, 64), light)
    expect(map.lights).toEqual([light])
    expect(removeLight(map, 'l1').lights).toEqual([])
  })
})

describe('addRegion/removeRegion', () => {
  it('funciona igual a wall', () => {
    const map = addRegion(createEmptyMap('m', 'x', 10, 10, 64), region)
    expect(map.regions).toEqual([region])
    expect(removeRegion(map, 'r1').regions).toEqual([])
  })
})

describe('addToken/removeToken/setTokenPosition', () => {
  it('adiciona e remove token', () => {
    const map = addToken(createEmptyMap('m', 'x', 10, 10, 64), token)
    expect(map.tokens).toEqual([token])
    expect(removeToken(map, 't1').tokens).toEqual([])
  })

  it('setTokenPosition move só o token alvo', () => {
    const map = addToken(createEmptyMap('m', 'x', 10, 10, 64), token)
    const withSecond = addToken(map, { ...token, id: 't2', x: 5, y: 5 })
    const next = setTokenPosition(withSecond, 't1', 100, 200)
    const t1 = next.tokens.find((t) => t.id === 't1')
    const t2 = next.tokens.find((t) => t.id === 't2')
    expect(t1).toEqual({ ...token, x: 100, y: 200 })
    expect(t2).toEqual({ ...token, id: 't2', x: 5, y: 5 })
  })
})

describe('addProp/removeProp/setPropPosition', () => {
  const prop: Prop = { id: 'p1', src: '/tmp/tree.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }

  it('adiciona e remove prop', () => {
    const map = addProp(createEmptyMap('m', 'x', 10, 10, 64), prop)
    expect(map.props).toEqual([prop])
    expect(removeProp(map, 'p1').props).toEqual([])
  })

  it('setPropPosition move só o prop alvo', () => {
    const map = addProp(createEmptyMap('m', 'x', 10, 10, 64), prop)
    const withSecond = addProp(map, { ...prop, id: 'p2', x: 5, y: 5 })
    const next = setPropPosition(withSecond, 'p1', 100, 200)
    const p1 = next.props.find((p) => p.id === 'p1')
    const p2 = next.props.find((p) => p.id === 'p2')
    expect(p1).toEqual({ ...prop, x: 100, y: 200 })
    expect(p2).toEqual({ ...prop, id: 'p2', x: 5, y: 5 })
  })
})

describe('setShowGrid', () => {
  it('alterna a flag', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setShowGrid(map, false).showGrid).toBe(false)
  })
})

describe('setGridShape', () => {
  it('troca o formato do grid', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setGridShape(map, 'hex').gridShape).toBe('hex')
  })
})

describe('setWallDoor', () => {
  it('seta porta na parede com o id informado, sem tocar outras', () => {
    const map = addWall(addWall(createEmptyMap('m', 'x', 10, 10, 64), wall), { ...wall, id: 'w2' })
    const next = setWallDoor(map, 'w1', { open: false, locked: false })
    const w1 = next.walls.find((w) => w.id === 'w1')
    const w2 = next.walls.find((w) => w.id === 'w2')
    expect(w1?.door).toEqual({ open: false, locked: false })
    expect(w2?.door).toBeNull()
  })

  it('remove a porta (volta pra null) sem tocar outras paredes', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...wall, door: { open: true, locked: false } })
    const next = setWallDoor(map, 'w1', null)
    expect(next.walls[0].door).toBeNull()
  })
})

describe('addDoorOnWall', () => {
  it('parede horizontal longa, clique no meio: gera 3 pedaços, o do meio tem door setado e mesmo y nos dois pontos (alinhado)', () => {
    const horizontal: Wall = { id: 'wH', x1: 0, y1: 40, x2: 64, y2: 40, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), horizontal)

    const next = addDoorOnWall(map, 'wH', { x: 32, y: 40 }, 16)

    expect(next.walls).toHaveLength(3)
    expect(next.walls.find((w) => w.id === 'wH')).toBeUndefined()

    const doorPiece = next.walls.find((w) => w.door !== null)
    expect(doorPiece).toBeDefined()
    expect(doorPiece!.door).toEqual({ open: false, locked: false })
    // Alinhado: os dois pontos da porta continuam no mesmo y da parede original.
    expect(doorPiece!.y1).toBe(40)
    expect(doorPiece!.y2).toBe(40)

    const solidPieces = next.walls.filter((w) => w.door === null)
    expect(solidPieces).toHaveLength(2)
    for (const piece of solidPieces) {
      expect(piece.y1).toBe(40)
      expect(piece.y2).toBe(40)
    }
  })

  it('parede diagonal: os pedaços gerados mantêm a mesma proporção dx/dy da parede original (ângulo herdado, não forçado)', () => {
    const diagonal: Wall = { id: 'wD', x1: 10, y1: 20, x2: 110, y2: 70, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), diagonal)
    const originalRatio = (diagonal.x2 - diagonal.x1) / (diagonal.y2 - diagonal.y1)

    // Ponto de clique já sobre a própria linha (t=0.4): (10+100*0.4, 20+50*0.4).
    const next = addDoorOnWall(map, 'wD', { x: 50, y: 40 }, 20)

    expect(next.walls.length).toBeGreaterThanOrEqual(1)
    expect(next.walls.length).toBeLessThanOrEqual(3)
    for (const piece of next.walls) {
      const pieceRatio = (piece.x2 - piece.x1) / (piece.y2 - piece.y1)
      expect(pieceRatio).toBeCloseTo(originalRatio, 9)
    }
    // A porta em si nasce no ângulo certo, não travada em H ou V.
    const doorPiece = next.walls.find((w) => w.door !== null)
    expect(doorPiece).toBeDefined()
    expect(doorPiece!.x1).not.toBe(doorPiece!.x2)
    expect(doorPiece!.y1).not.toBe(doorPiece!.y2)
  })

  it('clique perto de uma ponta: só sobra 1 pedaço sólido do outro lado (o lado curto desaparece)', () => {
    const horizontal: Wall = { id: 'wH', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), horizontal)

    // Clique a 5px do início, doorLength 32 (metade=16): a janela (5-16 a 5+16)
    // clampa o início em 0 — não sobra pedaço "antes".
    const next = addDoorOnWall(map, 'wH', { x: 5, y: 0 }, 32)

    expect(next.walls).toHaveLength(2)
    const doorPiece = next.walls.find((w) => w.door !== null)
    const solidPiece = next.walls.find((w) => w.door === null)
    expect(doorPiece).toBeDefined()
    expect(solidPiece).toBeDefined()
    // A porta começa exatamente na ponta original da parede (clampada em 0).
    expect(doorPiece!.x1).toBe(0)
    expect(doorPiece!.y1).toBe(0)
    // O pedaço sólido remanescente fecha a parede até o outro extremo original.
    expect(solidPiece!.x2).toBe(64)
    expect(solidPiece!.y2).toBe(0)
  })

  it('parede vinculada a região: os pedaços novos perdem regionId/regionEdgeIndex (viram paredes soltas)', () => {
    const linked: Wall = {
      id: 'wLinked',
      x1: 0,
      y1: 0,
      x2: 64,
      y2: 0,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId: 'r1',
      regionEdgeIndex: 2,
    }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), linked)

    const next = addDoorOnWall(map, 'wLinked', { x: 32, y: 0 }, 16)

    expect(next.walls).toHaveLength(3)
    for (const piece of next.walls) {
      expect(piece.regionId).toBeUndefined()
      expect(piece.regionEdgeIndex).toBeUndefined()
    }
  })

  it('parede inexistente: devolve o map original pela mesma referência', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(addDoorOnWall(map, 'inexistente', { x: 0, y: 0 }, 16)).toBe(map)
  })
})

describe('setScenarioLink', () => {
  it('seta o link de cenário', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setScenarioLink(map, 'https://exemplo.com/cenario').scenarioLink).toBe('https://exemplo.com/cenario')
  })

  it('aceita null', () => {
    const map = setScenarioLink(createEmptyMap('m', 'x', 10, 10, 64), 'https://exemplo.com/cenario')
    expect(setScenarioLink(map, null).scenarioLink).toBeNull()
  })
})

function buildRoomFixture() {
  return buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 100, y: 100 })
}

describe('addRoom', () => {
  it('adiciona a região e as N paredes de uma vez', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const { region, walls } = buildRoomFixture()

    const next = addRoom(map, region, walls)

    expect(next.regions).toEqual([region])
    expect(next.walls).toEqual(walls)
  })
})

describe('updateWallPoint', () => {
  it('atualiza o endpoint de uma parede solta', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), wall)

    const next = updateWallPoint(map, 'w1', 0, 50, 50)

    expect(next.walls[0]).toEqual({ ...wall, x1: 50, y1: 50 })
  })

  it('não faz nada (map idêntico) numa parede vinculada a região', () => {
    const { region, walls } = buildRoomFixture()
    const withRoom = addRoom(createEmptyMap('m', 'x', 10, 10, 64), region, walls)

    const next = updateWallPoint(withRoom, 'w0', 0, 999, 999)

    expect(next).toBe(withRoom)
  })
})

describe('moveWall', () => {
  it('desloca uma parede solta', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), wall)

    const next = moveWall(map, 'w1', 10, 20)

    expect(next.walls[0]).toEqual({ ...wall, x1: 10, y1: 20, x2: 74, y2: 20 })
  })

  it('numa parede vinculada, desloca a região inteira junto com todas as paredes vinculadas', () => {
    const { region, walls } = buildRoomFixture()
    const map = addRoom(createEmptyMap('m', 'x', 10, 10, 64), region, walls)

    const viaMoveWall = moveWall(map, 'w0', 10, 20)
    const viaMoveRegion = moveRegion(map, 'r1', 10, 20)

    expect(viaMoveWall).toEqual(viaMoveRegion)
    expect(viaMoveWall.regions[0].points).toEqual(region.points.map((p) => ({ x: p.x + 10, y: p.y + 20 })))
    expect(viaMoveWall.walls.filter((w) => w.regionId === 'r1')).toHaveLength(4)
  })
})

describe('updateRegionPoint', () => {
  it('atualiza o ponto e resincroniza as paredes vinculadas', () => {
    const { region, walls } = buildRoomFixture()
    const map = addRoom(createEmptyMap('m', 'x', 10, 10, 64), region, walls)

    const next = updateRegionPoint(map, 'r1', 0, 5, 5)

    expect(next.regions[0].points[0]).toEqual({ x: 5, y: 5 })
    const w0 = next.walls.find((w) => w.id === 'w0')
    const w3 = next.walls.find((w) => w.id === 'w3')
    expect(w0).toMatchObject({ x1: 5, y1: 5 })
    expect(w3).toMatchObject({ x2: 5, y2: 5 })
  })
})

describe('insertRegionPoint/removeRegionPoint', () => {
  it('insere e depois remove o mesmo ponto, voltando ao estado original', () => {
    const { region, walls } = buildRoomFixture()
    const map = addRoom(createEmptyMap('m', 'x', 10, 10, 64), region, walls)

    const inserted = insertRegionPoint(map, 'r1', 0, 50, 0, 'wNovo')
    expect(inserted.regions[0].points).toHaveLength(5)
    expect(inserted.walls).toHaveLength(5)

    const removed = removeRegionPoint(inserted, 'r1', 1)

    expect(removed.regions[0].points).toEqual(region.points)
    expect(removed.walls).toEqual(walls)
  })

  it('recusa (map idêntico) quando a região só tem 3 pontos', () => {
    const triangle: Region = {
      id: 'tri',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
      tag: 'trap',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
    }
    const map = addRegion(createEmptyMap('m', 'x', 10, 10, 64), triangle)

    const next = removeRegionPoint(map, 'tri', 0)

    expect(next).toBe(map)
  })
})

describe('linkRegionWalls', () => {
  const squareRegion: Region = {
    id: 'r1',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: 'room',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }

  it('região sem nenhuma parede ganha as N paredes certas (coordenadas e regionEdgeIndex batendo)', () => {
    const map = addRegion(createEmptyMap('m', 'x', 10, 10, 64), squareRegion)

    const next = linkRegionWalls(map, 'r1')

    const linked = next.walls.filter((w) => w.regionId === 'r1')
    expect(linked).toHaveLength(4)
    const byEdge = (i: number) => linked.find((w) => w.regionEdgeIndex === i)
    expect(byEdge(0)).toMatchObject({ x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null })
    expect(byEdge(1)).toMatchObject({ x1: 100, y1: 0, x2: 100, y2: 100 })
    expect(byEdge(2)).toMatchObject({ x1: 100, y1: 100, x2: 0, y2: 100 })
    expect(byEdge(3)).toMatchObject({ x1: 0, y1: 100, x2: 0, y2: 0 })
  })

  it('região com 2 de 4 arestas já com parede: só as faltando nascem, as existentes continuam pela mesma referência', () => {
    let map = addRegion(createEmptyMap('m', 'x', 10, 10, 64), squareRegion)
    const wall0: Wall = { id: 'existing0', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 0 }
    const wall2: Wall = { id: 'existing2', x1: 100, y1: 100, x2: 0, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 2 }
    map = addWall(map, wall0)
    map = addWall(map, wall2)

    const next = linkRegionWalls(map, 'r1')

    const linked = next.walls.filter((w) => w.regionId === 'r1')
    expect(linked).toHaveLength(4)
    expect(linked.find((w) => w.regionEdgeIndex === 0)).toBe(wall0)
    expect(linked.find((w) => w.regionEdgeIndex === 2)).toBe(wall2)
    expect(linked.find((w) => w.regionEdgeIndex === 1)).toMatchObject({ x1: 100, y1: 0, x2: 100, y2: 100 })
    expect(linked.find((w) => w.regionEdgeIndex === 3)).toMatchObject({ x1: 0, y1: 100, x2: 0, y2: 0 })
  })

  it('região com todas as arestas completas retorna o map original (mesma referência)', () => {
    const { region, walls } = buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 100, y: 100 })
    const map = addRoom(createEmptyMap('m', 'x', 10, 10, 64), region, walls)

    const next = linkRegionWalls(map, 'r1')

    expect(next).toBe(map)
  })

  it('região inexistente retorna o map original (mesma referência)', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    const next = linkRegionWalls(map, 'inexistente')

    expect(next).toBe(map)
  })
})

describe('smoothRegion', () => {
  const squareRegion: Region = {
    id: 'r1',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: 'room',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }

  it('região SEM parede vinculada: só os pontos mudam (efeito do Chaikin), walls não é tocado', () => {
    const map = addRegion(createEmptyMap('m', 'x', 10, 10, 64), squareRegion)

    const next = smoothRegion(map, 'r1')

    expect(next.walls).toBe(map.walls)
    const nextRegion = next.regions.find((r) => r.id === 'r1')
    // Quadrado exato não perde canto no simplifyPolygon; o Chaikin (1 iteração)
    // dobra a contagem de 4 pra 8.
    expect(nextRegion?.points).toHaveLength(8)
  })

  it('região COM parede vinculada: as paredes antigas somem e um conjunto novo cobre TODAS as arestas do contorno suavizado', () => {
    const { region, walls } = buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 100, y: 100 })
    const map = addRoom(createEmptyMap('m', 'x', 10, 10, 64), region, walls)

    const next = smoothRegion(map, 'r1')

    const nextRegion = next.regions.find((r) => r.id === 'r1')
    expect(nextRegion?.points).toHaveLength(8)

    const linked = next.walls.filter((w) => w.regionId === 'r1')
    expect(linked).toHaveLength(8)
    expect(linked.map((w) => w.regionEdgeIndex).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 1, 2, 3, 4, 5, 6, 7])

    // As 4 paredes antigas (ids w0..w3) não sobrevivem — a geometria mudou.
    for (const oldId of ['w0', 'w1', 'w2', 'w3']) {
      expect(next.walls.find((w) => w.id === oldId)).toBeUndefined()
    }

    // Toda aresta do contorno novo tem parede traçando exatamente aquele par de pontos.
    const n = nextRegion!.points.length
    for (let i = 0; i < n; i += 1) {
      const from = nextRegion!.points[i]
      const to = nextRegion!.points[(i + 1) % n]
      const wall = linked.find((w) => w.regionEdgeIndex === i)
      expect(wall).toMatchObject({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })
    }
  })

  it('região inexistente retorna o map original (mesma referência)', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    const next = smoothRegion(map, 'inexistente')

    expect(next).toBe(map)
  })
})

describe('removeRegion (cascata)', () => {
  it('remove as paredes vinculadas, preservando parede solta e parede de outra região', () => {
    const { region: r1, walls: w1s } = buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 100, y: 100 })
    const { region: r2, walls: w2s } = buildRoomFromDraft('r2', ['x0', 'x1', 'x2', 'x3'], { x: 200, y: 200 }, { x: 300, y: 300 })
    let map = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRoom(map, r1, w1s)
    map = addRoom(map, r2, w2s)
    map = addWall(map, { ...wall, id: 'wLoose' })

    const next = removeRegion(map, 'r1')

    expect(next.regions.map((r) => r.id)).toEqual(['r2'])
    expect(next.walls.some((w) => w.regionId === 'r1')).toBe(false)
    expect(next.walls.some((w) => w.regionId === 'r2')).toBe(true)
    expect(next.walls.find((w) => w.id === 'w0')).toBeUndefined()
    expect(next.walls.find((w) => w.id === 'x1')).toBeDefined()
    expect(next.walls.find((w) => w.id === 'wLoose')).toBeDefined()
  })
})

describe('addDrawing/removeDrawing', () => {
  const freehand = { id: 'd1', kind: 'freehand' as const, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#ffffff', width: 4 }

  it('adiciona um desenho ao mapa', () => {
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), freehand)
    expect(map.drawings).toEqual([freehand])
  })

  it('remove um desenho pelo id', () => {
    let map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), freehand)
    map = removeDrawing(map, 'd1')
    expect(map.drawings).toEqual([])
  })
})

describe('insertCurvePoint/removeCurvePoint', () => {
  const curve: Drawing = { id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }], color: '#ffffff', width: 4 }

  it('insere e depois remove o mesmo ponto, voltando ao estado original', () => {
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), curve)

    const inserted = insertCurvePoint(map, 'c1', 0, 25, 25)
    const insertedDrawing = inserted.drawings[0]
    expect(insertedDrawing.kind).toBe('curve')
    if (insertedDrawing.kind === 'curve') {
      expect(insertedDrawing.points).toEqual([{ x: 0, y: 0 }, { x: 25, y: 25 }, { x: 50, y: 50 }, { x: 100, y: 0 }])
    }

    const removed = removeCurvePoint(inserted, 'c1', 1)
    expect(removed.drawings[0]).toEqual(curve)
  })

  it('recusa (map idêntico) quando a curva só tem 2 pontos', () => {
    const twoPointCurve: Drawing = { id: 'c2', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#ffffff', width: 4 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), twoPointCurve)

    const next = removeCurvePoint(map, 'c2', 0)

    expect(next).toBe(map)
  })

  it('não faz nada (map idêntico) quando o drawing não existe ou não é curve', () => {
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), curve)
    const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 4 }
    const withLine = addDrawing(map, line)

    expect(insertCurvePoint(withLine, 'inexistente', 0, 1, 1)).toBe(withLine)
    expect(removeCurvePoint(withLine, 'inexistente', 0)).toBe(withLine)
    expect(insertCurvePoint(withLine, 'l1', 0, 1, 1)).toBe(withLine)
    expect(removeCurvePoint(withLine, 'l1', 0)).toBe(withLine)
  })
})

describe('moveCurve', () => {
  it('desloca todos os pontos da curva pelo mesmo delta, sem tocar outra curva', () => {
    const curve: Drawing = { id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }], color: '#ffffff', width: 4 }
    const other: Drawing = { id: 'c2', kind: 'curve', points: [{ x: 5, y: 5 }], color: '#ffffff', width: 4 }
    const map = addDrawing(addDrawing(createEmptyMap('m', 'x', 10, 10, 64), curve), other)

    const next = moveCurve(map, 'c1', 10, 20)

    const moved = next.drawings.find((d) => d.id === 'c1')
    const untouched = next.drawings.find((d) => d.id === 'c2')
    expect(moved?.kind).toBe('curve')
    if (moved?.kind === 'curve') expect(moved.points).toEqual([{ x: 10, y: 20 }, { x: 60, y: 70 }])
    expect(untouched).toEqual(other)
  })

  it('não faz nada (map idêntico) quando o drawing não existe', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(moveCurve(map, 'inexistente', 1, 1)).toBe(map)
  })
})
