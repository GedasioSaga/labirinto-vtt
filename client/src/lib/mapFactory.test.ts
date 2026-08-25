import { describe, expect, it } from 'vitest'
import {
  createEmptyMap,
  addWall,
  removeWall,
  addLight,
  removeLight,
  addRegion,
  removeRegion,
  addToken,
  removeToken,
  setTokenPosition,
  setShowGrid,
  setGridShape,
} from './mapFactory'
import type { Wall, Light, Region, Token } from '../types/map'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }
const light: Light = { id: 'l1', x: 32, y: 32, radius: 8, color: '#ffaa33', intensity: 0.8 }
const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }], tag: 'trap', data: {} }
const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 }

describe('createEmptyMap', () => {
  it('cria mapa com defaults corretos', () => {
    const map = createEmptyMap('map_1', 'Teste', 30, 20, 64)
    expect(map).toEqual({
      id: 'map_1',
      name: 'Teste',
      width: 30,
      height: 20,
      grid: 64,
      gridShape: 'square',
      showGrid: true,
      background: { type: 'color', src: '#2b2b2b' },
      walls: [],
      lights: [],
      regions: [],
      tokens: [],
      fog: { mode: 'none', revealed: [] },
      ownerId: null,
      scenarioLink: null,
    })
  })
})

describe('addWall/removeWall', () => {
  it('adiciona sem mutar o mapa original', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const next = addWall(map, wall)
    expect(map.walls).toHaveLength(0)
    expect(next.walls).toEqual([wall])
  })

  it('remove só a parede com o id informado', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), wall)
    const withSecond = addWall(map, { ...wall, id: 'w2' })
    const next = removeWall(withSecond, 'w1')
    expect(next.walls.map((w) => w.id)).toEqual(['w2'])
  })
})

describe('addLight/removeLight', () => {
  it('funciona igual a wall', () => {
    const map = addLight(createEmptyMap('m', 'x', 10, 10, 64), light)
    expect(map.lights).toEqual([light])
    expect(removeLight(map, 'l1').lights).toEqual([])
  })
})

describe('addRegion/removeRegion', () => {
  it('funciona igual a wall', () => {
    const map = addRegion(createEmptyMap('m', 'x', 10, 10, 64), region)
    expect(map.regions).toEqual([region])
    expect(removeRegion(map, 'r1').regions).toEqual([])
  })
})

describe('addToken/removeToken/setTokenPosition', () => {
  it('adiciona e remove token', () => {
    const map = addToken(createEmptyMap('m', 'x', 10, 10, 64), token)
    expect(map.tokens).toEqual([token])
    expect(removeToken(map, 't1').tokens).toEqual([])
  })

  it('setTokenPosition move só o token alvo', () => {
    const map = addToken(createEmptyMap('m', 'x', 10, 10, 64), token)
    const withSecond = addToken(map, { ...token, id: 't2', x: 5, y: 5 })
    const next = setTokenPosition(withSecond, 't1', 100, 200)
    const t1 = next.tokens.find((t) => t.id === 't1')
    const t2 = next.tokens.find((t) => t.id === 't2')
    expect(t1).toEqual({ ...token, x: 100, y: 200 })
    expect(t2).toEqual({ ...token, id: 't2', x: 5, y: 5 })
  })
})

describe('setShowGrid', () => {
  it('alterna a flag', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setShowGrid(map, false).showGrid).toBe(false)
  })
})

describe('setGridShape', () => {
  it('troca o formato do grid', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setGridShape(map, 'hex').gridShape).toBe('hex')
  })
})
