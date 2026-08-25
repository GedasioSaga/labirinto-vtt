import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import { subscribeToShapesRedraw } from './shapesSubscription'
import * as mapFactory from '../lib/mapFactory'
import type { Wall, Light, Region, Token } from '../types/map'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }
const light: Light = { id: 'l1', x: 0, y: 0, radius: 64, color: '#ffffff', intensity: 1 }
const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], tag: 'terreno', data: {} }
const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 }

describe('subscribeToShapesRedraw', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: mapFactory.createEmptyMap('map_test', 'Teste', 10, 10, 64),
      camera: { x: 0, y: 0, scale: 1 },
    })
  })

  it('não dispara quando addToken/setCamera/setShowGrid mudam algo não relacionado a shapes', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToShapesRedraw(onChange)

    useMapStore.getState().addToken(token)
    useMapStore.getState().setCamera({ x: 10, y: 0, scale: 1 })
    useMapStore.getState().setShowGrid(false)

    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('dispara quando addWall muda as paredes', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToShapesRedraw(onChange)

    useMapStore.getState().addWall(wall)

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando addLight muda as luzes', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToShapesRedraw(onChange)

    useMapStore.getState().addLight(light)

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando addRegion muda as regiões', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToShapesRedraw(onChange)

    useMapStore.getState().addRegion(region)

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando addDrawing muda os desenhos', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToShapesRedraw(onChange)

    useMapStore.getState().addDrawing({ id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 4 })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando a seleção muda (destaque visual de parede/luz/região selecionada)', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToShapesRedraw(onChange)

    useMapStore.getState().setSelection({ kind: 'wall', id: 'w1' })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
