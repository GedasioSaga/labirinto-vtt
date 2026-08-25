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
  addProp,
  removeProp,
  setPropPosition,
  setShowGrid,
  setGridShape,
  addDrawing,
  removeDrawing,
  setWallDoor,
  setScenarioLink,
} from './mapFactory'
import type { Wall, Light, Region, Token, Prop } from '../types/map'

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
      props: [],
      drawings: [],
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

describe('addProp/removeProp/setPropPosition', () => {
  const prop: Prop = { id: 'p1', src: '/tmp/tree.png', x: 0, y: 0, width: 64, height: 64 }

  it('adiciona e remove prop', () => {
    const map = addProp(createEmptyMap('m', 'x', 10, 10, 64), prop)
    expect(map.props).toEqual([prop])
    expect(removeProp(map, 'p1').props).toEqual([])
  })

  it('setPropPosition move só o prop alvo', () => {
    const map = addProp(createEmptyMap('m', 'x', 10, 10, 64), prop)
    const withSecond = addProp(map, { ...prop, id: 'p2', x: 5, y: 5 })
    const next = setPropPosition(withSecond, 'p1', 100, 200)
    const p1 = next.props.find((p) => p.id === 'p1')
    const p2 = next.props.find((p) => p.id === 'p2')
    expect(p1).toEqual({ ...prop, x: 100, y: 200 })
    expect(p2).toEqual({ ...prop, id: 'p2', x: 5, y: 5 })
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

describe('setWallDoor', () => {
  it('seta porta na parede com o id informado, sem tocar outras', () => {
    const map = addWall(addWall(createEmptyMap('m', 'x', 10, 10, 64), wall), { ...wall, id: 'w2' })
    const next = setWallDoor(map, 'w1', { open: false, locked: false })
    const w1 = next.walls.find((w) => w.id === 'w1')
    const w2 = next.walls.find((w) => w.id === 'w2')
    expect(w1?.door).toEqual({ open: false, locked: false })
    expect(w2?.door).toBeNull()
  })

  it('remove a porta (volta pra null) sem tocar outras paredes', () => {
    const map = addWall(createEmptyMap('m', 'x', 10, 10, 64), { ...wall, door: { open: true, locked: false } })
    const next = setWallDoor(map, 'w1', null)
    expect(next.walls[0].door).toBeNull()
  })
})

describe('setScenarioLink', () => {
  it('seta o link de cenário', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(setScenarioLink(map, 'https://exemplo.com/cenario').scenarioLink).toBe('https://exemplo.com/cenario')
  })

  it('aceita null', () => {
    const map = setScenarioLink(createEmptyMap('m', 'x', 10, 10, 64), 'https://exemplo.com/cenario')
    expect(setScenarioLink(map, null).scenarioLink).toBeNull()
  })
})

describe('addDrawing/removeDrawing', () => {
  const freehand = { id: 'd1', kind: 'freehand' as const, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#ffffff', width: 4 }

  it('adiciona um desenho ao mapa', () => {
    const map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), freehand)
    expect(map.drawings).toEqual([freehand])
  })

  it('remove um desenho pelo id', () => {
    let map = addDrawing(createEmptyMap('m', 'x', 10, 10, 64), freehand)
    map = removeDrawing(map, 'd1')
    expect(map.drawings).toEqual([])
  })
})
