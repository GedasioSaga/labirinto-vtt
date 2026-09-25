import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Region, RegionPoint, Token, Wall } from '../types/map'
import { pointInRing } from './floorContour'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * FICHA VISTA PELA BORDA — o guarda com meio corpo no vão da porta aparece
 * para quem vê a borda dele, não só o centro. O que o mestre esconde (ficha
 * secreta ou oculta, sala secreta, teto fechado, zona oculta) continua não
 * saindo, mesmo com a borda à vista.
 *
 * Planta: parede em x = 1000 com um vão em y 450-550. A Fabi está em
 * (700, 250), a noroeste do vão. O guarda fica do outro lado, logo abaixo do
 * canto (1000, 550): o centro dele cai na sombra do canto, e a borda de cima,
 * à direita, fica na luz que passa pelo vão.
 */
const RAIO_DE_VISAO = 700
const POSSE = { fabi: ['fabi'] }
const GUARDA_NO_VAO = { x: 1035, y: 600 }
/** Ponto da borda (a 0,9 do raio de 25 px, ângulo de -45°) que passa pelo vão. */
const BORDA_NA_LUZ = { x: 1035 + 22.5 * Math.SQRT1_2, y: 600 - 22.5 * Math.SQRT1_2 }
const GUARDA_ATRAS_DA_PAREDE = { x: 1035, y: 700 }

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function ficha(id: string, p: RegionPoint, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

/** Quadrado pequeno (20 px) em volta do centro do guarda: cobre o centro, não a borda na luz. */
function quadradoNoCentro(): RegionPoint[] {
  const { x, y } = GUARDA_NO_VAO
  return [
    { x: x - 10, y: y - 10 },
    { x: x + 10, y: y - 10 },
    { x: x + 10, y: y + 10 },
    { x: x - 10, y: y + 10 },
  ]
}

function sala(id: string, extra: Partial<Region>): Region {
  return {
    id,
    points: quadradoNoCentro(),
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `sala-${id}` },
    ...extra,
  }
}

function corredor(guarda: Token, extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-corredor', 'Corredor A01', 40, 20, 50),
    walls: [parede('norte', 1000, 0, 1000, 450), parede('sul', 1000, 550, 1000, 1000)],
    tokens: [ficha('fabi', { x: 700, y: 250 }), guarda],
    ...extra,
  }
}

function idsRecebidos(map: MapData): string[] {
  return filterMapForPlayer(map, 'fabi', POSSE, RAIO_DE_VISAO)
    .map.tokens.map((t) => t.id)
    .sort()
}

function ve(map: MapData, p: RegionPoint): boolean {
  return filterMapForPlayer(map, 'fabi', POSSE, RAIO_DE_VISAO).vision.some((ring) => pointInRing(p, [...ring]))
}

describe('fogFilter: ficha vista pela borda', () => {
  it('a planta é a do relato: o centro do guarda está na sombra e a borda de cima, na luz', () => {
    const map = corredor(ficha('guarda', GUARDA_NO_VAO))
    expect(ve(map, GUARDA_NO_VAO)).toBe(false)
    expect(ve(map, BORDA_NA_LUZ)).toBe(true)
  })

  it('guarda com meio corpo no vão chega à Fabi, com o nome para os jogadores e sem nada do mestre', () => {
    const map = corredor(ficha('guarda', GUARDA_NO_VAO, { publicName: 'Guarda da Repartição' }))
    const view = filterMapForPlayer(map, 'fabi', POSSE, RAIO_DE_VISAO)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['fabi', 'guarda'])
    const guarda = view.map.tokens.find((t) => t.id === 'guarda')
    expect(guarda?.x).toBe(GUARDA_NO_VAO.x)
    expect(guarda?.y).toBe(GUARDA_NO_VAO.y)
    expect(JSON.stringify(view.map.tokens)).not.toContain('nome-guarda')
  })

  it('guarda inteiro atrás da parede continua fora: nenhum ponto da borda está na luz', () => {
    expect(idsRecebidos(corredor(ficha('guarda', GUARDA_ATRAS_DA_PAREDE)))).toEqual(['fabi'])
  })

  it('guarda longe da visão continua fora, mesmo sem parede no caminho', () => {
    expect(idsRecebidos(corredor(ficha('guarda', { x: 700 + RAIO_DE_VISAO + 40, y: 250 })))).toEqual(['fabi'])
  })

  it('ficha secreta ou oculta com a borda no vão não chega', () => {
    expect(idsRecebidos(corredor(ficha('guarda', GUARDA_NO_VAO, { secret: true })))).toEqual(['fabi'])
    expect(idsRecebidos(corredor(ficha('guarda', GUARDA_NO_VAO, { hidden: true })))).toEqual(['fabi'])
  })

  it('guarda com o centro em zona oculta não chega, mesmo com a borda fora dela e na luz', () => {
    const zona: ConcealZone = { id: 'z1', name: 'Emboscada', revealed: false, points: quadradoNoCentro() }
    const map = corredor(ficha('guarda', GUARDA_NO_VAO), { concealZones: [zona] })
    expect(ve(map, BORDA_NA_LUZ)).toBe(true)
    expect(idsRecebidos(map)).toEqual(['fabi'])
  })

  it('guarda com o centro em sala secreta não chega, mesmo com a borda fora dela e na luz', () => {
    const map = corredor(ficha('guarda', GUARDA_NO_VAO), { regions: [sala('secreta', { secret: true })] })
    expect(idsRecebidos(map)).toEqual(['fabi'])
  })

  it('guarda com o centro sob teto fechado não chega, mesmo com a borda fora do teto e na luz', () => {
    const map = corredor(ficha('guarda', GUARDA_NO_VAO), {
      regions: [sala('casinha', { room: { shape: 'rect', name: 'Casinha', roof: true } })],
    })
    expect(idsRecebidos(map)).toEqual(['fabi'])
  })
})
