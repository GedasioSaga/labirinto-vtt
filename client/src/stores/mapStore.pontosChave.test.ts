import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import type { Drawing } from '../types/map'

/**
 * Editar o traço do Pincel e o polígono pelas alças de ponto-chave
 * (`lib/pontosChave.ts`): cada gesto — arrastar, inserir pelo meio e já
 * arrastar, apagar com duplo clique — é UM Ctrl+Z. O arrasto vai pelo par
 * `updateDrawingKeyPointLive` (sem histórico) + `commitDragHistory(antes)` no
 * pointerup, igual à curva.
 */
const traco: Drawing = {
  id: 't1',
  kind: 'freehand',
  points: Array.from({ length: 101 }, (_, i) => ({ x: i * 2, y: 0 })),
  color: '#222',
  width: 3,
  pontosChave: [0, 50, 100],
}

const quadrado: Drawing = {
  id: 'p1',
  kind: 'polygon',
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  color: '#222',
  width: 0,
  filled: true,
  fillAlpha: 1,
}

const desenho = (id: string): Drawing | undefined => useMapStore.getState().map.drawings.find((d) => d.id === id)

describe('mapStore — pontos-chave do traço e do polígono', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), drawings: [traco, quadrado] })
  })

  it('arrastar um ponto-chave: vários pointermoves, UM Ctrl+Z', () => {
    const antes = useMapStore.getState().map
    const store = useMapStore.getState()
    store.updateDrawingKeyPointLive(antes, 't1', 1, 100, 10)
    store.updateDrawingKeyPointLive(antes, 't1', 1, 100, 25)
    store.updateDrawingKeyPointLive(antes, 't1', 1, 100, 40)
    expect(useMapStore.getState().past).toHaveLength(0)
    store.commitDragHistory(antes)

    const depois = desenho('t1')
    expect(depois?.kind === 'freehand' && depois.points[50]).toEqual({ x: 100, y: 40 })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(desenho('t1')).toEqual(traco)
  })

  it('cada pointermove parte do desenho de antes do gesto', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().updateDrawingKeyPointLive(antes, 't1', 1, 100, 80)
    useMapStore.getState().updateDrawingKeyPointLive(antes, 't1', 1, 100, 40)
    const depois = desenho('t1')
    // Meio do trecho: metade do deslocamento final, não soma dos dois passos.
    expect(depois?.kind === 'freehand' && depois.points[25].y).toBeCloseTo(20, 6)
  })

  it('bolinha do meio: inserir e já arrastar é UM Ctrl+Z', () => {
    const chave = useMapStore.getState().insertDrawingKeyPoint('p1', 0)
    expect(chave).toBe(1)
    expect(useMapStore.getState().past).toHaveLength(1)
    const base = useMapStore.getState().map
    useMapStore.getState().updateDrawingKeyPointLive(base, 'p1', 1, 50, -30)
    useMapStore.getState().updateDrawingKeyPointLive(base, 'p1', 1, 50, -60)
    expect(useMapStore.getState().past).toHaveLength(1)
    const depois = desenho('p1')
    expect(depois?.kind === 'polygon' && depois.points).toEqual([
      { x: 0, y: 0 }, { x: 50, y: -60 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    ])
    useMapStore.getState().undo()
    expect(desenho('p1')).toEqual(quadrado)
  })

  it('duplo clique tira o ponto-chave num Ctrl+Z; recusado não gasta Ctrl+Z', () => {
    expect(useMapStore.getState().removeDrawingKeyPoint('p1', 2)).toBe(true)
    const depois = desenho('p1')
    expect(depois?.kind === 'polygon' && depois.points).toHaveLength(3)
    expect(useMapStore.getState().past).toHaveLength(1)

    // Triângulo: não perde mais vértice.
    expect(useMapStore.getState().removeDrawingKeyPoint('p1', 0)).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(desenho('p1')).toEqual(quadrado)
  })

  it('inserir num desenho que não é traço nem polígono não faz nada', () => {
    const linha: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10, color: '#000', width: 2 }
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), drawings: [linha] })
    expect(useMapStore.getState().insertDrawingKeyPoint('l1', 0)).toBeNull()
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
