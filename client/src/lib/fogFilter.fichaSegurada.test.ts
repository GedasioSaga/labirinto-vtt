// @vitest-environment node
/**
 * FICHA SEGURADA PELO MESTRE no RECORTE DO JOGADOR. A trava (`Token.locked`)
 * só atravessa na ficha do PRÓPRIO jogador — é ela que acende o cadeado na
 * tela dele. Na ficha de outro (colega, NPC que o mestre segura) a trava fica
 * no mestre: diria quem ele está segurando. E ficha que o jogador não vê não
 * leva nada, trava inclusive.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../types/map'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Duas salas separadas por uma parede em x=500. `heroi` é do p1, `colega` do p2. */
function mesa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), walls: [parede('divisoria', 500, 0, 500, 1000)], tokens }
}

const DONOS = { p1: ['heroi'], p2: ['colega'] }
const RAIO = 700

function fichaNoRecorte(map: MapData, id: string): Token | undefined {
  return filterMapForPlayer(map, 'p1', DONOS, RAIO).map.tokens.find((t) => t.id === id)
}

describe('filterMapForPlayer — ficha segurada pelo mestre', () => {
  it('a PRÓPRIA ficha travada chega travada', () => {
    expect(fichaNoRecorte(mesa([ficha('heroi', 200, 200, { locked: true })]), 'heroi')?.locked).toBe(true)
  })

  it('a própria ficha solta chega sem trava', () => {
    const heroi = fichaNoRecorte(mesa([ficha('heroi', 200, 200, { locked: false })]), 'heroi')
    expect(heroi).toBeDefined()
    expect(heroi?.locked === true).toBe(false)
  })

  it('colega travado à vista: a ficha chega, a trava dele não', () => {
    const colega = fichaNoRecorte(mesa([ficha('heroi', 200, 200), ficha('colega', 300, 200, { locked: true })]), 'colega')
    expect(colega?.id).toBe('colega')
    expect(colega !== undefined && 'locked' in colega).toBe(false)
  })

  it('NPC que o mestre segura à vista: a ficha chega, a trava não', () => {
    const guarda = fichaNoRecorte(mesa([ficha('heroi', 200, 200), ficha('guarda', 300, 250, { locked: true })]), 'guarda')
    expect(guarda?.id).toBe('guarda')
    expect(guarda !== undefined && 'locked' in guarda).toBe(false)
  })

  it('ficha travada atrás da parede não chega de jeito nenhum', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('espiao', 800, 200, { locked: true })]), 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(out)).not.toContain('espiao')
  })

  it('tela da mesa: as fichas do grupo levam a trava; o NPC seguro, não', () => {
    const map = mesa([ficha('heroi', 200, 200, { locked: true }), ficha('guarda', 300, 250, { locked: true })])
    const tokens = filterMapForGroup(map, [{ tokenIds: ['heroi'], visionRadius: RAIO }]).map.tokens
    expect(tokens.find((t) => t.id === 'heroi')?.locked).toBe(true)
    const guarda = tokens.find((t) => t.id === 'guarda')
    expect(guarda?.id).toBe('guarda')
    expect(guarda !== undefined && 'locked' in guarda).toBe(false)
  })
})
