import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Token } from '../types/map'
import { hostPlayerChanges } from './playerChanges'
import { parsePlayerMessage } from './protocol'

/**
 * PISOS NA MESMA CENA — o fio e a aplicação: a mensagem `token.piso` do
 * jogador (só ids, validados) e a troca de piso no mapa do mestre, fora do
 * Ctrl+Z dele, como o movimento.
 */
const heroi: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }
const LIGHT = { id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 }

function sampleMap(): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), tokens: [heroi] }
}

function tokenIn(map: MapData): Token {
  const found = map.tokens.find((t) => t.id === 'heroi')
  if (found === undefined) throw new Error('herói sumiu do mapa')
  return found
}

beforeEach(() => {
  useMapStore.getState().loadMap(sampleMap())
  useAdventureStore.setState({ cache: {}, dirty: {} })
})

describe('token.piso no fio', () => {
  it('aceita só os dois ids, e joga fora o resto (o jogador não escolhe o piso)', () => {
    expect(parsePlayerMessage({ type: 'token.piso', tokenId: 'heroi', stairId: 'escada', piso: 99 })).toEqual({ type: 'token.piso', tokenId: 'heroi', stairId: 'escada' })
  })

  it('id faltando, vazio ou que não é texto: mensagem inválida', () => {
    expect(parsePlayerMessage({ type: 'token.piso', tokenId: 'heroi' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.piso', tokenId: '', stairId: 'escada' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.piso', tokenId: 7, stairId: 'escada' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.piso', tokenId: 'heroi', stairId: 'x'.repeat(500) })).toBeNull()
  })
})

describe('troca de piso no mapa do mestre', () => {
  it('a ficha muda de piso, e o Ctrl+Z desfaz a luz do mestre, não o piso', () => {
    useMapStore.getState().addLight(LIGHT)
    hostPlayerChanges.applyPiso({ tokenId: 'heroi', piso: 2 })
    expect(tokenIn(useMapStore.getState().map)).toMatchObject({ piso: 2, x: 200, y: 200 })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.lights).toHaveLength(0)
    expect(tokenIn(useMapStore.getState().map).piso).toBe(2)
  })

  it('voltar ao térreo tira o campo, e ficha que não existe não muda nada', () => {
    hostPlayerChanges.applyPiso({ tokenId: 'heroi', piso: 1 })
    hostPlayerChanges.applyPiso({ tokenId: 'heroi', piso: 0 })
    expect('piso' in tokenIn(useMapStore.getState().map)).toBe(false)
    const antes = useMapStore.getState().map
    hostPlayerChanges.applyPiso({ tokenId: 'sumiu', piso: 3 })
    expect(useMapStore.getState().map).toBe(antes)
  })
})
