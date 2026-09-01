import { describe, expect, it } from 'vitest'
import { findRoomCornerAt, MIN_ROOM_DIMENSION, resizeRoomCorner, resizeRoomDimensions, roomDimensions } from './roomOps'
import type { RegionPoint } from '../types/map'

// Sala retangular 100×80, mesma convenção de buildRoomFromDraft
// (lib/drawingFactory.ts): 0 topo-esq, 1 topo-dir, 2 baixo-dir, 3 baixo-esq.
function buildRectPoints(): RegionPoint[] {
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 80 },
    { x: 0, y: 80 },
  ]
}

describe('resizeRoomCorner', () => {
  it('arrasta o canto topo-direita (1): âncora é o canto oposto (3, baixo-esq), que fica fixo', () => {
    const points = buildRectPoints()
    const result = resizeRoomCorner(points, 1, 150, -20)

    expect(result).toEqual([
      { x: 0, y: -20 },
      { x: 150, y: -20 },
      { x: 150, y: 80 },
      { x: 0, y: 80 },
    ])
  })

  it('arrasta o canto topo-esquerda (0): âncora é o canto oposto (2, baixo-dir)', () => {
    const points = buildRectPoints()
    const result = resizeRoomCorner(points, 0, -30, -10)

    expect(result).toEqual([
      { x: -30, y: -10 },
      { x: 100, y: -10 },
      { x: 100, y: 80 },
      { x: -30, y: 80 },
    ])
  })

  it('cruzar a âncora inverte o retângulo em vez de produzir geometria inválida', () => {
    const points = buildRectPoints()
    // canto 1 (topo-dir) arrastado pra ALÉM da âncora (canto 3, em x=0,y=80) —
    // resultado ainda é um retângulo válido, só com os cantos "virados".
    const result = resizeRoomCorner(points, 1, -50, 200)

    expect(result).toEqual([
      { x: -50, y: 80 },
      { x: 0, y: 80 },
      { x: 0, y: 200 },
      { x: -50, y: 200 },
    ])
  })

  it('clampa em MIN_ROOM_DIMENSION quando o arrasto chega perto demais da âncora, sem inverter o lado', () => {
    const points = buildRectPoints()
    // âncora do canto 1 é o canto 3 (x=0,y=80). Arrasto pra (0.2, 79.8) —
    // do lado positivo em x (>= âncora) e negativo em y (< âncora), os dois
    // dentro da tolerância — cada eixo clampa pro seu próprio lado, sem
    // inverter (x nunca fica negativo, y nunca passa de 80).
    const result = resizeRoomCorner(points, 1, 0.2, 79.8)

    expect(result[1].x).toBe(MIN_ROOM_DIMENSION)
    expect(result[1].y).toBe(80 - MIN_ROOM_DIMENSION)
  })

  it('polígono que não tem 4 vértices (Sala Circular/Polígono) devolve os pontos sem mudança', () => {
    const points: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(resizeRoomCorner(points, 0, 999, 999)).toBe(points)
  })
})

describe('resizeRoomDimensions', () => {
  it('mantém points[0] (topo-esquerda) fixo e estica pra largura/altura pedidas', () => {
    const points = buildRectPoints()
    const result = resizeRoomDimensions(points, 200, 150)

    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 150 },
      { x: 0, y: 150 },
    ])
  })

  it('respeita a âncora mesmo quando points[0] não está na origem', () => {
    const points: RegionPoint[] = [
      { x: 40, y: 40 },
      { x: 140, y: 40 },
      { x: 140, y: 120 },
      { x: 40, y: 120 },
    ]
    const result = resizeRoomDimensions(points, 60, 30)

    expect(result).toEqual([
      { x: 40, y: 40 },
      { x: 100, y: 40 },
      { x: 100, y: 70 },
      { x: 40, y: 70 },
    ])
  })

  it('largura/altura zero ou negativa clampam em MIN_ROOM_DIMENSION — nunca produz sala degenerada', () => {
    const points = buildRectPoints()
    const result = resizeRoomDimensions(points, 0, -10)

    expect(result[1].x - result[0].x).toBe(MIN_ROOM_DIMENSION)
    expect(result[3].y - result[0].y).toBe(MIN_ROOM_DIMENSION)
  })

  it('polígono que não tem 4 vértices devolve os pontos sem mudança', () => {
    const points: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(resizeRoomDimensions(points, 500, 500)).toBe(points)
  })
})

describe('roomDimensions', () => {
  it('deriva largura/altura dos 4 vértices', () => {
    expect(roomDimensions(buildRectPoints())).toEqual({ width: 100, height: 80 })
  })

  it('polígono que não tem 4 vértices devolve {width: 0, height: 0}', () => {
    expect(roomDimensions([{ x: 0, y: 0 }])).toEqual({ width: 0, height: 0 })
  })
})

describe('findRoomCornerAt', () => {
  it('acerta um ponto dentro da tolerância de um canto', () => {
    const points = buildRectPoints()
    expect(findRoomCornerAt(points, { x: 102, y: -1 })).toBe(1)
  })

  it('não acerta um ponto longe de qualquer canto, mesmo dentro do retângulo', () => {
    const points = buildRectPoints()
    expect(findRoomCornerAt(points, { x: 50, y: 40 })).toBeNull()
  })

  it('polígono que não tem 4 vértices nunca acerta (Sala Circular/Polígono não tem alça de canto)', () => {
    const points: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(findRoomCornerAt(points, { x: 0, y: 0 })).toBeNull()
  })
})
