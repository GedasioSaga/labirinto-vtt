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
  setTokenImage,
  renameToken,
  nextTokenName,
  addProp,
  removeProp,
  setPropPosition,
  setPropLayer,
  setShowGrid,
  setGridShape,
  setGridSettings,
  setGridOffset,
  setGridCellSize,
  toggleLayerVisibility,
  toggleLayerLock,
  addDrawing,
  removeDrawing,
  setWallDoor,
  setWallKindForWall,
  setWallThicknessForWall,
  setWallLineStyleForWall,
  addDoorOnWall,
  setWallDoorKind,
  setDoorLocked,
  addStair,
  removeStair,
  moveStair,
  updateStairPoint,
  setStairDirection,
  setRoomName,
  resizeRoomDimensions,
  resizeRoomCornerLive,
  setMapScale,
  setMeasurementMode,
  setScenarioLink,
  insertCurvePoint,
  removeCurvePoint,
  moveCurve,
  moveDrawing,
  resizeDrawingCornerLive,
  resizePropCornerLive,
} from './mapFactory'
import type { MapData, Wall, Light, Region, Token, Prop, Drawing, Stair } from '../types/map'
import { buildRoomFromDraft } from './drawingFactory'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }
const light: Light = { id: 'l1', x: 32, y: 32, radius: 8, color: '#ffaa33', intensity: 0.8 }
const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }], tag: 'trap', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }
const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null }

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
      showGrid: false,
      gridSettings: { color: '#000000', opacity: 0.25, lineWidth: 1, lineStyle: 'solid' },
      background: { type: 'color', src: '#2b2b2b' },
      walls: [],
      lights: [],
      regions: [],
      tokens: [],
      props: [],
      stairs: [],
      drawings: [],
      floor: [],
      floorStyle: { fillColor: '#a8776a', strokeColor: null, strokeWidth: 1 },
      lines: [],
      markers: [],
      concealZones: [],
      pins: [],
      frame: null,
      fog: { mode: 'none', revealed: [] },
      hiddenLayers: [],
      lockedLayers: [],
      scale: { unitsPerCell: 1.5, unit: 'm', precision: 1 },
      measurementMode: 'chessboard',
      ownerId: null,
      scenarioLink: null,
    })
  })

  it('floorStyle de cada mapa novo é cópia, não a constante compartilhada', () => {
    const a = createEmptyMap('a', 'A', 10, 10, 64)
    const b = createEmptyMap('b', 'B', 10, 10, 64)
    expect(a.floorStyle).not.toBe(b.floorStyle)
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

  // Risco §3/§5 do plano: mapa quadrado em 'manhattan' que vira hex não pode
  // ficar com um measurementMode que não existe em hex (measurementModesForShape
  // não inclui 'manhattan' pra 'hex').
  it('quadrado→hex: reseta measurementMode pro default de hex ("hex")', () => {
    const map = setMeasurementMode(createEmptyMap('m', 'x', 10, 10, 64), 'manhattan')
    expect(setGridShape(map, 'hex').measurementMode).toBe('hex')
  })

  it('hex→quadrado: reseta measurementMode pro default de quadrado ("chessboard")', () => {
    const map = setMeasurementMode(setGridShape(createEmptyMap('m', 'x', 10, 10, 64), 'hex'), 'hex')
    expect(setGridShape(map, 'square').measurementMode).toBe('chessboard')
  })

  // F3 (grid-triangular, contrato C6): 'triangle' é o 3º GridShape.
  it('quadrado→triangle: reseta measurementMode pro default de triangle ("euclidean")', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setGridShape(map, 'triangle').gridShape).toBe('triangle')
    expect(setGridShape(map, 'triangle').measurementMode).toBe('euclidean')
  })
})

describe('setGridOffset/setGridCellSize (F3, "alinhar grade à imagem" — contrato C5)', () => {
  it('setGridOffset substitui o deslocamento inteiro', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(map.gridOffset).toBeUndefined()

    const next = setGridOffset(map, { x: 12, y: -7 })

    expect(next.gridOffset).toEqual({ x: 12, y: -7 })
  })

  it('setGridOffset não muda mais nada no map', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const next = setGridOffset(map, { x: 5, y: 5 })
    expect(next.grid).toBe(map.grid)
    expect(next.gridShape).toBe(map.gridShape)
  })

  it('setGridCellSize troca MapData.grid, sem tocar em mais nada', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    const next = setGridCellSize(map, 48)

    expect(next.grid).toBe(48)
    expect(next.gridShape).toBe(map.gridShape)
  })
})

describe('setWallDoor', () => {
  it('seta porta na parede com o id informado, sem tocar outras', () => {
    const map = addWall(addWall(createEmptyMap('m', 'x', 10, 10, 64), wall), { ...wall, id: 'w2' })
    const next = setWallDoor(map, 'w1', { open: false, locked: false, kind: 'normal' })
    const w1 = next.walls.find((w) => w.id === 'w1')
    const w2 = next.walls.find((w) => w.id === 'w2')
    expect(w1?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(w2?.door).toBeNull()
  })

  it('remove a porta (volta pra null) sem tocar outras paredes', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...wall, door: { open: true, locked: false, kind: 'normal' } })
    const next = setWallDoor(map, 'w1', null)
    expect(next.walls[0].door).toBeNull()
  })
})

describe('addDoorOnWall', () => {
  it('parede horizontal longa, clique no meio: gera 3 pedaços, o do meio tem door setado e mesmo y nos dois pontos (alinhado)', () => {
    const horizontal: Wall = { id: 'wH', x1: 0, y1: 40, x2: 64, y2: 40, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), horizontal)

    const next = addDoorOnWall(map, 'wH', { x: 32, y: 40 }, 16, 'normal')

    expect(next.walls).toHaveLength(3)
    expect(next.walls.find((w) => w.id === 'wH')).toBeUndefined()

    const doorPiece = next.walls.find((w) => w.door !== null)
    expect(doorPiece).toBeDefined()
    // `addDoorOnWall` (mapFactory.ts:355) agora inclui `kind: 'normal'` no
    // DoorState — campo obrigatório desde a Fase 0 (ver types/map.ts).
    expect(doorPiece!.door).toEqual({ open: false, locked: false, kind: 'normal' })
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
    const next = addDoorOnWall(map, 'wD', { x: 50, y: 40 }, 20, 'normal')

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
    const next = addDoorOnWall(map, 'wH', { x: 5, y: 0 }, 32, 'normal')

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

    const next = addDoorOnWall(map, 'wLinked', { x: 32, y: 0 }, 16, 'normal')

    // Os pedaços mantêm o vínculo: mover/apagar/duplicar a Sala leva a porta junto.
    expect(next.walls).toHaveLength(3)
    for (const piece of next.walls) {
      expect(piece.regionId).toBe('r1')
      expect(piece.regionEdgeIndex).toBe(2)
    }
  })

  it('parede inexistente: devolve o map original pela mesma referência', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(addDoorOnWall(map, 'inexistente', { x: 0, y: 0 }, 16, 'normal')).toBe(map)
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

describe('moveDrawing (F4, bug3 — rect/ellipse/polygon caíam no default e não se moviam)', () => {
  it('move um rect pelo delta', () => {
    const rect: Drawing = { id: 'd1', kind: 'rect', x: 10, y: 10, w: 20, h: 20, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), rect)

    const next = moveDrawing(map, 'd1', 5, -5)

    expect(next.drawings[0]).toEqual({ ...rect, x: 15, y: 5 })
  })

  it('move um ellipse pelo delta', () => {
    const ellipse: Drawing = { id: 'd1', kind: 'ellipse', cx: 10, cy: 10, rx: 5, ry: 5, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), ellipse)

    const next = moveDrawing(map, 'd1', 5, -5)

    expect(next.drawings[0]).toEqual({ ...ellipse, cx: 15, cy: 5 })
  })

  it('move um polygon pelo delta (todos os pontos)', () => {
    const polygon: Drawing = { id: 'd1', kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), polygon)

    const next = moveDrawing(map, 'd1', 5, -5)

    expect(next.drawings[0]).toEqual({ ...polygon, points: [{ x: 5, y: -5 }, { x: 15, y: -5 }, { x: 10, y: 5 }] })
  })

  it('não faz nada (map idêntico) quando o drawing não existe', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(moveDrawing(map, 'inexistente', 1, 1)).toBe(map)
  })
})

describe('resizeDrawingCornerLive (F4, contrato B3)', () => {
  it('redimensiona um rect a partir do canto 2 (baixo-direita), âncora no canto oposto', () => {
    const rect: Drawing = { id: 'd1', kind: 'rect', x: 0, y: 0, w: 100, h: 100, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), rect)

    const next = resizeDrawingCornerLive(map, 'd1', 2, 150, 120, { shift: false, alt: false })

    expect(next.drawings[0]).toEqual({ ...rect, x: 0, y: 0, w: 150, h: 120 })
  })

  it('redimensiona um ellipse a partir do canto 0 (topo-esquerda)', () => {
    const ellipse: Drawing = { id: 'd1', kind: 'ellipse', cx: 50, cy: 50, rx: 50, ry: 50, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), ellipse)

    // box original: (0,0)-(100,100). Canto 0 vai pra (20,30) — âncora no
    // canto oposto (2, {100,100}). Novo box: (20,30)-(100,100).
    const next = resizeDrawingCornerLive(map, 'd1', 0, 20, 30, { shift: false, alt: false })

    expect(next.drawings[0]).toEqual({ ...ellipse, cx: 60, cy: 65, rx: 40, ry: 35 })
  })

  it('redimensiona um polygon escalando todos os pontos em torno do canto oposto', () => {
    const polygon: Drawing = { id: 'd1', kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), polygon)

    const next = resizeDrawingCornerLive(map, 'd1', 2, 200, 100, { shift: false, alt: false })

    expect(next.drawings[0]).toEqual({
      ...polygon,
      points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }],
    })
  })

  it('não faz nada (map idêntico) para um kind sem resize por canto (ex.: line)', () => {
    const line: Drawing = { id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 2 }
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), line)

    expect(resizeDrawingCornerLive(map, 'd1', 0, 5, 5, { shift: false, alt: false })).toBe(map)
  })

  it('não faz nada (map idêntico) quando o drawing não existe', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(resizeDrawingCornerLive(map, 'inexistente', 0, 5, 5, { shift: false, alt: false })).toBe(map)
  })
})

describe('resizePropCornerLive (F4, contrato B3)', () => {
  const prop: Prop = { id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }

  it('redimensiona um prop a partir do canto 2 (baixo-direita), devolvendo x/y/width/height recentrados', () => {
    const map = { ...createEmptyMap('m', 'x', 10, 10, 64), props: [prop] }

    // box original: (-32,-32)-(32,32). Canto 2 vai pra (50,50) — âncora no
    // canto oposto (0, {-32,-32}). Novo box: (-32,-32)-(50,50), recentrado.
    const next = resizePropCornerLive(map, 'p1', 2, 50, 50, { shift: false, alt: false })

    expect(next.props[0]).toEqual({ ...prop, x: 9, y: 9, width: 82, height: 82 })
  })

  it('não faz nada (map idêntico) quando o prop não existe', () => {
    const map = { ...createEmptyMap('m', 'x', 10, 10, 64), props: [prop] }
    expect(resizePropCornerLive(map, 'inexistente', 0, 5, 5, { shift: false, alt: false })).toBe(map)
  })
})

describe('setTokenImage', () => {
  it('seta o caminho da imagem só no token alvo, sem tocar outro', () => {
    const map = addToken(addToken(createEmptyMap('m', 'x', 10, 10, 64), token), { ...token, id: 't2' })

    const next = setTokenImage(map, 't1', '/tmp/goblin.png')

    const t1 = next.tokens.find((t) => t.id === 't1')
    const t2 = next.tokens.find((t) => t.id === 't2')
    expect(t1?.image).toBe('/tmp/goblin.png')
    expect(t2?.image).toBeNull()
  })

  it('aceita null pra voltar ao círculo genérico (campo já era null, nada de novo)', () => {
    const map = addToken(createEmptyMap('m', 'x', 10, 10, 64), { ...token, image: '/tmp/goblin.png' })

    const next = setTokenImage(map, 't1', null)

    expect(next.tokens[0].image).toBeNull()
  })
})

describe('renameToken / nextTokenName', () => {
  it('renameToken troca só o nome do token alvo', () => {
    const map = addToken(addToken(createEmptyMap('m', 'x', 10, 10, 64), token), { ...token, id: 't2' })

    const next = renameToken(map, 't1', 'Ana')

    expect(next.tokens.find((t) => t.id === 't1')).toEqual({ ...token, name: 'Ana' })
    expect(next.tokens.find((t) => t.id === 't2')?.name).toBe('Herói')
  })

  it('renameToken com id inexistente devolve o mapa pela mesma referência', () => {
    const map = addToken(createEmptyMap('m', 'x', 10, 10, 64), token)
    expect(renameToken(map, 'nao-existe', 'Ana')).toBe(map)
  })

  it('nextTokenName: sem tokens sugere "Token 1"; depois, o menor número livre', () => {
    expect(nextTokenName([])).toBe('Token 1')
    expect(nextTokenName([{ name: 'Token 1' }, { name: 'Token 2' }])).toBe('Token 3')
    expect(nextTokenName([{ name: 'Token 2' }])).toBe('Token 1')
  })

  it('nextTokenName ignora nomes fora do padrão e nunca repete um nome já usado', () => {
    const tokens = [{ name: 'Token' }, { name: 'Herói' }, { name: 'Token 1' }, { name: 'Token 1b' }]
    const suggestion = nextTokenName(tokens)
    expect(suggestion).toBe('Token 2')
    expect(tokens.map((t) => t.name)).not.toContain(suggestion)
  })
})

describe('setPropLayer', () => {
  const prop: Prop = { id: 'p1', src: '/tmp/tree.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }

  it('seta a camada só do prop alvo, sem tocar outro', () => {
    const map = addProp(addProp(createEmptyMap('m', 'x', 10, 10, 64), prop), { ...prop, id: 'p2' })

    const next = setPropLayer(map, 'p1', 'decoracao')

    const p1 = next.props.find((p) => p.id === 'p1')
    const p2 = next.props.find((p) => p.id === 'p2')
    expect(p1?.layer).toBe('decoracao')
    expect(p2?.layer).toBeUndefined()
  })

  it('aceita undefined pra voltar ao default (objetos, por derivação em lib/layers.ts) — campo opcional ausente', () => {
    const map = addProp(createEmptyMap('m', 'x', 10, 10, 64), { ...prop, layer: 'decoracao' })

    const next = setPropLayer(map, 'p1', undefined)

    expect(next.props[0].layer).toBeUndefined()
  })
})

describe('setWallKindForWall', () => {
  it('seta o wallKind só da parede alvo, sem tocar outra', () => {
    const map = addWall(addWall(createEmptyMap('m', 'x', 10, 10, 64), wall), { ...wall, id: 'w2' })

    const next = setWallKindForWall(map, 'w1', 'interior')

    const w1 = next.walls.find((w) => w.id === 'w1')
    const w2 = next.walls.find((w) => w.id === 'w2')
    expect(w1?.wallKind).toBe('interior')
    expect(w2?.wallKind).toBeUndefined()
  })

  it('aceita undefined pra voltar ao default exterior — campo opcional ausente', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...wall, wallKind: 'interior' })

    const next = setWallKindForWall(map, 'w1', undefined)

    expect(next.walls[0].wallKind).toBeUndefined()
  })
})

// Fase 6 — pedido do usuário ("ta muito gordo, quero fino/medio/grosso" +
// "ponta reta ou redonda"). Espelho exato dos testes de setWallKindForWall
// acima: mesma função, mesmo formato de teste, dois eixos novos.
describe('setWallThicknessForWall', () => {
  it('seta o thickness só da parede alvo, sem tocar outra', () => {
    const map = addWall(addWall(createEmptyMap('m', 'x', 10, 10, 64), wall), { ...wall, id: 'w2' })

    const next = setWallThicknessForWall(map, 'w1', 'thick')

    const w1 = next.walls.find((w) => w.id === 'w1')
    const w2 = next.walls.find((w) => w.id === 'w2')
    expect(w1?.thickness).toBe('thick')
    expect(w2?.thickness).toBeUndefined()
  })

  it('aceita undefined pra voltar ao default medium — campo opcional ausente', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...wall, thickness: 'thin' })

    const next = setWallThicknessForWall(map, 'w1', undefined)

    expect(next.walls[0].thickness).toBeUndefined()
  })
})

describe('setWallLineStyleForWall', () => {
  it('seta o lineStyle só da parede alvo, sem tocar outra', () => {
    const map = addWall(addWall(createEmptyMap('m', 'x', 10, 10, 64), wall), { ...wall, id: 'w2' })

    const next = setWallLineStyleForWall(map, 'w1', 'straight')

    const w1 = next.walls.find((w) => w.id === 'w1')
    const w2 = next.walls.find((w) => w.id === 'w2')
    expect(w1?.lineStyle).toBe('straight')
    expect(w2?.lineStyle).toBeUndefined()
  })

  it('aceita undefined pra voltar ao default round — campo opcional ausente', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...wall, lineStyle: 'straight' })

    const next = setWallLineStyleForWall(map, 'w1', undefined)

    expect(next.walls[0].lineStyle).toBeUndefined()
  })
})

describe('setGridSettings', () => {
  it('faz merge parcial, preservando os campos não passados no patch', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    const next = setGridSettings(map, { color: '#ff0000' })

    // opacity/lineWidth/lineStyle = padrões do mapa novo (createEmptyMap), intactos
    expect(next.gridSettings).toEqual({ color: '#ff0000', opacity: 0.25, lineWidth: 1, lineStyle: 'solid' })
  })

  it('não muda nenhum outro campo do map', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    const next = setGridSettings(map, { lineStyle: 'dashed' })

    expect(next.showGrid).toBe(map.showGrid)
    expect(next.grid).toBe(map.grid)
    expect(next.gridSettings.lineStyle).toBe('dashed')
  })
})

describe('toggleLayerVisibility', () => {
  it('esconde a camada (adiciona ao array) quando ainda não estava oculta', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    const next = toggleLayerVisibility(map, 'paredes')

    expect(next.hiddenLayers).toEqual(['paredes'])
  })

  it('mostra a camada de novo (remove do array) quando já estava oculta, sem tocar outra camada oculta', () => {
    const map: MapData = { ...createEmptyMap('m', 'x', 10, 10, 64), hiddenLayers: ['paredes', 'tokens'] }

    const next = toggleLayerVisibility(map, 'paredes')

    expect(next.hiddenLayers).toEqual(['tokens'])
  })
})

describe('toggleLayerLock (Onda 4, Frente D)', () => {
  it('trava a camada (adiciona ao array) quando ainda não estava travada', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    const next = toggleLayerLock(map, 'paredes')

    expect(next.lockedLayers).toEqual(['paredes'])
    // Travar não mexe em hiddenLayers — os dois eixos são independentes.
    expect(next.hiddenLayers).toEqual([])
  })

  it('destrava a camada (remove do array) quando já estava travada, sem tocar outra camada travada', () => {
    const map: MapData = { ...createEmptyMap('m', 'x', 10, 10, 64), lockedLayers: ['paredes', 'tokens'] }

    const next = toggleLayerLock(map, 'paredes')

    expect(next.lockedLayers).toEqual(['tokens'])
  })
})

describe('addDoorOnWall — kind (F2)', () => {
  it('a porta nasce com o kind pedido, não mais hardcoded em "normal"', () => {
    const horizontal: Wall = { id: 'wH', x1: 0, y1: 40, x2: 64, y2: 40, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), horizontal)

    const next = addDoorOnWall(map, 'wH', { x: 32, y: 40 }, 64, 'double')

    const doorPiece = next.walls.find((w) => w.door !== null)
    expect(doorPiece?.door).toEqual({ open: false, locked: false, kind: 'double' })
  })
})

describe('setWallDoorKind', () => {
  const doorWall: Wall = { id: 'wDoor', x1: 0, y1: 0, x2: 32, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }

  it('troca o kind e redimensiona o vão pro doorLength informado, centrado no meio do vão atual', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), doorWall)

    const next = setWallDoorKind(map, 'wDoor', 'double', 64)
    const w = next.walls[0]

    expect(w.door?.kind).toBe('double')
    // Meio do vão original era x=16 (0..32) — o vão novo (64px) fica
    // centrado nele: de -16 a 48.
    expect(w.x1).toBe(-16)
    expect(w.x2).toBe(48)
    expect(w.y1).toBe(0)
    expect(w.y2).toBe(0)
  })

  it('parede sem porta (door === null): devolve o map original pela mesma referência', () => {
    const solidWall: Wall = { id: 'wSolid', x1: 0, y1: 0, x2: 32, y2: 0, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), solidWall)

    expect(setWallDoorKind(map, 'wSolid', 'double', 64)).toBe(map)
  })

  it('parede inexistente: devolve o map original pela mesma referência', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)

    expect(setWallDoorKind(map, 'inexistente', 'double', 64)).toBe(map)
  })
})

describe('setDoorLocked', () => {
  const doorWall: Wall = { id: 'wDoor', x1: 0, y1: 0, x2: 32, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }

  it('tranca a porta sem tocar em open/kind', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), doorWall)

    const next = setDoorLocked(map, 'wDoor', true)

    expect(next.walls[0].door).toEqual({ open: false, locked: true, kind: 'normal' })
  })

  it('destranca de volta', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...doorWall, door: { open: false, locked: true, kind: 'normal' } })

    expect(setDoorLocked(map, 'wDoor', false).walls[0].door?.locked).toBe(false)
  })

  it('parede sem porta: devolve o map original pela mesma referência', () => {
    const solidWall: Wall = { id: 'wSolid', x1: 0, y1: 0, x2: 32, y2: 0, blocksLight: true, blocksMove: true, door: null }
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), solidWall)

    expect(setDoorLocked(map, 'wSolid', true)).toBe(map)
  })

  it('trancar uma porta aberta fecha a porta (aberta+trancada não existe)', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...doorWall, door: { open: true, locked: false, kind: 'normal' } })

    expect(setDoorLocked(map, 'wDoor', true).walls[0].door).toEqual({ open: false, locked: true, kind: 'normal' })
  })

  it('setWallDoor abrindo uma trancada destranca (o mestre ligou "Aberta")', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...doorWall, door: { open: false, locked: true, kind: 'normal' } })

    expect(setWallDoor(map, 'wDoor', { open: true, locked: true, kind: 'normal' }).walls[0].door).toEqual({ open: true, locked: false, kind: 'normal' })
  })
})

describe('Stair (F2): addStair/removeStair/moveStair/updateStairPoint/setStairDirection', () => {
  const stair: Stair = { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 0, y2: 64 }], stepWidth: 32 }

  it('addStair adiciona ao array', () => {
    const map = addStair(createEmptyMap('m', 'x', 10, 10, 64), stair)
    expect(map.stairs).toEqual([stair])
  })

  it('removeStair remove pelo id, sem tocar outras', () => {
    const map = addStair(addStair(createEmptyMap('m', 'x', 10, 10, 64), stair), { ...stair, id: 's2' })
    const next = removeStair(map, 's1')
    expect(next.stairs.map((s) => s.id)).toEqual(['s2'])
  })

  it('moveStair desloca todos os segmentos por (dx, dy)', () => {
    const map = addStair(createEmptyMap('m', 'x', 10, 10, 64), stair)
    const next = moveStair(map, 's1', 10, 20)
    expect(next.stairs[0].segments).toEqual([{ x1: 10, y1: 20, x2: 10, y2: 84 }])
  })

  it('updateStairPoint move só o endpoint pedido do segmento indicado', () => {
    const map = addStair(createEmptyMap('m', 'x', 10, 10, 64), stair)
    const next = updateStairPoint(map, 's1', 0, 1, 5, 6)
    expect(next.stairs[0].segments[0]).toEqual({ x1: 0, y1: 0, x2: 5, y2: 6 })
  })

  it('setStairDirection troca a direção', () => {
    const map = addStair(createEmptyMap('m', 'x', 10, 10, 64), stair)
    expect(setStairDirection(map, 's1', 'down').stairs[0].direction).toBe('down')
  })
})

describe('Sala (F2): setRoomName/resizeRoomDimensions/resizeRoomCornerLive', () => {
  function buildRoomMap(): MapData {
    const { region: rawRegion, walls } = buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 100, y: 100 })
    const roomRegion: Region = { ...rawRegion, room: { shape: 'rect', name: 'Sala' } }
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    return { ...map, regions: [roomRegion], walls }
  }

  it('setRoomName renomeia a sala', () => {
    const map = buildRoomMap()
    expect(setRoomName(map, 'r1', 'Salão').regions[0].room?.name).toBe('Salão')
  })

  it('setRoomName numa região sem room: devolve o map original pela mesma referência', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const withPlainRegion: MapData = { ...map, regions: [region] }
    expect(setRoomName(withPlainRegion, 'r1', 'Salão')).toBe(withPlainRegion)
  })

  it('resizeRoomDimensions recalcula os 4 vértices E sincroniza as 4 paredes vinculadas', () => {
    const map = buildRoomMap()

    const next = resizeRoomDimensions(map, 'r1', 200, 50)

    expect(next.regions[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 50 },
      { x: 0, y: 50 },
    ])
    // As 4 paredes vinculadas (regionEdgeIndex 0..3) têm que refletir o
    // contorno novo — RISCO documentado no contrato do B3: sem sincronizar,
    // a sala "redimensiona" visualmente mas as paredes ficam pra trás.
    for (const w of next.walls) {
      expect(w.regionId).toBe('r1')
    }
    const w0 = next.walls.find((w) => w.regionEdgeIndex === 0)
    expect(w0).toMatchObject({ x1: 0, y1: 0, x2: 200, y2: 0 })
    const w2 = next.walls.find((w) => w.regionEdgeIndex === 2)
    expect(w2).toMatchObject({ x1: 200, y1: 50, x2: 0, y2: 50 })
  })

  it('resizeRoomCornerLive: arrastar 1 canto reconstrói o retângulo E sincroniza as paredes', () => {
    const map = buildRoomMap()

    // canto 2 (baixo-direita, {100,100}) vai pra {150, 120} — âncora fica no
    // canto oposto, canto 0 ({0,0}).
    const next = resizeRoomCornerLive(map, 'r1', 2, 150, 120)

    expect(next.regions[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 120 },
      { x: 0, y: 120 },
    ])
    const w1 = next.walls.find((w) => w.regionEdgeIndex === 1)
    expect(w1).toMatchObject({ x1: 150, y1: 0, x2: 150, y2: 120 })
  })

  it('resizeRoomDimensions numa Sala Circular/Polígono (room.shape !== "rect"): devolve o map original pela mesma referência', () => {
    const map = buildRoomMap()
    const polygonMap: MapData = { ...map, regions: [{ ...map.regions[0], room: { shape: 'polygon', name: 'Sala Circular' } }] }

    expect(resizeRoomDimensions(polygonMap, 'r1', 200, 50)).toBe(polygonMap)
  })
})

describe('MapScale/MeasurementMode (F2)', () => {
  it('setMapScale substitui a escala inteira', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const next = setMapScale(map, { unitsPerCell: 1.5, unit: 'm', precision: 1 })
    expect(next.scale).toEqual({ unitsPerCell: 1.5, unit: 'm', precision: 1 })
  })

  it('setMeasurementMode troca o modo', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setMeasurementMode(map, 'euclidean').measurementMode).toBe('euclidean')
  })
})
