import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import { subscribeToBackgroundRedraw } from './backgroundSubscription'
import * as mapFactory from '../lib/mapFactory'
import type { Wall } from '../types/map'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }

describe('subscribeToBackgroundRedraw', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: mapFactory.createEmptyMap('map_test', 'Teste', 10, 10, 64),
      camera: { x: 0, y: 0, scale: 1 },
    })
  })

  it('não dispara quando addToken/addWall/setCamera mudam o estado sem afetar o background', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToBackgroundRedraw(onChange)

    useMapStore.getState().addWall(wall)
    useMapStore.getState().addToken({ id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 })
    useMapStore.getState().setCamera({ x: 10, y: 0, scale: 1 })

    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('dispara quando setBackground muda o background', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToBackgroundRedraw(onChange)

    useMapStore.getState().setBackground({ type: 'image', src: 'C:/mapas/background.webp' })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
