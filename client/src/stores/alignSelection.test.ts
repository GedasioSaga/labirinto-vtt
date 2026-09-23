import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import type { Drawing } from '../types/map'

function pilar(id: string, x: number, y: number): Drawing {
  return { id, kind: 'rect', x, y, w: 60, h: 60, color: '#1e32d2', width: 2, filled: true, fillAlpha: 1 }
}

function xs(): number[] {
  return useMapStore.getState().map.drawings.map((d) => (d.kind === 'rect' ? d.x : NaN))
}

function ys(): number[] {
  return useMapStore.getState().map.drawings.map((d) => (d.kind === 'rect' ? d.y : NaN))
}

describe('mapStore — alinhar e distribuir a seleção', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: {
        ...useMapStore.getState().map,
        tokens: [],
        walls: [],
        regions: [],
        props: [],
        drawings: [pilar('v', 250, 230), pilar('a', 380, 320), pilar('m', 800, 600)],
      },
      selection: [
        { kind: 'drawing', id: 'v' },
        { kind: 'drawing', id: 'a' },
        { kind: 'drawing', id: 'm' },
      ],
      past: [],
      future: [],
    })
  })

  it('alignSelection alinha os três com UMA entrada de histórico, e um desfazer devolve os três', () => {
    useMapStore.getState().alignSelection('left')

    expect(xs()).toEqual([250, 250, 250])
    expect(ys()).toEqual([230, 320, 600])
    expect(useMapStore.getState().past.length).toBe(1)

    useMapStore.getState().undo()
    expect(xs()).toEqual([250, 380, 800])
    expect(ys()).toEqual([230, 320, 600])
  })

  it('distributeSelection deixa o espaço igual com UMA entrada de histórico', () => {
    useMapStore.getState().distributeSelection('vertical')

    expect(ys()).toEqual([230, 415, 600])
    expect(xs()).toEqual([250, 380, 800])
    expect(useMapStore.getState().past.length).toBe(1)
  })

  it('não empilha histórico quando nada muda (1 item, ou já alinhados)', () => {
    useMapStore.setState({ selection: [{ kind: 'drawing', id: 'v' }] })
    useMapStore.getState().alignSelection('left')
    expect(useMapStore.getState().past.length).toBe(0)

    useMapStore.setState({
      selection: [
        { kind: 'drawing', id: 'v' },
        { kind: 'drawing', id: 'a' },
      ],
    })
    useMapStore.getState().distributeSelection('horizontal')
    expect(useMapStore.getState().past.length).toBe(0)

    useMapStore.getState().alignSelection('top')
    useMapStore.getState().alignSelection('top')
    expect(useMapStore.getState().past.length).toBe(1)
  })

  it('a seleção continua a mesma depois de alinhar (dá para alinhar de novo por outro eixo)', () => {
    const antes = useMapStore.getState().selection
    useMapStore.getState().alignSelection('center')
    expect(useMapStore.getState().selection).toEqual(antes)
  })
})
