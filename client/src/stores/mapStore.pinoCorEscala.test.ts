import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * COR E TAMANHO DO PINO no desfazer (fatia 14): o deslizante "Tamanho" e o
 * seletor de "Outra cor…" mudam o valor a cada passo do arrasto. Um arrasto é
 * UM Ctrl+Z; mudança de outro campo no meio separa os passos.
 */

const PINO: Pin = { id: 'p', x: 100, y: 100, kind: 'exclamacao', description: '', image: null }
const store = () => useMapStore.getState()

beforeEach(() => {
  store().loadMap({ ...createEmptyMap('m', 'M', 10, 10, 40), pins: [PINO] })
})

describe('mapStore.updatePin: cor e escala no histórico', () => {
  it('arrastar o tamanho por vários passos desfaz de uma vez', () => {
    for (const escala of [1.25, 1.5, 1.75, 2]) store().updatePin('p', { escala })
    expect(store().map.pins[0].escala).toBe(2)
    store().undo()
    expect(store().map.pins[0].escala).toBeUndefined()
  })

  it('arrastar no seletor de cor desfaz de uma vez', () => {
    for (const cor of ['#111111', '#222222', '#333333']) store().updatePin('p', { cor })
    store().undo()
    expect(store().map.pins[0].cor).toBeUndefined()
  })

  it('cor e depois tamanho são dois passos', () => {
    store().updatePin('p', { cor: '#5b6670' })
    store().updatePin('p', { escala: 2 })
    store().undo()
    expect([store().map.pins[0].cor, store().map.pins[0].escala]).toEqual(['#5b6670', undefined])
  })
})
