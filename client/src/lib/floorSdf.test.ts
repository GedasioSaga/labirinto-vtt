import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { compileFloor, pieceBounds, pieceDistance, valueNoise } from './floorSdf'

function rect(id: string, cx: number, cy: number, w: number, h: number, extra: Partial<FloorPiece> = {}): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {}, ...extra }
}

describe('pieceDistance', () => {
  it('retângulo: negativo no centro, zero na borda, distância exata fora', () => {
    const piece = rect('r', 0, 0, 100, 40)
    expect(pieceDistance(piece, 0, 0)).toBeCloseTo(-20)
    expect(pieceDistance(piece, 50, 0)).toBeCloseTo(0)
    expect(pieceDistance(piece, 60, 0)).toBeCloseTo(10)
    expect(pieceDistance(piece, 53, 24)).toBeCloseTo(5)
  })

  it('rotação de 90° troca largura e altura', () => {
    const piece = rect('r', 0, 0, 100, 40, { rotation: 90 })
    expect(pieceDistance(piece, 0, 45)).toBeLessThan(0)
    expect(pieceDistance(piece, 45, 0)).toBeGreaterThan(0)
  })

  it('arredondamento de retângulo não muda o tamanho externo no meio do lado, só o canto', () => {
    const sharp = rect('r', 0, 0, 100, 100)
    const round = rect('r', 0, 0, 100, 100, { modifiers: { rounding: 20 } })
    expect(pieceDistance(round, 50, 0)).toBeCloseTo(pieceDistance(sharp, 50, 0))
    expect(pieceDistance(round, 49, 49)).toBeGreaterThan(0)
    expect(pieceDistance(sharp, 49, 49)).toBeLessThan(0)
  })

  it('elipse: dentro/fora corretos nos eixos', () => {
    const piece: FloorPiece = { id: 'e', shape: { kind: 'ellipse', cx: 10, cy: 10, rx: 50, ry: 20 }, op: 'add', modifiers: {} }
    expect(pieceDistance(piece, 10, 10)).toBeLessThan(0)
    expect(pieceDistance(piece, 59, 10)).toBeLessThan(0)
    expect(pieceDistance(piece, 61, 10)).toBeGreaterThan(0)
    expect(pieceDistance(piece, 10, 31)).toBeGreaterThan(0)
  })

  it('polígono regular: hexágono contém o centro e não contém ponto além do raio', () => {
    const piece: FloorPiece = { id: 'p', shape: { kind: 'polygon', cx: 0, cy: 0, radius: 30, sides: 6 }, op: 'add', modifiers: {} }
    expect(pieceDistance(piece, 0, 0)).toBeLessThan(0)
    expect(pieceDistance(piece, 0, -31)).toBeGreaterThan(0)
  })

  it('corredor: largura interpolada ao longo do segmento', () => {
    const piece: FloorPiece = {
      id: 'c',
      shape: { kind: 'corridor', points: [{ x: 0, y: 0, width: 10 }, { x: 100, y: 0, width: 30 }] },
      op: 'add',
      modifiers: {},
    }
    expect(pieceDistance(piece, 0, 4)).toBeLessThan(0)
    expect(pieceDistance(piece, 0, 6)).toBeGreaterThan(0)
    expect(pieceDistance(piece, 100, 14)).toBeLessThan(0)
    expect(pieceDistance(piece, 50, 9)).toBeLessThan(0)
    expect(pieceDistance(piece, 50, 11)).toBeGreaterThan(0)
  })

  it('engordar desloca a borda para fora e o retângulo envolvente cresce junto; emagrecer desloca para dentro', () => {
    const fat = rect('r', 0, 0, 100, 40, { modifiers: { grow: 3 } })
    expect(pieceDistance(fat, 52, 0)).toBeLessThan(0)
    expect(pieceBounds(fat).maxX).toBeCloseTo(53)
    const thin = rect('r', 0, 0, 100, 40, { modifiers: { grow: -3 } })
    expect(pieceDistance(thin, 48, 0)).toBeGreaterThan(0)
    expect(pieceBounds(thin).maxX).toBeCloseTo(50)
  })

  it('ruído é determinístico pela semente e limitado a [-1, 1]', () => {
    for (let i = 0; i < 200; i += 1) {
      const n = valueNoise(i * 0.37, i * 0.91, 42)
      expect(n).toBe(valueNoise(i * 0.37, i * 0.91, 42))
      expect(Math.abs(n)).toBeLessThanOrEqual(1)
    }
    expect(valueNoise(3.3, 4.4, 1)).not.toBe(valueNoise(3.3, 4.4, 2))
  })
})

describe('compileFloor', () => {
  it('subtrair abre buraco: ponto dentro do buraco fica fora do chão', () => {
    const floor = compileFloor([rect('a', 0, 0, 200, 200), { ...rect('b', 0, 0, 50, 50), op: 'subtract' }])
    expect(floor.sample(0, 0)).toBeGreaterThan(0)
    expect(floor.sample(60, 0)).toBeLessThan(0)
    expect(floor.bounds).toEqual({ minX: -100, minY: -100, maxX: 100, maxY: 100 })
  })

  it('ordem importa: soma depois da subtração tampa o buraco', () => {
    const floor = compileFloor([rect('a', 0, 0, 200, 200), { ...rect('b', 0, 0, 50, 50), op: 'subtract' }, rect('c', 0, 0, 10, 10)])
    expect(floor.sample(0, 0)).toBeLessThan(0)
  })

  it('peça oculta não conta; mapa sem peça "add" não tem bounds', () => {
    expect(compileFloor([rect('a', 0, 0, 10, 10, { hidden: true })]).bounds).toBeNull()
    expect(compileFloor([]).sample(0, 0)).toBe(Infinity)
  })

  it('descarte por retângulo nunca troca o sinal em relação à combinação sem descarte', () => {
    const pieces: FloorPiece[] = [
      rect('a', 0, 0, 300, 120, { rotation: 17, modifiers: { noise: { amplitude: 6, scale: 20, seed: 3 } } }),
      { id: 'e', shape: { kind: 'ellipse', cx: 150, cy: 40, rx: 60, ry: 30 }, op: 'add', modifiers: { rounding: 4 } },
      { ...rect('h', 20, 0, 40, 40, { rotation: 45 }), op: 'subtract' },
      { id: 'c', shape: { kind: 'corridor', points: [{ x: -150, y: 0, width: 12 }, { x: -260, y: 90, width: 30 }] }, op: 'add', modifiers: {} },
    ]
    const floor = compileFloor(pieces)
    const brute = (x: number, y: number) =>
      pieces.reduce((d, p) => (p.op === 'add' ? Math.min(d, pieceDistance(p, x, y)) : Math.max(d, -pieceDistance(p, x, y))), Infinity)
    for (let y = -150; y <= 150; y += 7) {
      for (let x = -300; x <= 250; x += 7) {
        expect(Math.sign(floor.sample(x, y))).toBe(Math.sign(brute(x, y)))
      }
    }
  })

  it('pieceBounds de retângulo girado 45° cresce para envolver a forma', () => {
    const b = pieceBounds(rect('r', 0, 0, 100, 100, { rotation: 45 }))
    expect(b.maxX).toBeCloseTo(Math.SQRT2 * 50)
  })
})
