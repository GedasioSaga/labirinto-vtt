/**
 * Recorte da TELA DA MESA (`filterMapForGroup`): a união do que um grupo de
 * fichas vê, cada ficha com o raio do SEU jogador. O raio maior do grupo não
 * pode valer para todos — senão o jogador de raio curto enxergaria na TV o
 * que a tela dele mesma esconde.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Token } from '../types/map'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

/** Campo aberto de 3000 x 500 px, sem parede. */
function campo(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-campo', 'Campo', 60, 10, 50), tokens }
}

describe('filterMapForGroup', () => {
  it('cada ficha enxerga com o raio do próprio jogador, nunca com o maior do grupo', () => {
    const map = campo([ficha('ana', 100, 250), ficha('bia', 2500, 250), ficha('lobo', 400, 250)])
    const view = filterMapForGroup(map, [
      { tokenIds: ['ana'], visionRadius: 100 },
      { tokenIds: ['bia'], visionRadius: 700 },
    ])
    // O lobo está a 300 px de Ana (raio 100) e a 2100 px de Bia (raio 700): ninguém o vê.
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['ana', 'bia'])
    expect(view.vision.length).toBe(2)

    const perto = filterMapForGroup(map, [
      { tokenIds: ['ana'], visionRadius: 400 },
      { tokenIds: ['bia'], visionRadius: 700 },
    ])
    expect(perto.map.tokens.map((t) => t.id).sort()).toEqual(['ana', 'bia', 'lobo'])
  })

  it('grupo vazio não vê nada dinâmico, e o nome da cena não sai', () => {
    const map = campo([ficha('lobo', 400, 250)])
    const view = filterMapForGroup(map, [])
    expect(view.map.tokens).toEqual([])
    expect(view.vision).toEqual([])
    expect(view.map.name).toBe('')
  })

  it('ficha escondida pelo mestre não enxerga nem aparece, mesmo sendo do grupo', () => {
    const map = campo([ficha('ana', 100, 250, { hidden: true }), ficha('lobo', 300, 250)])
    const view = filterMapForGroup(map, [{ tokenIds: ['ana'], visionRadius: 700 }])
    expect(view.map.tokens).toEqual([])
    expect(view.vision).toEqual([])
  })

  it('um jogador só (filterMapForPlayer) continua igual ao grupo de um', () => {
    const map = campo([ficha('ana', 100, 250), ficha('lobo', 400, 250), ficha('urso', 2000, 250)])
    const sozinho = filterMapForPlayer(map, 'p-ana', { 'p-ana': ['ana'] }, 500)
    const grupo = filterMapForGroup(map, [{ tokenIds: ['ana'], visionRadius: 500 }])
    expect(grupo).toEqual(sozinho)
  })
})
