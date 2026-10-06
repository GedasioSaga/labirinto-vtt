import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { deserializeMap, serializeMap } from '../lib/mapFile'
import type { MapData, Pin, Stair } from '../types/map'
import { useMapStore } from '../stores/mapStore'

/** TRANSIÇÃO ESPECIAL gravada no pino de viagem e na escada: disco e Ctrl+Z. */
const pino: Pin = { id: 'pino', x: 100, y: 100, kind: 'viagem', description: '', image: null }
const escada: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 100, y1: 100, x2: 100, y2: 180 }], stepWidth: 40, levaAoPiso: 1 }

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 20, 20, 40), pins: [pino], stairs: [escada], ...extra }
}

const current = (): MapData => useMapStore.getState().map

beforeEach(() => {
  useMapStore.getState().loadMap(mapa())
})

describe('transição no disco', () => {
  it('pino e escada guardam a transição e a duração', () => {
    const salvo = mapa({ pins: [{ ...pino, transicao: { id: 'porta', duracaoS: 5 } }], stairs: [{ ...escada, transicao: { id: 'escada-pedra' } }] })
    const lido = deserializeMap(serializeMap(salvo))
    expect(lido.pins[0].transicao).toEqual({ id: 'porta', duracaoS: 5 })
    expect(lido.stairs[0].transicao).toEqual({ id: 'escada-pedra' })
  })

  it('id fora do catálogo some; duração fora do teto vira a natural', () => {
    const torto = JSON.parse(serializeMap(mapa())) as { pins: Record<string, unknown>[]; stairs: Record<string, unknown>[] }
    torto.pins[0].transicao = { id: 'elevador', duracaoS: 4 }
    torto.stairs[0].transicao = { id: 'porta', duracaoS: 999 }
    const lido = deserializeMap(JSON.stringify(torto))
    expect(lido.pins[0].transicao).toBeUndefined()
    expect(lido.stairs[0].transicao).toEqual({ id: 'porta' })
  })

  it('mapa salvo antes do campo abre sem transição', () => {
    const lido = deserializeMap(serializeMap(mapa()))
    expect(lido.pins[0].transicao).toBeUndefined()
    expect(lido.stairs[0].transicao).toBeUndefined()
  })
})

describe('transição no editor (Ctrl+Z)', () => {
  it('pino: escolher, trocar a duração e desfazer', () => {
    useMapStore.getState().updatePin('pino', { transicao: { id: 'porta' } })
    useMapStore.getState().updatePin('pino', { transicao: { id: 'porta' } })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().updatePin('pino', { transicao: { id: 'porta', duracaoS: 4 } })
    expect(current().pins[0].transicao).toEqual({ id: 'porta', duracaoS: 4 })
    useMapStore.getState().undo()
    expect(current().pins[0].transicao).toEqual({ id: 'porta' })
  })

  it('escada: escolher e tirar, um passo cada; tirar o que não existe não empilha', () => {
    useMapStore.getState().setStairTransicao('escada', undefined)
    expect(useMapStore.getState().past).toHaveLength(0)
    useMapStore.getState().setStairTransicao('escada', { id: 'escada-pedra' })
    expect(current().stairs[0].transicao).toEqual({ id: 'escada-pedra' })
    useMapStore.getState().setStairTransicao('escada', undefined)
    expect(current().stairs[0].transicao).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(2)
  })
})
