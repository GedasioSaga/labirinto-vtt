import { describe, expect, it } from 'vitest'
import { serializeMap, deserializeMap } from './mapFile'
import { createEmptyMap, addWall, addToken } from './mapFactory'

describe('serializeMap/deserializeMap', () => {
  it('round-trip preserva o mapa exatamente', () => {
    let map = createEmptyMap('map_1', 'Cripta', 20, 15, 64)
    map = addWall(map, { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null })
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null })

    const json = serializeMap(map)
    const restored = deserializeMap(json)

    expect(restored).toEqual(map)
  })

  it('A5: mapa sem concealZones abre com [] e zona salva volta igual', () => {
    expect(deserializeMap('{"id": "sem-zona"}').concealZones).toEqual([])
    const zone = { id: 'z1', name: 'Cripta', revealed: false, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }
    const map = { ...createEmptyMap('map_z', 'Z', 5, 5, 64), concealZones: [zone] }
    expect(deserializeMap(serializeMap(map)).concealZones).toEqual([zone])
  })

  it('mapa salvo antes dos pinos abre com [] e pino salvo volta igual', () => {
    expect(deserializeMap('{"id": "sem-pino"}').pins).toEqual([])
    const pin = { id: 'p1', x: 120, y: 80, kind: 'interrogacao' as const, description: 'O que tem atrás?', image: null }
    const map = { ...createEmptyMap('map_p', 'P', 5, 5, 64), pins: [pin] }
    expect(deserializeMap(serializeMap(map)).pins).toEqual([pin])
  })

  it('pino gravado torto (sem kind, sem descrição, imagem que não é texto) abre mudo em vez de derrubar o mapa', () => {
    const json = '{"id": "torto", "pins": [{"id": "p1", "x": 10, "y": 20, "image": 7}]}'
    expect(deserializeMap(json).pins).toEqual([{ id: 'p1', x: 10, y: 20, kind: 'exclamacao', description: '', image: null }])
  })

  it('pino com ícone faz ida e volta, e pino salvo ANTES do campo abre sem ícone (a cara de hoje)', () => {
    const comIcone = { id: 'p1', x: 120, y: 80, kind: 'exclamacao' as const, icon: 'bau' as const, description: '', image: null }
    const map = { ...createEmptyMap('map_i', 'I', 5, 5, 64), pins: [comIcone] }
    expect(deserializeMap(serializeMap(map)).pins).toEqual([comIcone])
    // O mapa gravado antes desta mudança: nenhum `icon` no arquivo.
    const antigo = '{"id": "antigo", "pins": [{"id": "p1", "x": 10, "y": 20, "kind": "interrogacao", "description": "", "image": null}]}'
    expect(deserializeMap(antigo).pins[0].icon).toBeUndefined()
  })

  it('ícone desconhecido abre como pino sem ícone em vez de derrubar o desenho do mapa', () => {
    const json = '{"id": "futuro", "pins": [{"id": "p1", "x": 10, "y": 20, "icon": "dragao", "description": "", "image": null}]}'
    const pin = deserializeMap(json).pins[0]
    expect(pin.icon).toBeUndefined()
    expect(pin.kind).toBe('exclamacao')
  })

  it('scenarioLink faz ida e volta (campo escondido da janela, mas o dado continua gravado)', () => {
    const link = 'https://exemplo.com/cenario-1'
    const map = { ...createEmptyMap('map_link', 'Link', 5, 5, 64), scenarioLink: link }
    expect(deserializeMap(serializeMap(map)).scenarioLink).toBe(link)
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
    expect(restored.gridSettings).toEqual({ color: '#4a4a4a', opacity: 1, lineWidth: 1, lineStyle: 'solid' })
    expect(restored.walls).toEqual([])
    expect(restored.tokens).toEqual([])
    expect(restored.props).toEqual([])
    expect(restored.stairs).toEqual([])
    expect(restored.drawings).toEqual([])
    expect(restored.fog).toEqual({ mode: 'none', revealed: [] })
    expect(restored.hiddenLayers).toEqual([])
    expect(restored.lockedLayers).toEqual([])
    expect(restored.scale).toEqual({ unitsPerCell: 5, unit: 'ft', precision: 0 })
    expect(restored.measurementMode).toBe('chessboard')
    expect(restored.ownerId).toBeNull()
    expect(restored.scenarioLink).toBeNull()
  })

  it('deriva measurementMode "hex" quando gridShape salvo é "hex", mesmo sem measurementMode explícito', () => {
    const restored = deserializeMap('{"id": "map_hex", "gridShape": "hex"}')
    expect(restored.measurementMode).toBe('hex')
  })

  it('preenche kind: "normal" em porta de map.json salvo antes desse campo existir, preservando open/locked', () => {
    const json = JSON.stringify({
      id: 'map_old',
      walls: [{ id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: { open: true, locked: false } }],
    })
    const restored = deserializeMap(json)
    expect(restored.walls[0].door).toEqual({ open: true, locked: false, kind: 'normal' })
  })

  it('preenche fillAlpha em circle de map.json salvo antes desse campo existir, respeitando filled', () => {
    const json = JSON.stringify({
      id: 'map_old',
      drawings: [
        { id: 'd1', kind: 'circle', cx: 0, cy: 0, radius: 10, color: '#fff', width: 2, filled: true },
        { id: 'd2', kind: 'circle', cx: 0, cy: 0, radius: 10, color: '#fff', width: 2, filled: false },
      ],
    })
    const restored = deserializeMap(json)
    const d1 = restored.drawings.find((d) => d.id === 'd1')
    const d2 = restored.drawings.find((d) => d.id === 'd2')
    expect(d1?.kind).toBe('circle')
    if (d1?.kind === 'circle') expect(d1.fillAlpha).toBe(0.5)
    expect(d2?.kind).toBe('circle')
    if (d2?.kind === 'circle') expect(d2.fillAlpha).toBe(0)
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
    expect(restored.regions).toEqual([{ id: 'r1', points: [], tag: 'x', data: {}, fillColor: '#3a7ad0', fillPattern: 'solid' }])
  })

  it('preenche fillPattern: "solid" em região de map.json salvo antes desse campo existir', () => {
    const json = JSON.stringify({
      id: 'map_old',
      regions: [{ id: 'r1', points: [], tag: 'x', fillColor: '#00ff00', data: {} }],
    })
    const restored = deserializeMap(json)
    expect(restored.regions).toEqual([{ id: 'r1', points: [], tag: 'x', fillColor: '#00ff00', fillPattern: 'solid', data: {} }])
  })
})
