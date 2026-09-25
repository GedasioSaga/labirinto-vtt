/**
 * O recorte da lista de fichas livres (quem chega escolhe a própria ficha) e a
 * marca "Ficha de jogador", que é metadado do mestre e não viaja no mapa.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { claimableTokensForPlayer, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

function ficha(id: string, name: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 125, y: 125, size: 1, image: null, ...extra }
}

function mapa(tokens: Token[], hiddenLayers: MapData['hiddenLayers'] = []): MapData {
  return { ...createEmptyMap('m1', 'Cripta Rubra', 10, 10, 50), tokens, hiddenLayers }
}

describe('claimableTokensForPlayer', () => {
  it('só ficha marcada "Ficha de jogador", sem dono, não secreta nem escondida, em ordem de nome', () => {
    const m = mapa([
      ficha('t-z', 'Zora', { playerCharacter: true }),
      ficha('t-a', 'Ábaco', { playerCharacter: true }),
      ficha('t-orc', 'Orc'),
      ficha('t-falso', 'Falso', { playerCharacter: false }),
      ficha('t-sec', 'Secreta', { playerCharacter: true, secret: true }),
      ficha('t-hid', 'Escondida', { playerCharacter: true, hidden: true }),
      ficha('t-dono', 'Com Dono', { playerCharacter: true }),
    ])
    expect(claimableTokensForPlayer([m], new Set(['t-dono']))).toEqual([
      { tokenId: 't-a', name: 'Ábaco' },
      { tokenId: 't-z', name: 'Zora' },
    ])
  })

  it('ficha em camada oculta pelo mestre não entra', () => {
    const m = mapa([ficha('t-a', 'Ana', { playerCharacter: true })], ['tokens'])
    expect(claimableTokensForPlayer([m], new Set())).toEqual([])
  })

  it('a mesma ficha em duas cenas sai uma vez; sem cena nenhuma, lista vazia', () => {
    const m = mapa([ficha('t-a', 'Ana', { playerCharacter: true })])
    expect(claimableTokensForPlayer([m, m], new Set())).toEqual([{ tokenId: 't-a', name: 'Ana' }])
    expect(claimableTokensForPlayer([], new Set())).toEqual([])
  })
})

describe('filterMapForPlayer e a marca "Ficha de jogador"', () => {
  it('a ficha visível chega ao jogador SEM a marca', () => {
    const m = mapa([ficha('t-a', 'Ana', { playerCharacter: true }), ficha('t-b', 'Bia', { playerCharacter: true })])
    const view = filterMapForPlayer(m, 'p1', { p1: ['t-a'] }, 300)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['t-a', 't-b'])
    expect(view.map.tokens.some((t) => 'playerCharacter' in t)).toBe(false)
  })
})
