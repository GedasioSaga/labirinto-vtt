/**
 * A ESTEIRA APARECE NO MAPA DO MESTRE: setas finas no chão da sala-esteira,
 * apontando para onde ela empurra; linha fina de pino a pino da cabine; anel
 * fino no pino de viagem com cabine ao par. Sem nada disso no mapa, nada.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { ficha, torre } from './__fixtures__/hazardTower'
import { CHEVRON_SPACING_CELLS, MAX_CHEVRONS_PER_ROOM, NO_CONVEYOR_MARKS, conveyorMarks } from './conveyorMarks'

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: '', image: null, ...extra }
}

const esteira = (direction: 'norte' | 'sul' | 'leste' | 'oeste'): Partial<MapData> => ({
  conveyors: [{ id: 'e1', roomId: 'sala-a', direction, stepCells: 3 }],
})

describe('conveyorMarks — o que o mestre vê da esteira e da cabine', () => {
  it('mapa sem esteira nem cabine não desenha nada', () => {
    expect(conveyorMarks({ ...torre({ tokens: [ficha('ana', 75, 75)] }), pins: [pino('p1', 75, 75)] })).toBe(NO_CONVEYOR_MARKS)
  })

  it('sala-esteira para o leste: setas só dentro da sala A, a cada 2 casas, com a ponta à direita do centro', () => {
    const marks = conveyorMarks({ ...torre(), ...esteira('leste') })
    // Sala A: 500 × 400 px, grade 50 → 10 × 8 casas; uma seta a cada 2 casas → 5 × 4.
    expect(CHEVRON_SPACING_CELLS).toBe(2)
    expect(marks.chevrons).toHaveLength(20)
    for (const chevron of marks.chevrons) {
      expect(chevron.tip.x).toBeGreaterThan(chevron.left.x)
      expect(chevron.left.x).toBe(chevron.right.x)
      expect(chevron.tip.x).toBeLessThan(500)
      expect(chevron.tip.y).toBeCloseTo((chevron.left.y + chevron.right.y) / 2)
    }
    expect(marks.links).toEqual([])
    expect(marks.parRings).toEqual([])
  })

  it('a direção vira a seta: norte aponta para cima (y menor), oeste para a esquerda', () => {
    const norte = conveyorMarks({ ...torre(), ...esteira('norte') }).chevrons[0]
    expect(norte?.tip.y).toBeLessThan(norte?.left.y ?? Number.NaN)
    expect(norte?.left.y).toBe(norte?.right.y)
    const oeste = conveyorMarks({ ...torre(), ...esteira('oeste') }).chevrons[0]
    expect(oeste?.tip.x).toBeLessThan(oeste?.left.x ?? Number.NaN)
    expect(oeste?.left.x).toBe(oeste?.right.x)
  })

  it('esteira de sala apagada não desenha; sala gigante tem teto de setas', () => {
    expect(conveyorMarks({ ...torre(), conveyors: [{ id: 'e1', roomId: 'sumiu', direction: 'sul', stepCells: 3 }] })).toBe(NO_CONVEYOR_MARKS)
    const base = torre()
    const gigante: MapData = {
      ...base,
      width: 400,
      height: 400,
      regions: base.regions.map((r) =>
        r.id === 'sala-a' ? { ...r, points: [{ x: 0, y: 0 }, { x: 20000, y: 0 }, { x: 20000, y: 20000 }, { x: 0, y: 20000 }] } : r,
      ),
      ...esteira('sul'),
    }
    expect(conveyorMarks(gigante).chevrons).toHaveLength(MAX_CHEVRONS_PER_ROOM)
  })

  it('cabine na cena: linha do pino à próxima parada; cabine ao par: anel no pino de viagem', () => {
    const map: MapData = {
      ...torre(),
      pins: [
        pino('a1', 75, 75, { cabineContinua: 'a2' }),
        pino('a2', 375, 325),
        pino('poco', 1275, 75, { kind: 'viagem', destino: { sceneId: 'porao', pinId: 'poco-porao' }, cabineContinua: 'poco-porao' }),
        pino('orfa', 225, 225, { cabineContinua: 'sumiu' }),
      ],
    }
    const marks = conveyorMarks(map)
    expect(marks.chevrons).toEqual([])
    expect(marks.links).toEqual([{ from: { x: 75, y: 75 }, to: { x: 375, y: 325 } }])
    expect(marks.parRings).toEqual([{ center: { x: 1275, y: 75 }, radius: 22.5 }])
  })
})
