import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import { subscribeToPropsRedraw } from './propsSubscription'

describe('subscribeToPropsRedraw', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, props: [], walls: [], tokens: [] },
    })
  })

  it('não dispara em addWall/addToken/setCamera', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToPropsRedraw(onChange)

    useMapStore.getState().addWall({ id: 'w1', x1: 0, y1: 0, x2: 1, y2: 1, blocksLight: true, blocksMove: true, door: null })
    useMapStore.getState().addToken({ id: 't1', characterId: null, name: 'Token', x: 0, y: 0, size: 1 })
    useMapStore.getState().setCamera({ x: 1, y: 1, scale: 1 })

    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('dispara em addProp', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToPropsRedraw(onChange)

    useMapStore.getState().addProp({ id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando a seleção muda (contorno de destaque da peça selecionada)', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToPropsRedraw(onChange)

    useMapStore.getState().setSelection({ kind: 'prop', id: 'p1' })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
