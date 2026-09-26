/**
 * VEÍCULO COM LUGARES — o recorte do jogador. A lista de passageiros é do
 * mestre: ela contaria que há alguém no cesto mesmo quando a névoa, a zona
 * oculta ou o próprio mestre escondem essa ficha.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const JOGADOR = 'p-gui'

function ficha(id: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y: 300, size: 1, image: null, ...extra }
}

function cena(tokens: Token[]): MapData {
  return { ...createEmptyMap('a06', 'Poço', 40, 12, 50), tokens }
}

describe('recorte do jogador — veículo', () => {
  it('o cesto chega (está na visão), mas SEM o campo veiculo; e o espião secreto a bordo não chega nem pelo id', () => {
    const map = cena([
      ficha('cesto', 420, { npc: true, veiculo: { lugares: 3, passageiros: ['gui', 'espiao-secreto'] } }),
      ficha('gui', 400),
      ficha('espiao-secreto', 440, { secret: true }),
    ])
    const view = filterMapForPlayer(map, JOGADOR, { [JOGADOR]: ['gui'] }, 700)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['cesto', 'gui'])
    expect(view.map.tokens.every((t) => !('veiculo' in t))).toBe(true)
    expect(JSON.stringify(view)).not.toContain('espiao-secreto')
    expect(JSON.stringify(view)).not.toContain('passageiros')
  })

  it('nem o próprio jogador, dono do veículo, recebe a lista de quem está a bordo', () => {
    const map = cena([ficha('bote', 400, { veiculo: { lugares: 2, passageiros: ['vulto'] } }), ficha('vulto', 1800)])
    const view = filterMapForPlayer(map, JOGADOR, { [JOGADOR]: ['bote'] }, 300)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['bote'])
    expect('veiculo' in view.map.tokens[0]).toBe(false)
    expect(JSON.stringify(view)).not.toContain('vulto')
  })
})
