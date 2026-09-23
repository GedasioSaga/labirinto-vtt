import { describe, expect, it } from 'vitest'
import {
  MEASUREMENT_MODE_LABELS,
  measurementModesForShape,
  defaultMeasurementModeForShape,
  measureCells,
  measureDistance,
} from './measurement'
import { axialToPixel } from '../pixi/hexGrid'
import type { MapScale } from '../types/map'

const GRID = 10
const SCALE_5FT: MapScale = { unitsPerCell: 5, unit: 'ft', precision: 0 }

describe('measurementModesForShape / defaultMeasurementModeForShape', () => {
  it('grade quadrada oferece os 4 modos, chessboard primeiro', () => {
    expect(measurementModesForShape('square')).toEqual(['chessboard', 'alternating', 'euclidean', 'manhattan'])
    expect(defaultMeasurementModeForShape('square')).toBe('chessboard')
  })

  it('grade hex oferece só hex + euclidean, hex primeiro', () => {
    expect(measurementModesForShape('hex')).toEqual(['hex', 'euclidean'])
    expect(defaultMeasurementModeForShape('hex')).toBe('hex')
  })

  it('todo MeasurementMode tem rótulo em MEASUREMENT_MODE_LABELS', () => {
    const modes = [...measurementModesForShape('square'), ...measurementModesForShape('hex')]
    for (const mode of modes) {
      expect(MEASUREMENT_MODE_LABELS[mode]).toBeTruthy()
    }
  })

  // F3 (grid-triangular, contrato C6): antes desta fase, 'triangle' caía no
  // ramo `else` de quadrado (chessboard/alternating/manhattan) — nenhum dos
  // três é coerente com uma malha de triângulos, então a régua mentiria.
  it('grade triangular oferece só euclidean (sem "tabuleiro" equivalente pra malha triangular)', () => {
    expect(measurementModesForShape('triangle')).toEqual(['euclidean'])
    expect(defaultMeasurementModeForShape('triangle')).toBe('euclidean')
  })
})

describe('measureCells — grade quadrada', () => {
  it('chessboard: distância de Chebyshev, diagonal custa igual reto', () => {
    // 3 células em x, 1 em y — o maior eixo domina.
    const cells = measureCells({ x: 0, y: 0 }, { x: 30, y: 10 }, GRID, 'square', 'chessboard')
    expect(cells).toBe(3)
  })

  it('alternating: (3,3) células dá 4 (regra 5-10-5 do 3.5e: 5+10+5=20ft=4 células)', () => {
    const cells = measureCells({ x: 0, y: 0 }, { x: 30, y: 30 }, GRID, 'square', 'alternating')
    expect(cells).toBe(4)
  })

  it('alternating: puramente reto (dy=0) não ganha bônus de diagonal', () => {
    const cells = measureCells({ x: 0, y: 0 }, { x: 50, y: 0 }, GRID, 'square', 'alternating')
    expect(cells).toBe(5)
  })

  it('manhattan: soma os dois eixos, sem diagonal', () => {
    const cells = measureCells({ x: 0, y: 0 }, { x: 30, y: 40 }, GRID, 'square', 'manhattan')
    expect(cells).toBe(7)
  })

  it('euclidean: 3-4-5 clássico', () => {
    const cells = measureCells({ x: 0, y: 0 }, { x: 30, y: 40 }, GRID, 'square', 'euclidean')
    expect(cells).toBe(5)
  })

  it('euclidean também vale em grade hex (modo não é exclusivo de formato)', () => {
    const square = measureCells({ x: 0, y: 0 }, { x: 30, y: 40 }, GRID, 'square', 'euclidean')
    const hex = measureCells({ x: 0, y: 0 }, { x: 30, y: 40 }, GRID, 'hex', 'euclidean')
    expect(hex).toBe(square)
  })
})

describe('measureCells — grade hex', () => {
  it('centro de dois hexágonos vizinhos (distância axial 1) dá 1 célula', () => {
    const start = axialToPixel({ q: 0, r: 0 }, GRID)
    const end = axialToPixel({ q: 1, r: 0 }, GRID)
    expect(measureCells(start, end, GRID, 'hex', 'hex')).toBeCloseTo(1, 6)
  })

  it('reusa a mesma malha de pixelToAxialRaw — distância axial 2 dá 2 células', () => {
    const start = axialToPixel({ q: 0, r: 0 }, GRID)
    const end = axialToPixel({ q: 2, r: -1 }, GRID)
    // distância cúbica: (|2| + |2-1| + |-1|) / 2 = (2+1+1)/2 = 2
    expect(measureCells(start, end, GRID, 'hex', 'hex')).toBeCloseTo(2, 6)
  })

  it('mesmo ponto dá distância 0', () => {
    const p = axialToPixel({ q: 3, r: -2 }, GRID)
    expect(measureCells(p, p, GRID, 'hex', 'hex')).toBe(0)
  })
})

describe('measureCells — grid inválido', () => {
  it('gridSize <= 0 devolve 0 em vez de Infinity/NaN', () => {
    expect(measureCells({ x: 0, y: 0 }, { x: 100, y: 100 }, 0, 'square', 'chessboard')).toBe(0)
    expect(measureCells({ x: 0, y: 0 }, { x: 100, y: 100 }, -5, 'hex', 'hex')).toBe(0)
  })
})

describe('measureDistance — pipeline célula → unidade → rótulo', () => {
  it('escala 5ft/célula, precisão 0: "15 ft"', () => {
    const result = measureDistance({ x: 0, y: 0 }, { x: 30, y: 10 }, GRID, 'square', 'chessboard', SCALE_5FT)
    expect(result.cells).toBe(3)
    expect(result.units).toBe(15)
    expect(result.label).toBe('15 ft')
  })

  it('escala métrica com casa decimal usa vírgula: "7,5 m"', () => {
    const scale: MapScale = { unitsPerCell: 1.5, unit: 'm', precision: 1 }
    // 5 células euclidianas (3-4-5) * 1.5 = 7.5
    const result = measureDistance({ x: 0, y: 0 }, { x: 30, y: 40 }, GRID, 'square', 'euclidean', scale)
    expect(result.units).toBe(7.5)
    expect(result.label).toBe('7,5 m')
  })

  it('padrão do mapa novo: 1 célula = "1,5 m"; inteiro mantém a casa fixa ("3,0 m")', () => {
    const scale: MapScale = { unitsPerCell: 1.5, unit: 'm', precision: 1 }
    expect(measureDistance({ x: 0, y: 0 }, { x: GRID, y: 0 }, GRID, 'square', 'chessboard', scale).label).toBe('1,5 m')
    expect(measureDistance({ x: 0, y: 0 }, { x: 2 * GRID, y: 0 }, GRID, 'square', 'chessboard', scale).label).toBe('3,0 m')
  })

  it('milhar não ganha separador (rótulo curto na régua): "1500 ft"', () => {
    const result = measureDistance({ x: 0, y: 0 }, { x: 300 * GRID, y: 0 }, GRID, 'square', 'chessboard', SCALE_5FT)
    expect(result.label).toBe('1500 ft')
  })

  it('precisão negativa é tratada como 0 (nunca quebra o rótulo)', () => {
    const scale: MapScale = { unitsPerCell: 5, unit: 'ft', precision: -2 }
    const result = measureDistance({ x: 0, y: 0 }, { x: 30, y: 10 }, GRID, 'square', 'chessboard', scale)
    expect(result.label).toBe('15 ft')
  })

  it('unidade vazia não deixa espaço sobrando no rótulo', () => {
    const scale: MapScale = { unitsPerCell: 5, unit: '', precision: 0 }
    const result = measureDistance({ x: 0, y: 0 }, { x: 30, y: 10 }, GRID, 'square', 'chessboard', scale)
    expect(result.label).toBe('15')
  })
})

// Casas decimais vêm de campo numérico livre (MapScaleControls) e de mapa salvo
// em disco (mapFile.ts repassa `parsed.scale` cru). Fora de 0..100, ou ausente,
// o rótulo quebrava ou mostrava "NaN" a cada pointermove da régua.
describe('measureDistance — casas decimais fora do intervalo', () => {
  const start = { x: 0, y: 0 }
  const end = { x: 30, y: 10 }

  it('muitas casas decimais (500) não lança e limita a 3 casas', () => {
    const scale: MapScale = { unitsPerCell: 5, unit: 'ft', precision: 500 }
    const measure = () => measureDistance(start, end, GRID, 'square', 'chessboard', scale)
    expect(measure).not.toThrow()
    expect(measure().label).toBe('15,000 ft')
  })

  it('precisão ausente (mapa salvo sem o campo) cai em 0 casas, sem "NaN"', () => {
    // JSON.parse devolve `any`: simula de propósito o `scale` cru lido de arquivo sem `precision`.
    const scale: MapScale = JSON.parse('{"unitsPerCell":5,"unit":"ft"}')
    const result = measureDistance(start, end, GRID, 'square', 'chessboard', scale)
    expect(result.label).toBe('15 ft')
    expect(result.units).toBe(15)
  })

  it('precisão fracionária é arredondada para inteiro', () => {
    const scale: MapScale = { unitsPerCell: 1.5, unit: 'm', precision: 1.4 }
    const result = measureDistance(start, { x: 25, y: 0 }, GRID, 'square', 'chessboard', scale)
    expect(result.label).toBe('3,8 m')
  })

  it('precisão NaN/Infinity não lança e cai em 0 casas', () => {
    for (const precision of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const scale: MapScale = { unitsPerCell: 5, unit: 'ft', precision }
      expect(measureDistance(start, end, GRID, 'square', 'chessboard', scale).label).toBe('15 ft')
    }
  })
})
