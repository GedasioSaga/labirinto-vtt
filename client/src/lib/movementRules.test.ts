import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { measureCells } from './measurement'
import { clampToMaxStep, findOccupant, MAX_STEP_CELLS_LIMIT, maxStepOf, reachOutline, readMovementRules, tokensOccupy } from './movementRules'

const GRID = 50

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function docas(patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('docas', 'Docas', 60, 20, GRID), movement: { maxStepCells: 6 }, ...patch }
}

const cells = (map: MapData, a: { x: number; y: number }, b: { x: number; y: number }) =>
  measureCells(a, b, map.grid, map.gridShape, map.measurementMode)

describe('readMovementRules', () => {
  it('ausente, nulo ou lixo volta ausente (movimento livre)', () => {
    expect(readMovementRules(undefined)).toBeUndefined()
    expect(readMovementRules(null)).toBeUndefined()
    expect(readMovementRules('6')).toBeUndefined()
    expect(readMovementRules({})).toBeUndefined()
    expect(readMovementRules({ maxStepCells: 'seis', tokensOccupy: 'sim' })).toBeUndefined()
  })

  it('guarda passo inteiro positivo e ocupação só quando true', () => {
    expect(readMovementRules({ maxStepCells: 6 })).toEqual({ maxStepCells: 6 })
    expect(readMovementRules({ tokensOccupy: true })).toEqual({ tokensOccupy: true })
    expect(readMovementRules({ maxStepCells: 6, tokensOccupy: false })).toEqual({ maxStepCells: 6 })
  })

  it('passo zero, negativo, NaN ou fracionário não vira regra; acima do teto é cortado', () => {
    expect(readMovementRules({ maxStepCells: 0 })).toBeUndefined()
    expect(readMovementRules({ maxStepCells: -3 })).toBeUndefined()
    expect(readMovementRules({ maxStepCells: Number.NaN })).toBeUndefined()
    expect(readMovementRules({ maxStepCells: 2.5 })).toEqual({ maxStepCells: 2 })
    expect(readMovementRules({ maxStepCells: 10_000 })).toEqual({ maxStepCells: MAX_STEP_CELLS_LIMIT })
  })
})

describe('maxStepOf / tokensOccupy', () => {
  it('mapa sem regras é livre', () => {
    const livre = createEmptyMap('m', 'Mercado', 10, 10, GRID)
    expect(maxStepOf(livre)).toBeNull()
    expect(tokensOccupy(livre)).toBe(false)
  })

  it('lê as regras da cena', () => {
    expect(maxStepOf(docas())).toBe(6)
    expect(tokensOccupy(docas({ movement: { tokensOccupy: true } }))).toBe(true)
  })
})

describe('clampToMaxStep', () => {
  it('Passo 6 nas Docas: arrastar 30 casas para na sexta', () => {
    const map = docas()
    const from = { x: 125, y: 125 }
    const to = { x: 125 + 30 * GRID, y: 125 }
    expect(clampToMaxStep(map, from, to)).toEqual({ x: 125 + 6 * GRID, y: 125 })
  })

  it('Mercado sem passo máximo: o destino passa intacto', () => {
    const mercado = createEmptyMap('mercado', 'Mercado', 60, 20, GRID)
    const to = { x: 125 + 30 * GRID, y: 125 }
    expect(clampToMaxStep(mercado, { x: 125, y: 125 }, to)).toBe(to)
  })

  it('dentro do alcance o destino passa intacto', () => {
    const to = { x: 125 + 4 * GRID, y: 125 + 2 * GRID }
    expect(clampToMaxStep(docas(), { x: 125, y: 125 }, to)).toBe(to)
  })

  it('em diagonal para no alcance da régua da cena, com coordenada inteira', () => {
    for (const measurementMode of ['chessboard', 'alternating', 'euclidean', 'manhattan'] as const) {
      const map = docas({ measurementMode })
      const from = { x: 125, y: 125 }
      const at = clampToMaxStep(map, from, { x: 125 + 17 * GRID, y: 125 + 11 * GRID })
      expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true)
      expect(cells(map, from, at)).toBeLessThanOrEqual(6 + 1e-6)
      // Para no ÚLTIMO ponto válido, não antes: fica a menos de um quadrado do limite.
      expect(cells(map, from, at)).toBeGreaterThan(5)
    }
  })
})

describe('reachOutline', () => {
  it('sem passo máximo não há contorno de alcance', () => {
    expect(reachOutline(createEmptyMap('m', 'M', 10, 10, GRID), { x: 0, y: 0 })).toBeNull()
  })

  it('euclidiana desenha um círculo de 6 quadrados em volta da ficha', () => {
    const map = docas({ measurementMode: 'euclidean' })
    const from = { x: 500, y: 500 }
    const outline = reachOutline(map, from)
    expect(outline).not.toBeNull()
    for (const p of outline ?? []) expect(Math.hypot(p.x - from.x, p.y - from.y) / GRID).toBeCloseTo(6, 3)
  })

  it('tabuleiro desenha o quadrado que a régua conta, sem mentir nos cantos', () => {
    const map = docas({ measurementMode: 'chessboard' })
    const from = { x: 500, y: 500 }
    for (const p of reachOutline(map, from) ?? []) expect(cells(map, from, p)).toBeCloseTo(6, 3)
  })
})

describe('findOccupant', () => {
  const guarda = token('guarda', 325, 125)
  const tokens = [token('heroi', 125, 125), guarda]

  it('soltar sobre o guarda acha o guarda', () => {
    expect(findOccupant(tokens, 'heroi', { x: 325, y: 125 }, GRID)).toBe(guarda)
    expect(findOccupant(tokens, 'heroi', { x: 335, y: 118 }, GRID)).toBe(guarda)
  })

  it('casa vizinha não está ocupada', () => {
    expect(findOccupant(tokens, 'heroi', { x: 275, y: 125 }, GRID)).toBeUndefined()
    expect(findOccupant(tokens, 'heroi', { x: 325, y: 175 }, GRID)).toBeUndefined()
  })

  it('a própria ficha não ocupa o lugar dela', () => {
    expect(findOccupant(tokens, 'heroi', { x: 130, y: 125 }, GRID)).toBeUndefined()
  })

  it('ficha grande ocupa as casas dela', () => {
    const ogro = token('ogro', 400, 400, { size: 2 })
    expect(findOccupant([ogro], 'heroi', { x: 425, y: 425 }, GRID)).toBe(ogro)
    expect(findOccupant([ogro], 'heroi', { x: 475, y: 425 }, GRID)).toBeUndefined()
  })
})
