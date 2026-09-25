import { describe, expect, it } from 'vitest'
import { createEmptyMap, setDoorOpensFrom } from './mapFactory'
import type { MapData, Wall } from '../types/map'

function parede(id: string, extra: Partial<Wall> = {}): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function mapa(): MapData {
  return {
    ...createEmptyMap('m', 'Castelo', 500, 500, 50),
    walls: [parede('porta', { door: { open: true, locked: false, kind: 'gate' } }), parede('solida')],
  }
}

describe('mapFactory.setDoorOpensFrom', () => {
  it('liga o lado sem mexer no resto da porta', () => {
    const depois = setDoorOpensFrom(mapa(), 'porta', 'left')
    expect(depois.walls[0]?.door).toEqual({ open: true, locked: false, kind: 'gate', opensFrom: 'left' })
  })

  it("'os dois lados' (null) tira o campo", () => {
    const umLado = setDoorOpensFrom(mapa(), 'porta', 'right')
    const dois = setDoorOpensFrom(umLado, 'porta', null)
    expect(dois.walls[0]?.door).toEqual({ open: true, locked: false, kind: 'gate' })
    expect(JSON.stringify(dois)).not.toContain('opensFrom')
  })

  it('parede sem porta ou inexistente: mesma referência', () => {
    const m = mapa()
    expect(setDoorOpensFrom(m, 'solida', 'left')).toBe(m)
    expect(setDoorOpensFrom(m, 'nao-existe', 'left')).toBe(m)
  })
})
