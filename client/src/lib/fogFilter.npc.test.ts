import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

describe('filterMapForPlayer: a marca de NPC é do mestre', () => {
  it('a ficha sai para o jogador sem o campo npc', () => {
    const mordomo: Token = { id: 'tok-mordomo', characterId: null, name: 'Mordomo', x: 100, y: 100, size: 1, image: null, npc: true }
    const map = { ...createEmptyMap('m1', 'Cozinha', 10, 10, 50), tokens: [mordomo] }
    // O jogador é dono do Mordomo: a ficha dele sai sempre, então o teste não depende da névoa.
    const view = filterMapForPlayer(map, 'p1', { p1: ['tok-mordomo'] }, 700)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['tok-mordomo'])
    expect('npc' in view.map.tokens[0]).toBe(false)
  })
})
