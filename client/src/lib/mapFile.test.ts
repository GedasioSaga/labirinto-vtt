import { describe, expect, it } from 'vitest'
import { serializeMap, deserializeMap } from './mapFile'
import { createEmptyMap, addWall, addToken } from './mapFactory'

describe('serializeMap/deserializeMap', () => {
  it('round-trip preserva o mapa exatamente', () => {
    let map = createEmptyMap('map_1', 'Cripta', 20, 15, 64)
    map = addWall(map, { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null })
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 })

    const json = serializeMap(map)
    const restored = deserializeMap(json)

    expect(restored).toEqual(map)
  })

  it('rejeita JSON malformado com mensagem clara', () => {
    expect(() => deserializeMap('{ isso não é json')).toThrow()
  })

  it('rejeita objeto sem campo id', () => {
    expect(() => deserializeMap('{"name": "sem id"}')).toThrow(/id/)
  })

  it('preenche defaults quando campos opcionais estão ausentes', () => {
    const restored = deserializeMap('{"id": "map_min"}')
    expect(restored.name).toBe('Mapa sem título')
    expect(restored.width).toBe(30)
    expect(restored.height).toBe(20)
    expect(restored.grid).toBe(64)
    expect(restored.gridShape).toBe('square')
    expect(restored.showGrid).toBe(true)
    expect(restored.walls).toEqual([])
    expect(restored.tokens).toEqual([])
    expect(restored.props).toEqual([])
    expect(restored.drawings).toEqual([])
    expect(restored.fog).toEqual({ mode: 'none', revealed: [] })
    expect(restored.ownerId).toBeNull()
    expect(restored.scenarioLink).toBeNull()
  })

  it('preenche linkedMapPath: null em prop de map.json salvo antes desse campo existir', () => {
    const json = JSON.stringify({
      id: 'map_old',
      props: [{ id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64 }],
    })
    const restored = deserializeMap(json)
    expect(restored.props).toEqual([{ id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }])
  })

  it('preenche fillColor: "#3a7ad0" em região de map.json salvo antes desse campo existir', () => {
    const json = JSON.stringify({
      id: 'map_old',
      regions: [{ id: 'r1', points: [], tag: 'x', data: {} }],
    })
    const restored = deserializeMap(json)
    expect(restored.regions).toEqual([{ id: 'r1', points: [], tag: 'x', data: {}, fillColor: '#3a7ad0' }])
  })
})
