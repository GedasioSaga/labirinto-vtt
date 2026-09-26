import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { mapaDoPiso, pisoDe } from '../lib/pisos'
import { hostPlayerChanges } from '../net/playerChanges'
import type { MapData, Pin, Stair, Token } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * PISOS NA MESMA CENA — o pino selecionado pelo mestre e a escada do JOGADOR.
 * O pino preso a uma ficha (`presoA`) sobe junto com ela. Cenário do revisor:
 * o mestre, no térreo, seleciona o balão preso ao Caio; o jogador do Caio sobe
 * a escada. O balão vai para o 1º piso e some do canvas do mestre — não pode
 * continuar selecionado, senão o Delete apaga o pino que ele não vê.
 */
const caio: Token = { id: 'caio', characterId: null, name: 'Caio', x: 500, y: 500, size: 1, image: null }
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 500, y1: 450, x2: 500, y2: 550 }], stepWidth: 40, levaAoPiso: 1 }

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 500, y: 480, kind: 'exclamacao', description: `texto-${id}`, image: null, ...extra }
}

function terreo(): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 25, 25, 40),
    tokens: [caio],
    pins: [pino('balao', { presoA: 'caio' }), pino('placa')],
    stairs: [ESCADA],
  }
}

const store = () => useMapStore.getState()

beforeEach(() => {
  store().loadMap(terreo())
})

describe('mapStore — pino selecionado quando o jogador leva a ficha a outro piso', () => {
  it('o balão preso ao Caio sobe com ele e sai da seleção do mestre, que ficou no térreo', () => {
    store().setSelectedPin('balao')
    expect(store().selectedPinId).toBe('balao')
    hostPlayerChanges.applyPiso({ tokenId: 'caio', piso: 1 })
    const balao = store().map.pins.find((p) => p.id === 'balao')
    if (balao === undefined) throw new Error('o balão sumiu do mapa')
    expect(pisoDe(balao)).toBe(1)
    expect(store().pisoAtivo).toBe(0)
    expect(mapaDoPiso(store().map, 0).pins.map((p) => p.id)).toEqual(['placa'])
    expect(store().selectedPinId).toBeNull()
  })

  it('o pino solto no térreo continua selecionado quando o Caio sobe', () => {
    store().setSelectedPin('placa')
    hostPlayerChanges.applyPiso({ tokenId: 'caio', piso: 1 })
    expect(store().map.tokens.map((t) => [t.id, pisoDe(t)])).toEqual([['caio', 1]])
    expect(store().selectedPinId).toBe('placa')
  })

  it('o mestre no 1º piso com o balão selecionado: o Caio desce e o balão sai da seleção lá em cima', () => {
    store().loadMap({ ...terreo(), tokens: [{ ...caio, piso: 1 }], pins: [pino('balao', { presoA: 'caio', piso: 1 })] })
    store().setPisoAtivo(1)
    store().setSelectedPin('balao')
    hostPlayerChanges.applyPiso({ tokenId: 'caio', piso: 0 })
    expect(store().map.pins.map((p) => [p.id, pisoDe(p)])).toEqual([['balao', 0]])
    expect(store().pisoAtivo).toBe(1)
    expect(store().selectedPinId).toBeNull()
  })
})
