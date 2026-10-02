import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { FALA_MAX_LETRAS } from './npcPatrol'
import { createEmptyMap } from './mapFactory'

/**
 * FALA DO NPC (passo "Falar" da patrulha): chega ao jogador junto com a ficha,
 * isto é, só quando ele a enxerga. A macro do ponto, que diz o que o guarda vai
 * falar e fazer, nunca sai.
 */
const gabi: Token = { id: 'gabi', characterId: null, name: 'Gabi', x: 100, y: 100, size: 1, image: null }

function guarda(x: number, extra: Partial<Token> = {}): Token {
  return {
    id: 'guarda',
    characterId: null,
    name: 'Guarda',
    x,
    y: 100,
    size: 1,
    image: null,
    npc: true,
    fala: 'Quem vem lá?',
    patrulha: { pontos: [{ x, y: 100, passos: [{ tipo: 'falar', texto: 'SEGREDO_DA_MACRO' }] }, { x: 400, y: 100 }], atual: 0 },
    ...extra,
  }
}

describe('filterMapForPlayer: a fala do NPC', () => {
  it('ficha na visão do jogador: a fala chega; a macro não', () => {
    const map = { ...createEmptyMap('m1', 'Pátio', 10, 10, 50), tokens: [gabi, guarda(150)] }
    const view = filterMapForPlayer(map, 'p1', { p1: ['gabi'] }, 700)
    expect(view.map.tokens.find((t) => t.id === 'guarda')?.fala).toBe('Quem vem lá?')
    expect(JSON.stringify(view)).not.toContain('SEGREDO_DA_MACRO')
  })

  it('ficha que o jogador não enxerga (oculta pelo mestre): nem a ficha nem a fala', () => {
    const map = { ...createEmptyMap('m1', 'Pátio', 10, 10, 50), tokens: [gabi, guarda(150, { hidden: true })] }
    const view = filterMapForPlayer(map, 'p1', { p1: ['gabi'] }, 700)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['gabi'])
    expect(JSON.stringify(view)).not.toContain('Quem vem lá?')
  })

  it('fala torta (não texto, vazia) não sai; longa sai cortada no teto', () => {
    const torta = filterMapForPlayer({ ...createEmptyMap('m1', 'P', 10, 10, 50), tokens: [gabi, guarda(150, { fala: 42 as unknown as string })] }, 'p1', { p1: ['gabi'] }, 700)
    expect(torta.map.tokens.find((t) => t.id === 'guarda')).not.toHaveProperty('fala')
    const vazia = filterMapForPlayer({ ...createEmptyMap('m1', 'P', 10, 10, 50), tokens: [gabi, guarda(150, { fala: '' })] }, 'p1', { p1: ['gabi'] }, 700)
    expect(vazia.map.tokens.find((t) => t.id === 'guarda')).not.toHaveProperty('fala')
    const longa = filterMapForPlayer({ ...createEmptyMap('m1', 'P', 10, 10, 50), tokens: [gabi, guarda(150, { fala: 'a'.repeat(500) })] }, 'p1', { p1: ['gabi'] }, 700)
    expect(longa.map.tokens.find((t) => t.id === 'guarda')?.fala).toHaveLength(FALA_MAX_LETRAS)
  })
})
