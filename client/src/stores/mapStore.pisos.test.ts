import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Stair, Token, Wall } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * PISOS NA MESMA CENA no editor do mestre: pôr a ficha e a escada em outro
 * piso passa pelo Ctrl+Z, e arrastar a ficha só esbarra na parede do piso dela.
 */
const parede: Wall = { id: 'parede-do-primeiro', x1: 300, y1: 0, x2: 300, y2: 800, blocksLight: true, blocksMove: true, door: null, piso: 1 }
const heroi: Token = { id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }
const escada: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 100, y1: 100, x2: 100, y2: 180 }], stepWidth: 40 }

function sampleMap(): MapData {
  return { ...createEmptyMap('m', 'M', 20, 20, 40), walls: [parede], tokens: [heroi], stairs: [escada] }
}

const current = (): MapData => useMapStore.getState().map
const ficha = (): Token => {
  const found = current().tokens.find((t) => t.id === 'heroi')
  if (found === undefined) throw new Error('herói sumiu')
  return found
}

beforeEach(() => {
  useMapStore.getState().loadMap(sampleMap())
})

describe('mapStore — pisos na mesma cena', () => {
  it('no térreo, a parede do 1º piso não barra o arrasto; no 1º piso, barra', () => {
    useMapStore.getState().moveToken('heroi', 500, 200)
    expect(ficha()).toMatchObject({ x: 500, y: 200 })
    useMapStore.getState().loadMap({ ...sampleMap(), tokens: [{ ...heroi, piso: 1 }] })
    useMapStore.getState().moveToken('heroi', 500, 200)
    expect(ficha()).toMatchObject({ x: 200, y: 200, piso: 1 })
  })

  it('ficha para o 2º piso: um passo de Ctrl+Z; repetir o mesmo piso não empilha passo', () => {
    useMapStore.getState().setTokenPiso('heroi', 2)
    useMapStore.getState().setTokenPiso('heroi', 2)
    expect(ficha().piso).toBe(2)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect('piso' in ficha()).toBe(false)
  })

  it('escada: liga ao 1º piso e volta a ser enfeite', () => {
    useMapStore.getState().setStairPisos('escada', { levaAoPiso: 1 })
    expect(current().stairs[0].levaAoPiso).toBe(1)
    useMapStore.getState().setStairPisos('escada', { levaAoPiso: null })
    expect('levaAoPiso' in current().stairs[0]).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(2)
  })
})
