import { describe, expect, it } from 'vitest'
import { MAP_TYPES } from './mapTypes'

describe('MAP_TYPES', () => {
  it('tem exatamente 3 tipos', () => {
    expect(MAP_TYPES).toHaveLength(3)
  })

  it('só o Dungeon Map está disponível', () => {
    const available = MAP_TYPES.filter((t) => t.available)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('dungeon')
  })

  it('os dois indisponíveis têm selo "Em breve"', () => {
    const unavailable = MAP_TYPES.filter((t) => !t.available)
    expect(unavailable).toHaveLength(2)
    for (const type of unavailable) {
      expect(type.badge).toBe('Em breve')
    }
  })

  it('nomes em inglês, na ordem Dungeon → Isometric → World', () => {
    expect(MAP_TYPES.map((t) => t.name)).toEqual([
      'Dungeon Map',
      'Isometric Tactical Map',
      'World Map',
    ])
  })
})
