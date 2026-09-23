import { describe, expect, it } from 'vitest'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import type { DoorState, MapData, Region, Wall } from '../types/map'

/**
 * Recorte do jogador com PORTA SECRETA (`DoorState.secret`): a porta sai como
 * parede comum, sem porta e sem o campo; não entra em `visibleDoorIds` (o host
 * recusa o toque por essa lista) e segura a visão mesmo aberta.
 */
function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function porta(extra: Partial<DoorState> = {}): DoorState {
  return { open: false, locked: false, kind: 'normal', secret: true, ...extra }
}

/** Corredor de paredes soltas (sem Sala): parede norte partida em 3, a do meio é a porta secreta. */
function corredor(door: DoorState): MapData {
  return {
    ...createEmptyMap('m', 'Corredor', 1000, 1000, 50),
    // Pontas a mais de 400 px (o raio) da Gabi: a visão não contorna a parede.
    walls: [parede('n1', 0, 500, 450, 500), parede('pn', 450, 500, 500, 500, { door }), parede('n2', 500, 500, 1000, 500)],
    tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 475, y: 540, size: 1, image: null }],
  }
}

function salaOculta(id: string, x1: number, y1: number, x2: number, y2: number): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Cofre' },
    secret: true,
  }
}

describe('fogFilter: porta secreta', () => {
  it('SEGURANÇA: sai como parede comum, fora de visibleDoorIds, sem o campo secret', () => {
    const view = filterMapForPlayer(corredor(porta()), 'p', { p: ['t'] }, 400)
    const pn = view.map.walls.find((w) => w.id === 'pn')
    expect(pn).toEqual({ id: 'pn', x1: 450, y1: 500, x2: 500, y2: 500, blocksLight: true, blocksMove: true, door: null })
    expect(view.visibleDoorIds).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain('secret')
  })

  it('SEGURANÇA: aberta e secreta, a visão não passa pelo vão', () => {
    const view = filterMapForPlayer(corredor(porta({ open: true })), 'p', { p: ['t'] }, 400)
    expect(view.vision.length).toBe(1)
    expect(Math.min(...view.vision.flat().map((p) => p.y))).toBeGreaterThanOrEqual(499.5)
  })

  it('porta comum no mesmo lugar continua porta, com estado e na lista de portas vistas', () => {
    const view = filterMapForPlayer(corredor({ open: true, locked: false, kind: 'normal' }), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.find((w) => w.id === 'pn')?.door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(view.visibleDoorIds).toEqual(['pn'])
    expect(Math.min(...view.vision.flat().map((p) => p.y))).toBeLessThan(499.5)
  })

  it('SEGURANÇA: porta secreta de sala oculta solta no salão some junto, sem virar toco de parede', () => {
    const map: MapData = {
      ...createEmptyMap('m', 'Salao', 1000, 1000, 50),
      walls: [
        parede('c-n', 400, 300, 600, 300, { regionId: 'r-cofre' }),
        parede('c-l', 600, 300, 600, 500, { regionId: 'r-cofre' }),
        parede('c-s1', 600, 500, 525, 500, { regionId: 'r-cofre' }),
        parede('c-porta', 525, 500, 475, 500, { regionId: 'r-cofre', door: porta() }),
        parede('c-s2', 475, 500, 400, 500, { regionId: 'r-cofre' }),
        parede('c-o', 400, 500, 400, 300, { regionId: 'r-cofre' }),
      ],
      regions: [salaOculta('r-cofre', 400, 300, 600, 500)],
      tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 500, y: 700, size: 1, image: null }],
    }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 600)
    expect(view.map.walls).toEqual([])
    expect(view.visibleDoorIds).toEqual([])
  })
})
