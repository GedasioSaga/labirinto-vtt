import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../types/map'
import { moveCrossesWall } from './collision'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { visionSegments } from './visibility'

/**
 * PAREDE INVISÍVEL (`Wall.hidden`): o jogador não vê nada mas bate nela. Três
 * garantias, cada uma num módulo: não chega ao jogador (`fogFilter`), segura a
 * visão (`visibility`) e segura o passo (`collision`).
 */
function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

const invisivel: Wall = { id: 'invisivel', x1: 500, y1: 0, x2: 500, y2: 1000, blocksLight: true, blocksMove: true, door: null, hidden: true }

function mapa(): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    walls: [invisivel],
    tokens: [token('heroi', 200, 200), token('espiao', 800, 200)],
  }
}

describe('parede invisível', () => {
  it('não chega ao jogador, mas esconde o que está atrás dela', () => {
    const { map } = filterMapForPlayer(mapa(), 'p1', { p1: ['heroi'] }, 700)
    expect(map.walls.map((w) => w.id)).not.toContain('invisivel')
    expect(map.tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('segura a visão como qualquer parede', () => {
    expect(visionSegments(mapa())).toContainEqual({ x1: 500, y1: 0, x2: 500, y2: 1000 })
  })

  it('segura o passo da ficha', () => {
    expect(moveCrossesWall({ x: 400, y: 200 }, { x: 600, y: 200 }, invisivel)).toBe(true)
  })
})
