import { describe, expect, it } from 'vitest'
import { createExploration, markRings } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import type { DoorState, MapData, Wall } from '../types/map'

/**
 * COR DA PORTA no recorte do jogador (fatia 22): a cor é aparência e vai junto
 * da porta, para a tela dele pintar como a do mestre. A trancada continua
 * chegando fechada comum (sem `locked`), e a secreta sai como parede, sem o campo.
 */
function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** Corredor de paredes soltas: parede norte partida em 3, a do meio é a porta, e a Gabi encostada nela. */
function corredor(door: DoorState, gabi = { x: 475, y: 540 }): MapData {
  return {
    ...createEmptyMap('m', 'Corredor', 1000, 1000, 50),
    walls: [parede('n1', 0, 500, 450, 500), parede('pn', 450, 500, 500, 500, { door }), parede('n2', 500, 500, 1000, 500)],
    tokens: [{ id: 't', characterId: null, name: 'Gabi', ...gabi, size: 1, image: null }],
  }
}

const portaDoRecorte = (map: MapData) => map.walls.find((w) => w.id === 'pn')?.door

describe('fogFilter: cor da porta', () => {
  it('porta à vista leva a cor ao jogador', () => {
    const view = filterMapForPlayer(corredor({ open: false, locked: false, kind: 'normal', cor: '#79a9cc' }), 'p', { p: ['t'] }, 400)
    expect(portaDoRecorte(view.map)).toEqual({ open: false, locked: false, kind: 'normal', cor: '#79a9cc' })
  })

  it('trancada com cor chega fechada comum, com a cor e sem o cadeado', () => {
    const view = filterMapForPlayer(corredor({ open: false, locked: true, kind: 'normal', cor: '#79a9cc', abreCom: 'Chave de ferro' }), 'p', { p: ['t'] }, 400)
    expect(portaDoRecorte(view.map)).toEqual({ open: false, locked: false, kind: 'normal', cor: '#79a9cc' })
  })

  it('sem cor a porta sai sem o campo', () => {
    const view = filterMapForPlayer(corredor({ open: true, locked: false, kind: 'normal' }), 'p', { p: ['t'] }, 400)
    expect(portaDoRecorte(view.map)).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(JSON.stringify(view.map)).not.toContain('"cor"')
  })

  it('porta explorada que ele nunca viu de perto chega fechada, já na cor dela', () => {
    // A Gabi longe da porta (fora da visão), com as células em volta da porta já exploradas.
    // Aberta de verdade: só o caminho da porta nunca vista a entrega fechada.
    const map = corredor({ open: true, locked: false, kind: 'normal', cor: '#e2645a' }, { x: 900, y: 900 })
    const explorado = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    markRings(explorado, [[{ x: 400, y: 450 }, { x: 550, y: 450 }, { x: 550, y: 550 }, { x: 400, y: 550 }]])
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 100, explorado)
    expect(portaDoRecorte(view.map)).toEqual({ open: false, locked: false, kind: 'normal', cor: '#e2645a' })
  })

  it('SEGURANÇA: porta secreta com cor sai como parede, sem o campo', () => {
    const view = filterMapForPlayer(corredor({ open: false, locked: true, kind: 'normal', secret: true, cor: '#79a9cc' }), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.every((w) => w.door === null)).toBe(true)
    expect(JSON.stringify(view.map)).not.toContain('79a9cc')
  })
})
