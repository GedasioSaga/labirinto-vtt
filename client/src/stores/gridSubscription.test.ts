import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import { subscribeToGridRedraw } from './gridSubscription'
import * as mapFactory from '../lib/mapFactory'
import type { Wall, Token } from '../types/map'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }
const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null }

describe('subscribeToGridRedraw', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: mapFactory.createEmptyMap('map_test', 'Teste', 10, 10, 64),
      camera: { x: 0, y: 0, scale: 1 },
    })
  })

  it('não dispara quando addWall/addToken mudam o mapa sem afetar camera/showGrid/grid', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToGridRedraw(onChange)

    useMapStore.getState().addWall(wall)
    useMapStore.getState().addToken(token)

    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('não dispara quando loadMap troca o objeto do mapa mas grid/showGrid permanecem iguais', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToGridRedraw(onChange)

    // novo objeto de mapa, mesmos valores de grid/showGrid que o estado inicial
    useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_test_2', 'Outro', 10, 10, 64))

    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('dispara quando a camera muda', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToGridRedraw(onChange)

    useMapStore.getState().setCamera({ x: 10, y: 0, scale: 1 })

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando showGrid muda', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToGridRedraw(onChange)

    useMapStore.getState().setShowGrid(false)

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando gridShape muda', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToGridRedraw(onChange)

    useMapStore.getState().setGridShape('hex')

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispara quando o grid muda', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToGridRedraw(onChange)

    useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_test_3', 'Outro', 10, 10, 32))

    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
