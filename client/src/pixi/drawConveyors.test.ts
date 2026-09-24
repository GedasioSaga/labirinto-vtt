/**
 * A ESTEIRA NO CANVAS DO MESTRE: as setas finas ficam dentro da sala-esteira,
 * com a cor clara da parede, e redesenhar sem esteira apaga as setas velhas.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { MapData } from '../types/map'
import { torre } from '../lib/__fixtures__/hazardTower'
import { NO_CONVEYOR_MARKS, conveyorMarks } from '../lib/conveyorMarks'
import { drawConveyorMarks } from './drawConveyors'

const comEsteira: MapData = { ...torre(), conveyors: [{ id: 'e1', roomId: 'sala-b', direction: 'leste', stepCells: 3 }] }

describe('drawConveyorMarks', () => {
  it('desenha as setas dentro da sala B (500 a 1000 px), e só lá', () => {
    const g = new Graphics()
    drawConveyorMarks(g, conveyorMarks(comEsteira), 1, 1)
    expect(g.context.instructions.length).toBeGreaterThan(0)
    const caixa = g.getLocalBounds()
    expect(caixa.minX).toBeGreaterThanOrEqual(500)
    expect(caixa.maxX).toBeLessThanOrEqual(1000)
  })

  it('cabine ao par desenha o anel em volta do pino de viagem', () => {
    const g = new Graphics()
    const map: MapData = {
      ...torre(),
      pins: [{ id: 'poco', x: 275, y: 175, kind: 'viagem', description: '', image: null, destino: { sceneId: 's2', pinId: 'par' }, cabine: 'par' }],
    }
    drawConveyorMarks(g, conveyorMarks(map), 1, 1)
    expect(g.context.instructions.length).toBeGreaterThan(0)
    const caixa = g.getLocalBounds()
    expect(caixa.minX).toBeGreaterThanOrEqual(275 - 25)
    expect(caixa.maxX).toBeLessThanOrEqual(275 + 25)
  })

  it('sem esteira nem cabine, redesenhar limpa o desenho velho', () => {
    const g = new Graphics()
    drawConveyorMarks(g, conveyorMarks(comEsteira), 1, 1)
    drawConveyorMarks(g, NO_CONVEYOR_MARKS, 1, 1)
    expect(g.context.instructions).toHaveLength(0)
  })
})
