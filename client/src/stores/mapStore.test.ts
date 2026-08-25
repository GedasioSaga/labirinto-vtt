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

describe('mapStore addDrawing/removeSelected(drawing)/configuração de desenho', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: null,
      drawColor: '#ffffff',
      drawWidth: 4,
      drawFilled: false,
    })
  })

  it('addDrawing adiciona ao mapa', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 4 })
    expect(useMapStore.getState().map.drawings).toHaveLength(1)
  })

  it('removeSelected apaga o desenho selecionado', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 4 })
    useMapStore.getState().setSelection({ kind: 'drawing', id: 'd1' })

    useMapStore.getState().removeSelected()

    expect(useMapStore.getState().map.drawings).toEqual([])
    expect(useMapStore.getState().selection).toBeNull()
  })

  it('setDrawColor/setDrawWidth/setDrawFilled atualizam a configuração', () => {
    useMapStore.getState().setDrawColor('#ff0000')
    useMapStore.getState().setDrawWidth(10)
    useMapStore.getState().setDrawFilled(true)

    const state = useMapStore.getState()
    expect(state.drawColor).toBe('#ff0000')
    expect(state.drawWidth).toBe(10)
    expect(state.drawFilled).toBe(true)
  })
})

describe('mapStore setWallDoor/setScenarioLink', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], scenarioLink: null },
      selection: null,
    })
  })

  it('setWallDoor reflete no map', () => {
    useMapStore.getState().addWall(blockingWall)

    useMapStore.getState().setWallDoor('w1', { open: false, locked: false })

    const wall = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    expect(wall?.door).toEqual({ open: false, locked: false })
  })

  it('setScenarioLink reflete no map', () => {
    useMapStore.getState().setScenarioLink('https://exemplo.com/cenario')

    expect(useMapStore.getState().map.scenarioLink).toBe('https://exemplo.com/cenario')
  })
})
