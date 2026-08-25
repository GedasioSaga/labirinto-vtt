import { describe, expect, it, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import type { Token, Wall } from '../types/map'

const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 }
const blockingWall: Wall = { id: 'w1', x1: 5, y1: -10, x2: 5, y2: 10, blocksLight: true, blocksMove: true, door: null }

describe('mapStore moveToken', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [], walls: [], lights: [], regions: [] },
      selection: null,
    })
  })

  it('move o token para a posição alvo quando nada bloqueia', () => {
    useMapStore.getState().addToken(token)

    useMapStore.getState().moveToken('t1', 10, 10)

    const moved = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    expect(moved).toEqual({ ...token, x: 10, y: 10 })
  })

  it('mantém a posição original quando o movimento cruza parede bloqueante', () => {
    useMapStore.getState().addToken(token)
    useMapStore.getState().addWall(blockingWall)

    useMapStore.getState().moveToken('t1', 10, 0)

    const notMoved = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    expect(notMoved).toEqual(token)
  })

  it('não faz nada (early return) quando o id não existe', () => {
    useMapStore.getState().addToken(token)
    const before = useMapStore.getState().map

    useMapStore.getState().moveToken('inexistente', 10, 10)

    expect(useMapStore.getState().map).toBe(before)
  })
})
