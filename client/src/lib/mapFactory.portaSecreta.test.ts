import { describe, expect, it } from 'vitest'
import { isDoorPassable } from './collision'
import { createEmptyMap, revealSecretPassage, setDoorSecret } from './mapFactory'
import type { MapData, Region, Wall } from '../types/map'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, x1: number, y1: number, x2: number, y2: number, secret: boolean): Region {
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
    room: { shape: 'rect', name: id },
    secret,
  }
}

/** Biblioteca | Quarto oculto (porta secreta na aresta comum) e, longe, um Cofre também oculto. */
function mapa(): MapData {
  return {
    ...createEmptyMap('m', 'Mansao', 1600, 600, 50),
    walls: [
      parede('bib-l1', 900, 100, 900, 250, { regionId: 'r-bib' }),
      parede('porta', 900, 250, 900, 300, { regionId: 'r-bib', door: { open: false, locked: true, kind: 'normal', secret: true } }),
      parede('outra', 100, 0, 100, 50, { door: { open: false, locked: false, kind: 'normal' } }),
    ],
    regions: [sala('r-bib', 500, 100, 900, 450, false), sala('r-quarto', 900, 100, 1150, 450, true), sala('r-cofre', 1300, 100, 1500, 300, true)],
  }
}

describe('mapFactory: porta secreta', () => {
  it("'Revelar passagem' desliga o segredo da porta e da sala ligada, e só dela", () => {
    const out = revealSecretPassage(mapa(), 'porta')
    const porta = out.walls.find((w) => w.id === 'porta')
    expect(porta?.door).toEqual({ open: false, locked: true, kind: 'normal' })
    expect(out.regions.find((r) => r.id === 'r-quarto')?.secret).toBe(false)
    // Sala oculta que não encosta na porta continua oculta.
    expect(out.regions.find((r) => r.id === 'r-cofre')?.secret).toBe(true)
    expect(out.regions.find((r) => r.id === 'r-bib')?.secret).toBe(false)
  })

  it('revela também a sala a que a própria porta pertence (vínculo da porta)', () => {
    const base = mapa()
    const m: MapData = { ...base, walls: base.walls.map((w) => (w.id === 'porta' ? { ...w, regionId: 'r-cofre' } : w)) }
    const out = revealSecretPassage(m, 'porta')
    expect(out.regions.find((r) => r.id === 'r-cofre')?.secret).toBe(false)
    expect(out.regions.find((r) => r.id === 'r-quarto')?.secret).toBe(false)
  })

  it('porta comum ou parede inexistente: devolve o mesmo mapa', () => {
    const m = mapa()
    expect(revealSecretPassage(m, 'outra')).toBe(m)
    expect(revealSecretPassage(m, 'nao-existe')).toBe(m)
  })

  it('marcar como secreta fecha a porta; desmarcar tira o campo', () => {
    const m = setDoorSecret({ ...mapa(), walls: [parede('p', 0, 0, 50, 0, { door: { open: true, locked: false, kind: 'double' } })] }, 'p', true)
    expect(m.walls[0]?.door).toEqual({ open: false, locked: false, kind: 'double', secret: true })
    const volta = setDoorSecret(m, 'p', false)
    expect(volta.walls[0]?.door).toEqual({ open: false, locked: false, kind: 'double' })
    expect(volta.walls[0]?.door).not.toHaveProperty('secret')
  })

  it('porta secreta não deixa passar nem aberta; revelada e aberta, deixa', () => {
    expect(isDoorPassable({ open: true, locked: false, kind: 'normal', secret: true })).toBe(false)
    expect(isDoorPassable({ open: true, locked: false, kind: 'normal' })).toBe(true)
  })
})
