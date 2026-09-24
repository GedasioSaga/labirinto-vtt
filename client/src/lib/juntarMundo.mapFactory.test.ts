import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { createEmptyMap, setTokenPosition } from './mapFactory'

/**
 * JUNÇÃO DO GRUPO MUNDO em `setTokenPosition`: a tocha presa (grupo jogador,
 * `lib/lightAttachment.ts`), a ficha levada junto e o pino preso à ficha (grupo
 * mundo) passam TODOS por aqui. Um lado não pode apagar o outro.
 */

function mesa(): MapData {
  return {
    ...createEmptyMap('m', 'Estrada', 1000, 1000, 50),
    tokens: [
      { id: 'ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null },
      { id: 'ferido', characterId: null, name: 'Ferido', x: 150, y: 100, size: 1, image: null, levadoPor: 'ana' },
    ],
    lights: [{ id: 'tocha', x: 100, y: 100, radius: 100, color: '#ffcc66', intensity: 1, attachedTokenId: 'ana' }],
    pins: [{ id: 'carroca', x: 100, y: 150, kind: 'exclamacao', description: 'Carroça', image: null, presoA: 'ana' }],
  }
}

describe('junção do grupo mundo: setTokenPosition leva tocha, ficha levada e pino preso', () => {
  it('Ana anda 100 px: a tocha, o ferido e a carroça vão junto', () => {
    const depois = setTokenPosition(mesa(), 'ana', 200, 100)
    expect(depois.tokens.find((t) => t.id === 'ana')).toMatchObject({ x: 200, y: 100 })
    expect(depois.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 200, y: 100 })
    expect(depois.tokens.find((t) => t.id === 'ferido')).toMatchObject({ x: 250, y: 100 })
    expect(depois.pins.find((p) => p.id === 'carroca')).toMatchObject({ x: 200, y: 150 })
  })

  it('controle: ficha que ninguém leva nem tem tocha anda sozinha', () => {
    const depois = setTokenPosition(mesa(), 'ferido', 150, 300)
    expect(depois.tokens.find((t) => t.id === 'ferido')).toMatchObject({ x: 150, y: 300 })
    expect(depois.tokens.find((t) => t.id === 'ana')).toMatchObject({ x: 100, y: 100 })
    expect(depois.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 100, y: 100 })
    expect(depois.pins.find((p) => p.id === 'carroca')).toMatchObject({ x: 100, y: 150 })
  })

  it('ficha que não existe devolve o mesmo mapa', () => {
    const antes = mesa()
    expect(setTokenPosition(antes, 'fantasma', 10, 10)).toBe(antes)
  })
})
