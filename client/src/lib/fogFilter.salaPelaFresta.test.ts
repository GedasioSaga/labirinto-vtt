import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapData, Region, Token, Wall } from '../types/map'
import { createExploration, markRings } from './exploration'
import { emptyPlanMemory, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * SALA VISTA PELA FRESTA DA PORTA. O cone que entra por uma porta estreita
 * numa sala larga e baixa (o "Porto" do mapa do usuário) não alcança o
 * centróide nem os cantos da sala. Antes, a Sala só saía para o jogador quando
 * uma dessas amostras caía no cone: o jogador via o chão cru por dentro do
 * cone (verde e azul, com chão pintado), sem a cor da Sala, sem o nome e sem
 * a memória dela ao sair.
 *
 * Geometria (px de mundo, 1000 x 1000, grade 40):
 *   porto   100..900 x 500..600, Sala sem teto; porta ABERTA no muro norte,
 *           x 600..640 em y = 500;
 *   herói   (620, 440), 60 px ao norte da porta;
 *   cone    da porta até o muro sul, x ~567..673 em y = 600 — longe do
 *           centróide (500, 550) e dos quatro cantos.
 */
const PORTO: Region['points'] = [
  { x: 100, y: 500 },
  { x: 900, y: 500 },
  { x: 900, y: 600 },
  { x: 100, y: 600 },
]
const RADIUS = 700
const OWNERSHIP = { p1: ['heroi'] }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function ficha(x: number, y: number): Token {
  return { id: 'heroi', characterId: null, name: 'Heroi', x, y, size: 1, image: null }
}

function chao(): FloorPiece {
  return { id: 'chao', shape: { kind: 'rect', cx: 500, cy: 500, w: 1000, h: 1000 }, op: 'add', modifiers: {}, fillColor: '#023201' }
}

function cais(portaAberta: boolean, floor: FloorPiece[] = []): MapData {
  return {
    ...createEmptyMap('m-cais', 'Cais', 25, 25, 40),
    regions: [{ id: 'porto', points: PORTO, tag: '', fillColor: '#46403f', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Porto' } }],
    walls: [
      parede('norte-a', 100, 500, 600, 500, { regionId: 'porto' }),
      parede('porta', 600, 500, 640, 500, { regionId: 'porto', door: { open: portaAberta, locked: false, kind: 'normal' } }),
      parede('norte-b', 640, 500, 900, 500, { regionId: 'porto' }),
      parede('leste', 900, 500, 900, 600, { regionId: 'porto' }),
      parede('sul', 900, 600, 100, 600, { regionId: 'porto' }),
      parede('oeste', 100, 600, 100, 500, { regionId: 'porto' }),
    ],
    floor,
    tokens: [ficha(620, 440)],
  }
}

describe('filterMapForPlayer — sala vista pela fresta da porta', () => {
  it('o cone entra pela porta aberta: a Sala sai com cor e nome, mesmo sem amostra no cone', () => {
    const view = filterMapForPlayer(cais(true), 'p1', OWNERSHIP, RADIUS)
    expect(view.map.regions.map((r) => r.room?.name)).toEqual(['Porto'])
  })

  it('com chão pintado por baixo, o resultado é o mesmo', () => {
    const view = filterMapForPlayer(cais(true, [chao()]), 'p1', OWNERSHIP, RADIUS)
    expect(view.map.regions.map((r) => r.room?.name)).toEqual(['Porto'])
  })

  it('com memória, como o host: vista pela fresta, a Sala continua lembrada depois que ele se afasta', () => {
    const exp = createExploration({ width: 1000, height: 1000, grid: 40 })
    let memory = emptyPlanMemory()
    const ver = (map: MapData) => {
      const view = filterMapForPlayer(map, 'p1', OWNERSHIP, RADIUS, exp, new Map(), undefined, undefined, undefined, undefined, undefined, undefined, undefined, memory)
      markRings(exp, view.vision, view.blocked)
      memory = view.plan
      return view
    }
    expect(ver(cais(true, [chao()])).map.regions.map((r) => r.room?.name)).toEqual(['Porto'])
    const longe = { ...cais(true, [chao()]), tokens: [ficha(620, 100)] }
    expect(ver(longe).map.regions.map((r) => r.room?.name)).toEqual(['Porto'])
  })

  it('porta fechada: o cone não entra e a Sala não sai', () => {
    const view = filterMapForPlayer(cais(false), 'p1', OWNERSHIP, RADIUS)
    expect(view.map.regions).toEqual([])
  })
})
