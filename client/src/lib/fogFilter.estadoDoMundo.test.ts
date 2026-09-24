import { describe, expect, it } from 'vitest'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { createExploration, markAll } from './exploration'
import type { ConcealZone, DoorState, MapData, Pin, Wall } from '../types/map'

/**
 * ESTADO DO MUNDO no recorte do jogador: ele recebe só o EFEITO (a porta está
 * aberta, o pino passa livre). A regra (`porEstado`), com o id do estado e os
 * valores que o mestre escreveu ("Maré", "baixa"), nunca sai: diria que existe
 * uma maré mandando naquela porta e qual valor a abre.
 */
const MARE = 'estado_mare_secreto'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function comporta(extra: Partial<DoorState> = {}): DoorState {
  return {
    open: true,
    locked: false,
    kind: 'normal',
    porEstado: {
      estadoId: MARE,
      efeitos: [
        { valor: 'MareAltaDoMestre', efeito: 'trancada' },
        { valor: 'MareBaixaDoMestre', efeito: 'aberta' },
      ],
    },
    ...extra,
  }
}

function alcapao(): Pin {
  return {
    id: 'alcapao',
    x: 475,
    y: 560,
    kind: 'viagem',
    description: 'Alçapão',
    image: null,
    passagem: 'livre',
    porEstado: { estadoId: MARE, efeitos: [{ valor: 'MareBaixaDoMestre', efeito: 'livre' }] },
  }
}

function galeria(): ConcealZone {
  return {
    id: 'galeria',
    name: 'Galeria',
    revealed: false,
    points: [
      { x: 700, y: 700 },
      { x: 900, y: 700 },
      { x: 900, y: 900 },
    ],
    porEstado: { estadoId: MARE, efeitos: [{ valor: 'MareBaixaDoMestre', efeito: 'revelada' }] },
  }
}

/** Corredor: a parede norte partida em 3, a do meio é a comporta; a Gabi está encostada nela. */
function corredor(door: DoorState): MapData {
  return {
    ...createEmptyMap('m', 'Corredor', 1000, 1000, 50),
    walls: [parede('n1', 0, 500, 450, 500), parede('comporta', 450, 500, 500, 500, { door }), parede('n2', 500, 500, 1000, 500)],
    tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 475, y: 540, size: 1, image: null }],
    pins: [alcapao()],
    concealZones: [galeria()],
  }
}

describe('recorte do jogador: estado do mundo sai só como efeito', () => {
  it('a comporta à vista chega aberta, com o estado real, e SEM a regra', () => {
    const view = filterMapForPlayer(corredor(comporta()), 'p', { p: ['t'] }, 400)
    const door = view.map.walls.find((w) => w.id === 'comporta')?.door
    expect(door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(view.visibleDoorIds).toContain('comporta')
  })

  it('SEGURANÇA: nada da regra atravessa — nem o id do estado, nem os valores, nem a chave porEstado', () => {
    const view = filterMapForPlayer(corredor(comporta()), 'p', { p: ['t'] }, 400)
    const json = JSON.stringify(view)
    expect(json).not.toContain('porEstado')
    expect(json).not.toContain(MARE)
    expect(json).not.toContain('MareBaixaDoMestre')
    expect(json).not.toContain('MareAltaDoMestre')
    // O pino chega (está à vista), com a passagem que o estado deixou, sem a regra.
    expect(view.map.pins.map((p) => p.id)).toEqual(['alcapao'])
    expect(view.map.pins[0].passagem).toBe('livre')
  })

  it('SEGURANÇA: porta lembrada (explorada fora da visão) sai com o estado LEMBRADO e sem a regra', () => {
    // A Gabi está longe (fora do raio): a comporta sai só pelo explorado, com o
    // que ela viu da última vez — mesmo que a memória guardasse a regra.
    const map: MapData = { ...corredor(comporta({ open: false, locked: true })), tokens: [{ id: 't', characterId: null, name: 'Gabi', x: 475, y: 950, size: 1, image: null }] }
    const explored = createExploration(map)
    markAll(explored)
    const lembrada = new Map<string, DoorState>([['comporta', comporta({ open: true, locked: false })]])
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 100, explored, lembrada)
    const door = view.map.walls.find((w) => w.id === 'comporta')?.door
    expect(door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(view.visibleDoorIds).not.toContain('comporta')
    expect(JSON.stringify(view)).not.toContain('porEstado')
    expect(JSON.stringify(view)).not.toContain(MARE)
  })
})
