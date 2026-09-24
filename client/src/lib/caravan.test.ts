import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { caravanCity, caravanRegroup, caravanStep, landingSpots } from './caravan'
import { createEmptyMap, setWorldMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import type { TravelScene } from './pinTravel'

function ficha(id: string, x: number, y: number, size = 1): Token {
  return { id, characterId: null, name: id, x, y, size, image: null }
}

function pino(id: string, x: number, y: number, destino: { sceneId: string; pinId: string } | null, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, ...extra }
}

describe('caravanStep: as fichas do grupo seguem a que o mestre arrastou', () => {
  const lembra = (x: number, y: number, ...memberIds: string[]) => ({ at: { x, y }, memberIds })

  it('caravana nova: nasce na primeira ficha, e as outras vão para lá', () => {
    const step = caravanStep([ficha('a', 100, 100), ficha('b', 300, 200)], null)
    expect(step).toEqual({ at: { x: 100, y: 100 }, moves: [{ tokenId: 'b', x: 100, y: 100 }], memory: lembra(100, 100, 'a', 'b') })
  })

  it('o mestre arrastou a SEGUNDA ficha: a caravana vai com ela, a primeira segue', () => {
    const step = caravanStep([ficha('a', 100, 100), ficha('b', 500, 250)], lembra(100, 100, 'a', 'b'))
    expect(step?.at).toEqual({ x: 500, y: 250 })
    expect(step?.moves).toEqual([{ tokenId: 'a', x: 500, y: 250 }])
  })

  it('ficha que acabou de ENTRAR no grupo não puxa a caravana: ela é que vai até lá', () => {
    const step = caravanStep([ficha('a', 100, 100), ficha('novata', 900, 400)], lembra(100, 100, 'a'))
    expect(step?.at).toEqual({ x: 100, y: 100 })
    expect(step?.moves).toEqual([{ tokenId: 'novata', x: 100, y: 100 }])
  })

  it('ninguém saiu do lugar: fica, sem movimento; sem ficha: null', () => {
    expect(caravanStep([ficha('a', 100, 100), ficha('b', 100, 100)], lembra(100, 100, 'a', 'b'))?.moves).toEqual([])
    expect(caravanStep([], lembra(1, 1, 'a'))).toBeNull()
  })
})

describe('caravanCity: a cidade sob a caravana', () => {
  const vila: MapData = { ...createEmptyMap('m-vila', 'Vila', 20, 10, 50), pins: [pino('cais', 300, 200, { sceneId: 's-mundo', pinId: 'porto' })] }
  const lookup = (sceneId: string): TravelScene | null => (sceneId === 's-vila' ? { name: 'Vila', map: vila } : null)
  const mundoCom = (pins: Pin[]): MapData => ({ ...createEmptyMap('m-mundo', 'Mundo', 30, 10, 50), worldMap: true, pins })

  it('em cima do pino ligado: devolve destino e pino par', () => {
    const city = caravanCity(mundoCom([pino('porto', 700, 250, { sceneId: 's-vila', pinId: 'cais' })]), { x: 710, y: 240 }, 1, 's-mundo', lookup)
    expect(city).toEqual({ pinId: 'porto', toSceneId: 's-vila', toSceneName: 'Vila', partner: vila.pins[0] })
  })

  it('longe do pino, pino trancado, chegada oculta ou pino sem volta: nenhuma cidade', () => {
    const at = { x: 700, y: 250 }
    const ligado = { sceneId: 's-vila', pinId: 'cais' }
    expect(caravanCity(mundoCom([pino('porto', 900, 250, ligado)]), at, 1, 's-mundo', lookup)).toBeNull()
    expect(caravanCity(mundoCom([pino('porto', 700, 250, ligado, { passagem: 'trancada' })]), at, 1, 's-mundo', lookup)).toBeNull()
    expect(caravanCity(mundoCom([pino('porto', 700, 250, ligado, { soChegada: true })]), at, 1, 's-mundo', lookup)).toBeNull()
    expect(caravanCity(mundoCom([pino('outro', 700, 250, ligado)]), at, 1, 's-mundo', lookup)).toBeNull()
  })
})

describe('landingSpots: cada ficha numa casa livre em volta do pino par', () => {
  it('duas fichas, duas casas diferentes, perto do pino', () => {
    const vila = createEmptyMap('m-vila', 'Vila', 20, 10, 50)
    const cais = pino('cais', 300, 200, null)
    const spots = landingSpots(vila, cais, [ficha('a', 0, 0), ficha('b', 0, 0)])
    expect(spots).toHaveLength(2)
    expect(spots[0]).not.toEqual(spots[1])
    for (const spot of spots) expect(Math.hypot(spot.x - 300, spot.y - 200) <= 3 * 50 * Math.SQRT2).toBe(true)
  })
})

describe('marca de mapa-mundi no arquivo', () => {
  it('ligar grava, desligar tira o campo, e só `true` volta do disco', () => {
    const cena = createEmptyMap('m', 'Mundo', 10, 10, 50)
    const marcada = setWorldMap(cena, true)
    expect(deserializeMap(serializeMap(marcada)).worldMap).toBe(true)
    expect('worldMap' in setWorldMap(marcada, false)).toBe(false)
    expect(deserializeMap(JSON.stringify({ ...cena, worldMap: 'sim' })).worldMap).toBeUndefined()
  })
})

describe('caravanRegroup: depois do Ctrl+Z a caravana se reconhece no retrato, sem ler a volta como arrasto', () => {
  it('retrato inteiro (o grupo todo num ponto): ninguém anda, e a memória passa a ser esse ponto', () => {
    const step = caravanRegroup([ficha('a', 100, 100), ficha('b', 100, 100)])
    expect(step).toEqual({ at: { x: 100, y: 100 }, moves: [], memory: { at: { x: 100, y: 100 }, memberIds: ['a', 'b'] } })
  })

  it('retrato partido: fica no ponto com MAIS fichas, mesmo que a primeira esteja fora dele', () => {
    const step = caravanRegroup([ficha('a', 500, 250), ficha('b', 100, 100), ficha('c', 100, 100)])
    expect(step?.at).toEqual({ x: 100, y: 100 })
    expect(step?.moves).toEqual([{ tokenId: 'a', x: 100, y: 100 }])
  })

  it('empate: vale o ponto da primeira ficha, na ordem do mapa', () => {
    const step = caravanRegroup([ficha('a', 100, 100), ficha('c', 500, 250)])
    expect(step?.at).toEqual({ x: 100, y: 100 })
    expect(step?.moves).toEqual([{ tokenId: 'c', x: 100, y: 100 }])
  })

  it('ninguém do grupo nesta cena: null', () => {
    expect(caravanRegroup([])).toBeNull()
  })
})
