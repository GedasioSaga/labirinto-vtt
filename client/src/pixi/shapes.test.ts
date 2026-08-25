import { describe, expect, it } from 'vitest'
import { wallLength, isDegenerateRegion } from './shapes'
import type { Wall, RegionPoint } from '../types/map'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 3, y2: 4, blocksLight: true, blocksMove: true, door: null }

describe('wallLength', () => {
  it('calcula distância euclidiana', () => {
    expect(wallLength(wall)).toBe(5)
  })
})

describe('isDegenerateRegion', () => {
  it('menos de 3 pontos é degenerada', () => {
    const points: RegionPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    expect(isDegenerateRegion(points)).toBe(true)
  })

  it('3 ou mais pontos não é degenerada', () => {
    const points: RegionPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]
    expect(isDegenerateRegion(points)).toBe(false)
  })
})
