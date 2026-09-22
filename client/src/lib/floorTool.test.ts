import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { pieceDistance } from './floorSdf'
import {
  buildCorridorShape,
  buildFloorPiece,
  buildFloorShapeFromDrag,
  clampFloorPolygonSides,
  findFloorPieceAt,
  MIN_FLOOR_DRAG_SIZE,
  pincelDeBlocosApaga,
} from './floorTool'

describe('buildFloorShapeFromDrag — retângulo', () => {
  it('canto a canto, em qualquer direção, dá o mesmo centro e tamanho', () => {
    const a = buildFloorShapeFromDrag('rect', { x: 100, y: 50 }, { x: 300, y: 200 }, 6)
    const b = buildFloorShapeFromDrag('rect', { x: 300, y: 200 }, { x: 100, y: 50 }, 6)
    expect(a).toEqual({ shape: { kind: 'rect', cx: 200, cy: 125, w: 200, h: 150 }, rotation: 0 })
    expect(b).toEqual(a)
  })

  it('clique parado não vira peça', () => {
    expect(buildFloorShapeFromDrag('rect', { x: 10, y: 10 }, { x: 10, y: 10 }, 6)).toBeNull()
  })

  it('arrasto só num eixo (altura 0) também é degenerado', () => {
    expect(buildFloorShapeFromDrag('rect', { x: 0, y: 0 }, { x: 200, y: 0 }, 6)).toBeNull()
    expect(buildFloorShapeFromDrag('rect', { x: 0, y: 0 }, { x: 200, y: MIN_FLOOR_DRAG_SIZE - 0.5 }, 6)).toBeNull()
  })
})

describe('buildFloorShapeFromDrag — elipse', () => {
  it('centro no início, raios pela distância em cada eixo', () => {
    expect(buildFloorShapeFromDrag('ellipse', { x: 100, y: 100 }, { x: 40, y: 130 }, 6)).toEqual({
      shape: { kind: 'ellipse', cx: 100, cy: 100, rx: 60, ry: 30 },
      rotation: 0,
    })
  })

  it('raio zero num eixo é degenerado', () => {
    expect(buildFloorShapeFromDrag('ellipse', { x: 0, y: 0 }, { x: 50, y: 0 }, 6)).toBeNull()
  })
})

describe('buildFloorShapeFromDrag — polígono regular', () => {
  it('raio = distância, e o primeiro vértice cai exatamente sob o cursor', () => {
    const result = buildFloorShapeFromDrag('polygon', { x: 200, y: 200 }, { x: 300, y: 200 }, 5)
    expect(result).not.toBeNull()
    if (!result) return
    expect(result.shape).toEqual({ kind: 'polygon', cx: 200, cy: 200, radius: 100, sides: 5 })
    // Vértice fica NA borda (distância ~0); um ponto logo além dele fica fora.
    const piece = buildFloorPiece('p', result.shape, 'add', result.rotation)
    expect(Math.abs(pieceDistance(piece, 300, 200))).toBeLessThan(0.01)
    expect(pieceDistance(piece, 305, 200)).toBeGreaterThan(0)
  })

  it('lados fora de 3..12 são limitados', () => {
    expect(clampFloorPolygonSides(1)).toBe(3)
    expect(clampFloorPolygonSides(40)).toBe(12)
    expect(clampFloorPolygonSides(6.4)).toBe(6)
  })

  it('clique parado não vira peça', () => {
    expect(buildFloorShapeFromDrag('polygon', { x: 5, y: 5 }, { x: 5, y: 6 }, 6)).toBeNull()
  })
})

describe('buildCorridorShape', () => {
  it('descarta ponto repetido do duplo clique e aplica a largura em todos', () => {
    const shape = buildCorridorShape([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 100, y: 80 }], 32)
    expect(shape).toEqual({
      kind: 'corridor',
      points: [
        { x: 0, y: 0, width: 32 },
        { x: 100, y: 0, width: 32 },
        { x: 100, y: 80, width: 32 },
      ],
    })
  })

  it('menos de 2 pontos distintos (ou largura inválida) não é corredor', () => {
    expect(buildCorridorShape([], 32)).toBeNull()
    expect(buildCorridorShape([{ x: 1, y: 1 }, { x: 1, y: 1 }], 32)).toBeNull()
    expect(buildCorridorShape([{ x: 0, y: 0 }, { x: 9, y: 9 }], 0)).toBeNull()
    expect(buildCorridorShape([{ x: 0, y: 0 }, { x: 9, y: 9 }], Number.NaN)).toBeNull()
  })
})

describe('buildFloorPiece', () => {
  it('não grava rotation quando é 0', () => {
    const shape = { kind: 'rect' as const, cx: 0, cy: 0, w: 10, h: 10 }
    expect(buildFloorPiece('a', shape, 'add')).toEqual({ id: 'a', shape, op: 'add', modifiers: {} })
    expect(buildFloorPiece('b', shape, 'subtract', 45)).toEqual({ id: 'b', shape, op: 'subtract', rotation: 45, modifiers: {} })
  })
})

describe('findFloorPieceAt', () => {
  const big: FloorPiece = { id: 'big', shape: { kind: 'rect', cx: 200, cy: 200, w: 200, h: 200 }, op: 'add', modifiers: {} }
  const hole: FloorPiece = { id: 'hole', shape: { kind: 'rect', cx: 200, cy: 200, w: 40, h: 40 }, op: 'subtract', modifiers: {} }
  const base = { floor: [big, hole], hiddenLayers: [], lockedLayers: [] }

  it('dentro do buraco acha a peça subtrativa (a mais recente que contém o ponto)', () => {
    expect(findFloorPieceAt(base, { x: 200, y: 200 })?.id).toBe('hole')
  })

  it('fora do buraco mas dentro do retângulo grande acha a peça somada', () => {
    expect(findFloorPieceAt(base, { x: 120, y: 120 })?.id).toBe('big')
  })

  it('fora de tudo não acha nada', () => {
    expect(findFloorPieceAt(base, { x: 5, y: 5 })).toBeNull()
  })

  it('peça hidden ou locked é pulada — o clique cai na peça de baixo', () => {
    expect(findFloorPieceAt({ ...base, floor: [big, { ...hole, hidden: true }] }, { x: 200, y: 200 })?.id).toBe('big')
    expect(findFloorPieceAt({ ...base, floor: [big, { ...hole, locked: true }] }, { x: 200, y: 200 })?.id).toBe('big')
  })

  it('camada "salas" oculta ou travada não deixa selecionar peça nenhuma', () => {
    expect(findFloorPieceAt({ ...base, hiddenLayers: ['salas'] }, { x: 120, y: 120 })).toBeNull()
    expect(findFloorPieceAt({ ...base, lockedLayers: ['salas'] }, { x: 120, y: 120 })).toBeNull()
  })

  it('outra camada oculta não interfere', () => {
    expect(findFloorPieceAt({ ...base, hiddenLayers: ['tokens'] }, { x: 120, y: 120 })?.id).toBe('big')
  })
})

describe('pincelDeBlocosApaga — operação + botão decidem pintar ou apagar', () => {
  const ESQUERDO = 0
  const DIREITO = 2

  it('Somar com o botão esquerdo pinta', () => {
    expect(pincelDeBlocosApaga('add', ESQUERDO)).toBe(false)
  })

  it('Subtrair com o botão esquerdo apaga (achado 8: antes pintava igual a Somar)', () => {
    expect(pincelDeBlocosApaga('subtract', ESQUERDO)).toBe(true)
  })

  it('o botão direito apaga em qualquer operação', () => {
    expect(pincelDeBlocosApaga('add', DIREITO)).toBe(true)
    expect(pincelDeBlocosApaga('subtract', DIREITO)).toBe(true)
  })
})
