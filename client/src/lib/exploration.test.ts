import { describe, expect, it } from 'vitest'
import type { RegionPoint } from '../types/map'
import {
  countExploredCells,
  createExploration,
  decodeExploration,
  encodeExploration,
  forEachExploredRun,
  isPointExplored,
  isShapeExplored,
  markAll,
  markRings,
  MAX_EXPLORED_CELLS,
  ringTouchesRect,
} from './exploration'

function square(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

describe('markRings com zona oculta (A5)', () => {
  it('SEGURANÇA: célula que toca zona ativa nunca é marcada, mesmo inteira na visão', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 }) // célula 10
    const zone = square(100, 100, 200, 200)
    markRings(exp, [square(0, 0, 400, 400)], [zone])
    // Dentro, na borda de dentro e encostando por fora (célula 90..100 toca x=100): nada marcado.
    expect(isPointExplored(exp, { x: 150, y: 150 })).toBe(false)
    expect(isPointExplored(exp, { x: 105, y: 105 })).toBe(false)
    expect(isPointExplored(exp, { x: 95, y: 150 })).toBe(false)
    // Longe da zona continua marcado.
    expect(isPointExplored(exp, { x: 50, y: 50 })).toBe(true)
    expect(isPointExplored(exp, { x: 85, y: 150 })).toBe(true)
    expect(isPointExplored(exp, { x: 350, y: 350 })).toBe(true)
    // 40×40 células; a zona com a borda de 1 célula para cada lado ocupa 12×12.
    expect(countExploredCells(exp)).toBe(40 * 40 - 12 * 12)
  })

  it('sem zona, marca igual a antes', () => {
    const a = createExploration({ width: 400, height: 400, grid: 40 })
    const b = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(a, [square(0, 0, 400, 400)])
    markRings(b, [square(0, 0, 400, 400)], [])
    expect(Array.from(b.bits)).toEqual(Array.from(a.bits))
  })

  it('ringTouchesRect: cruza, contém, está contido e fica de fora', () => {
    expect(ringTouchesRect(square(0, 0, 100, 100), 90, 90, 110, 110)).toBe(true) // aresta cruza
    expect(ringTouchesRect(square(0, 0, 100, 100), 40, 40, 50, 50)).toBe(true) // retângulo dentro
    expect(ringTouchesRect(square(40, 40, 50, 50), 0, 0, 100, 100)).toBe(true) // polígono dentro
    expect(ringTouchesRect(square(0, 0, 100, 100), 101, 0, 120, 20)).toBe(false) // separado
  })
})

describe('markAll (B3, Revelar planta)', () => {
  it('marca todas as células, até as da borda do mapa', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markAll(exp)
    expect(countExploredCells(exp)).toBe(40 * 40)
  })

  it('SEGURANÇA: pula célula que toca zona ativa, igual ao markRings', () => {
    const viaAll = createExploration({ width: 400, height: 400, grid: 40 })
    const viaRings = createExploration({ width: 400, height: 400, grid: 40 })
    const zone = square(100, 100, 200, 200)
    markAll(viaAll, [zone])
    markRings(viaRings, [square(0, 0, 400, 400)], [zone])
    expect(isPointExplored(viaAll, { x: 150, y: 150 })).toBe(false)
    expect(Array.from(viaAll.bits)).toEqual(Array.from(viaRings.bits))
  })
})

describe('createExploration', () => {
  it('célula = grid/4, com mínimo de 8 px', () => {
    expect(createExploration({ width: 1000, height: 500, grid: 40 })).toMatchObject({ cell: 10, cols: 100, rows: 50 })
    expect(createExploration({ width: 100, height: 100, grid: 20 })).toMatchObject({ cell: 8, cols: 13, rows: 13 })
  })

  it('mapa gigante engrossa a célula para caber no teto de células', () => {
    const exp = createExploration({ width: 200_000, height: 200_000, grid: 40 })
    expect(exp.cols * exp.rows).toBeLessThanOrEqual(MAX_EXPLORED_CELLS)
    expect(exp.bits.length).toBe(Math.ceil((exp.cols * exp.rows) / 8))
  })

  it('começa sem nada explorado', () => {
    expect(countExploredCells(createExploration({ width: 400, height: 400, grid: 40 }))).toBe(0)
  })
})

describe('markRings', () => {
  it('marca só as células inteiras dentro do anel', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [square(100, 100, 200, 200)])
    expect(countExploredCells(exp)).toBe(100)
    expect(isPointExplored(exp, { x: 150, y: 150 })).toBe(true)
    expect(isPointExplored(exp, { x: 100, y: 100 })).toBe(true)
    expect(isPointExplored(exp, { x: 205, y: 150 })).toBe(false)
    expect(isPointExplored(exp, { x: 95, y: 150 })).toBe(false)
  })

  it('célula com centro dentro mas canto fora do anel não é marcada', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    // Anel de 104 a 196: as células das bordas (100-110 e 190-200) têm o centro dentro, mas não inteiras.
    markRings(exp, [square(104, 104, 196, 196)])
    expect(countExploredCells(exp)).toBe(64)
    expect(isPointExplored(exp, { x: 105, y: 150 })).toBe(false)
    expect(isPointExplored(exp, { x: 150, y: 195 })).toBe(false)
    expect(isPointExplored(exp, { x: 115, y: 150 })).toBe(true)
  })

  it('triângulo: célula cortada pela hipotenusa não é marcada', () => {
    const exp = createExploration({ width: 100, height: 100, grid: 40 })
    markRings(exp, [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }]])
    // Célula [40,50]x[40,50]: canto (50,50) está sobre a hipotenusa x+y=100, os demais dentro; (45,45) dentro.
    expect(isPointExplored(exp, { x: 45, y: 45 })).toBe(true)
    // Célula [50,60]x[40,50]: centro (55,45) dentro, canto (60,50) fora.
    expect(isPointExplored(exp, { x: 55, y: 45 })).toBe(false)
  })

  it('acumula anéis e ignora anel degenerado ou fora do mapa', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [square(0, 0, 50, 50), [{ x: 1, y: 1 }, { x: 2, y: 2 }]])
    markRings(exp, [square(500, 500, 550, 550), square(2000, 2000, 3000, 3000)])
    expect(countExploredCells(exp)).toBe(50)
    expect(isPointExplored(exp, { x: 25, y: 25 })).toBe(true)
    expect(isPointExplored(exp, { x: 525, y: 525 })).toBe(true)
  })

  it('polígono côncavo (L) não marca o vão', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    const ele = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ]
    markRings(exp, [ele])
    expect(isPointExplored(exp, { x: 25, y: 75 })).toBe(true)
    expect(isPointExplored(exp, { x: 75, y: 25 })).toBe(true)
    expect(isPointExplored(exp, { x: 75, y: 75 })).toBe(false)
  })
})

describe('isPointExplored / isShapeExplored', () => {
  it('fora do mapa ou coordenada não finita é falso', () => {
    const exp = createExploration({ width: 100, height: 100, grid: 40 })
    markRings(exp, [square(0, 0, 100, 100)])
    expect(isPointExplored(exp, { x: -1, y: 10 })).toBe(false)
    expect(isPointExplored(exp, { x: 10, y: 100 })).toBe(false)
    expect(isPointExplored(exp, { x: Number.NaN, y: 10 })).toBe(false)
  })

  it('forma explorada se algum ponto amostrado estiver explorado', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    markRings(exp, [square(0, 0, 100, 100)])
    expect(isShapeExplored(exp, [{ x: 900, y: 900 }, { x: 50, y: 50 }])).toBe(true)
    expect(isShapeExplored(exp, [{ x: 900, y: 900 }])).toBe(false)
    expect(isShapeExplored(exp, [])).toBe(false)
  })
})

describe('encode/decode', () => {
  it('ida e volta preserva células e dimensões', () => {
    const exp = createExploration({ width: 1234, height: 567, grid: 50 })
    markRings(exp, [square(13, 17, 400, 300), square(900, 100, 1200, 560)])
    const wire = encodeExploration(exp)
    const back = decodeExploration(JSON.parse(JSON.stringify(wire)))
    expect(back).not.toBeNull()
    expect(back).toMatchObject({ cell: exp.cell, cols: exp.cols, rows: exp.rows })
    expect(Array.from(back?.bits ?? [])).toEqual(Array.from(exp.bits))
    expect(countExploredCells(back ?? createExploration({ width: 1, height: 1, grid: 1 }))).toBe(countExploredCells(exp))
  })

  it('bitset grande (perto do teto) codifica sem estourar a pilha', () => {
    const exp = createExploration({ width: 8000, height: 8000, grid: 32 })
    markRings(exp, [square(0, 0, 8000, 8000)])
    const back = decodeExploration(encodeExploration(exp))
    expect(back?.bits.length).toBe(exp.bits.length)
    expect(countExploredCells(exp)).toBe(exp.cols * exp.rows)
  })

  const valid = encodeExploration(createExploration({ width: 80, height: 80, grid: 40 }))

  it.each([
    ['null', null],
    ['string', 'abc'],
    ['array', [valid]],
    ['cell zero', { ...valid, cell: 0 }],
    ['cell NaN', { ...valid, cell: Number.NaN }],
    ['cell string', { ...valid, cell: '10' }],
    ['cols fracionário', { ...valid, cols: 7.5 }],
    ['rows negativo', { ...valid, rows: -8 }],
    ['cols*rows acima do teto', { cell: 10, cols: 1001, rows: 1000, bits: 'A'.repeat(Math.ceil(125_125 / 3) * 4) }],
    ['bits ausente', { cell: valid.cell, cols: valid.cols, rows: valid.rows }],
    ['bits curto', { ...valid, bits: valid.bits.slice(4) }],
    ['bits longo', { ...valid, bits: `${valid.bits}AAAA` }],
    ['bits com caractere fora do base64', { ...valid, bits: `*${valid.bits.slice(1)}` }],
    ['bits com padding a mais', { ...valid, bits: `${valid.bits.slice(0, -3)}===` }],
  ])('rejeita payload corrompido: %s', (_label, wire) => {
    expect(decodeExploration(wire)).toBeNull()
  })
})

describe('forEachExploredRun', () => {
  it('agrupa células contíguas por linha, com colEnd exclusivo', () => {
    const exp = createExploration({ width: 80, height: 16, grid: 32 })
    // cell 8: 10 colunas × 2 linhas. Linha 0: cols 1-3 e 6-9; linha 1: nada.
    markRings(exp, [square(8, 0, 32, 8), square(48, 0, 80, 8)])
    const runs: [number, number, number][] = []
    forEachExploredRun(exp, (row, colStart, colEnd) => runs.push([row, colStart, colEnd]))
    expect(runs).toEqual([
      [0, 1, 4],
      [0, 6, 10],
    ])
  })
})
