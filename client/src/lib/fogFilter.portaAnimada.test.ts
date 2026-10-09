import { describe, expect, it } from 'vitest'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import type { DoorState, MapData, Wall } from '../types/map'

/**
 * PORTA ANIMADA no recorte do jogador: a animação escolhida é só visual e vai
 * junto da porta, para a tela dele tocar a mesma que a do mestre. Porta
 * secreta continua saindo como parede, sem porta e sem o campo.
 */
function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** Corredor de paredes soltas: parede norte partida em 3, a do meio é a porta, e a Gabi encostada nela. */
function corredor(door: DoorState): MapData {
  return {
    ...createEmptyMap('m', 'Corredor', 1000, 1000, 50),
    walls: [parede('n1', 0, 500, 450, 500), parede('pn', 450, 500, 500, 500, { door }), parede('n2', 500, 500, 1000, 500)],
    tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 475, y: 540, size: 1, image: null }],
  }
}

describe('fogFilter: porta animada', () => {
  it('porta à vista leva a animação ao jogador', () => {
    const view = filterMapForPlayer(corredor({ open: false, locked: false, kind: 'normal', animacao: 'girar' }), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.find((w) => w.id === 'pn')?.door).toEqual({ open: false, locked: false, kind: 'normal', animacao: 'girar' })
  })

  it('sem animação a porta sai sem o campo', () => {
    const view = filterMapForPlayer(corredor({ open: true, locked: false, kind: 'normal' }), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.find((w) => w.id === 'pn')?.door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(JSON.stringify(view.map)).not.toContain('animacao')
  })

  it('SEGURANÇA: porta secreta com animação sai como parede, sem o campo', () => {
    const view = filterMapForPlayer(corredor({ open: false, locked: false, kind: 'normal', secret: true, animacao: 'deslizar' }), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.every((w) => w.door === null)).toBe(true)
    expect(JSON.stringify(view.map)).not.toContain('animacao')
  })
})
