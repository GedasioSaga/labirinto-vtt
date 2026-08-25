import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import { subscribeToTokensRedraw } from './tokensSubscription'

describe('subscribeToTokensRedraw', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [], walls: [], lights: [], regions: [] },
      selection: null,
    })
  })

  it('não dispara em addWall/addLight/addRegion/setCamera/setShowGrid', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToTokensRedraw(onChange)

    useMapStore.getState().addWall({ id: 'w1', x1: 0, y1: 0, x2: 1, y2: 1, blocksLight: true, blocksMove: true, door: null })
    useMapStore.getState().addLight({ id: 'l1', x: 0, y: 0, radius: 1, color: '#fff', intensity: 1 })
    useMapStore.getState().addRegion({ id: 'r1', points: [], tag: '', data: {} })
    useMapStore.getState().setCamera({ x: 1, y: 1, scale: 1 })
    useMapStore.getState().setShowGrid(false)

    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('dispara em addToken', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToTokensRedraw(onChange)

    useMapStore.getState().addToken({ id: 't1', characterId: null, name: 'Token', x: 0, y: 0, size: 1 })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara em setSelection', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToTokensRedraw(onChange)

    useMapStore.getState().setSelection({ kind: 'token', id: 't1' })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
