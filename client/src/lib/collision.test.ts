import { describe, expect, it } from 'vitest'
import { segmentsIntersect, moveCrossesWall, resolveTokenMove } from './collision'
import type { Wall } from '../types/map'

describe('segmentsIntersect', () => {
  it('detecta cruzamento em X', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true)
  })

  it('segmentos paralelos sem toque não cruzam', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false)
  })

  it('T-junction (endpoint sobre o outro segmento) conta como cruzamento', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 0 }),
    ).toBe(true)
  })
})

const blockingWall: Wall = { id: 'w1', x1: 5, y1: -10, x2: 5, y2: 10, blocksLight: true, blocksMove: true, door: null }
const decorativeWall: Wall = { ...blockingWall, id: 'w2', blocksMove: false }

describe('moveCrossesWall', () => {
  it('true quando movimento cruza parede bloqueante', () => {
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 10, y: 0 }, blockingWall)).toBe(true)
  })

  it('false quando a parede não bloqueia movimento, mesmo cruzando geometricamente', () => {
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 10, y: 0 }, decorativeWall)).toBe(false)
  })

  it('false quando o movimento não cruza a parede', () => {
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 4, y: 0 }, blockingWall)).toBe(false)
  })
})

describe('resolveTokenMove', () => {
  it('rejeita movimento que cruza parede bloqueante, mantém posição original', () => {
    const result = resolveTokenMove({ x: 0, y: 0 }, { x: 10, y: 0 }, [blockingWall])
    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('aceita movimento que não cruza nenhuma parede', () => {
    const result = resolveTokenMove({ x: 0, y: 0 }, { x: 4, y: 0 }, [blockingWall])
    expect(result).toEqual({ x: 4, y: 0 })
  })

  it('aceita movimento cruzando parede decorativa (blocksMove: false)', () => {
    const result = resolveTokenMove({ x: 0, y: 0 }, { x: 10, y: 0 }, [decorativeWall])
    expect(result).toEqual({ x: 10, y: 0 })
  })
})
