import { describe, expect, it } from 'vitest'
import type { DoorState, MapData, Pin, Region, Token, Wall } from '../types/map'
import { createExploration, markAll } from './exploration'
import { pointInRing } from './floorContour'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * DENTRO DA SALA SECRETA DÁ PARA VER O CÔMODO — a ficha que está ESTRITAMENTE
 * dentro de uma Sala "Oculta para jogadores" vê o próprio cômodo (paredes,
 * porta, nome, chão) e o pino por onde veio, em vez de um vazio. A sala abre
 * SÓ para o dono daquela ficha: o colega na Biblioteca continua sem nada dela.
 * Pino secreto e sub-sala secreta continuam escondidos mesmo lá dentro.
 *
 * Planta: Biblioteca x 500-900, y 100-450; Quarto Secreto x 900-1150,
 * y 100-450 (secret), com a estante trancada em x = 900, y 250-300.
 */
const ownership = { p1: ['ana'], p2: ['bia'] }
const RADIUS = 700
const trancada: DoorState = { open: false, locked: true, kind: 'normal' }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Region> = {}): Region {
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
    room: { shape: 'rect', name: nome },
    ...extra,
  }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: `desc-${id}`, image: null, ...extra }
}

function mansao(fichas: Token[]): MapData {
  const bib: Partial<Wall> = { regionId: 'r-bib' }
  const sec: Partial<Wall> = { regionId: 'r-secreto' }
  const cofre: Partial<Wall> = { regionId: 'r-cofre' }
  return {
    ...createEmptyMap('map_estante', 'Mansao', 1200, 600, 50),
    walls: [
      parede('bib-n', 500, 100, 900, 100, bib),
      parede('bib-l1', 900, 100, 900, 250, bib),
      parede('bib-l2', 900, 300, 900, 450, bib),
      parede('bib-s', 900, 450, 500, 450, bib),
      parede('bib-o', 500, 450, 500, 100, bib),
      parede('estante', 900, 250, 900, 300, { ...sec, door: trancada }),
      parede('sec-n', 900, 100, 1150, 100, sec),
      parede('sec-l', 1150, 100, 1150, 450, sec),
      parede('sec-s', 1150, 450, 900, 450, sec),
      // Cofre: sub-sala SECRETA dentro do Quarto Secreto, no canto nordeste.
      parede('cofre-o', 1100, 100, 1100, 150, cofre),
      parede('cofre-s', 1100, 150, 1150, 150, cofre),
    ],
    regions: [
      sala('r-bib', 'Biblioteca', 500, 100, 900, 450),
      sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450, { secret: true }),
      // Nicho: sub-sala comum do Quarto Secreto — abre junto com ele.
      sala('r-nicho', 'Nicho', 950, 350, 1050, 450, { parentId: 'r-secreto' }),
      sala('r-cofre', 'Cofre', 1100, 100, 1150, 150, { parentId: 'r-secreto', secret: true }),
    ],
    pins: [
      // O pino por onde a Ana chegou ao quarto.
      pino('pino-chegada', 1000, 275),
      // Pista que o mestre deixou secreta: continua secreta mesmo lá dentro.
      pino('pino-secreto', 1050, 200, { kind: 'interrogacao', secret: true }),
      pino('pino-cofre', 1125, 125, { kind: 'exclamacao' }),
    ],
    tokens: fichas,
  }
}

describe('dentro da sala secreta: a ficha vê o próprio cômodo', () => {
  it('Ana dentro do Quarto Secreto recebe a sala com o nome, as paredes, a estante e o pino por onde veio', () => {
    const view = filterMapForPlayer(mansao([ficha('ana', 1000, 275)]), 'p1', ownership, RADIUS)
    const quarto = view.map.regions.find((r) => r.id === 'r-secreto')
    expect(quarto?.room?.name).toBe('Quarto Secreto')
    // O marcador de "oculta" é do editor do mestre: a sala chega como qualquer outra.
    expect(quarto?.secret).toBeUndefined()
    const paredes = view.map.walls.map((w) => w.id)
    for (const id of ['sec-n', 'sec-l', 'sec-s', 'estante']) expect(paredes).toContain(id)
    expect(view.map.walls.find((w) => w.id === 'estante')?.door).toEqual(trancada)
    expect(view.map.pins.map((p) => p.id)).toContain('pino-chegada')
    // A visão cobre o cômodo, e a sala não entra no balde que a memória recusa.
    expect(pointInRing({ x: 1100, y: 400 }, view.vision[0])).toBe(true)
    expect(view.blocked.some((ring) => pointInRing({ x: 1000, y: 275 }, ring))).toBe(false)
    expect(view.occupiedSecretRooms).toEqual(['r-secreto'])
  })

  it('a sub-sala comum abre junto; a sub-sala SECRETA e o pino secreto continuam escondidos', () => {
    const view = filterMapForPlayer(mansao([ficha('ana', 1000, 275)]), 'p1', ownership, RADIUS)
    expect(view.map.regions.find((r) => r.id === 'r-nicho')?.room?.name).toBe('Nicho')
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('r-cofre')
    expect(json).not.toContain('Cofre')
    expect(json).not.toContain('pino-secreto')
    expect(json).not.toContain('pino-cofre')
    expect(json).not.toContain('"cofre-o"')
  })

  it('SEGURANÇA: Bia, na Biblioteca, não recebe nada do quarto enquanto a Ana está lá dentro — nem a ficha dela', () => {
    const view = filterMapForPlayer(mansao([ficha('ana', 1000, 275), ficha('bia', 825, 275)]), 'p2', ownership, RADIUS)
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('r-secreto')
    expect(json).not.toContain('Quarto Secreto')
    expect(json).not.toContain('pino-chegada')
    expect(json).not.toContain('"ana"')
    for (const id of ['sec-n', 'sec-l', 'sec-s']) expect(json).not.toContain(`"${id}"`)
    expect(view.map.walls.find((w) => w.id === 'estante')?.door).toBeNull()
    expect(view.occupiedSecretRooms).toEqual([])
    expect(view.blocked.some((ring) => pointInRing({ x: 1000, y: 275 }, ring))).toBe(true)
  })

  it('SEGURANÇA: ficha EM CIMA da parede do quarto não abre a sala (na dúvida, fecha)', () => {
    const view = filterMapForPlayer(mansao([ficha('ana', 900, 200)]), 'p1', ownership, RADIUS)
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('r-secreto')
    expect(json).not.toContain('pino-chegada')
    expect(view.occupiedSecretRooms).toEqual([])
  })

  it('sala já descoberta continua no mapa lembrado depois que a Ana sai; sem a descoberta, não', () => {
    const map = mansao([ficha('ana', 825, 275)])
    const explorado = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    markAll(explorado)
    const lembrou = filterMapForPlayer(map, 'p1', ownership, RADIUS, explorado, undefined, undefined, undefined, new Set(['r-secreto']))
    expect(lembrou.map.regions.find((r) => r.id === 'r-secreto')?.room?.name).toBe('Quarto Secreto')
    expect(lembrou.map.pins.map((p) => p.id)).toContain('pino-chegada')
    expect(lembrou.occupiedSecretRooms).toEqual([])
    const semDescoberta = filterMapForPlayer(map, 'p1', ownership, RADIUS, explorado)
    expect(JSON.stringify(semDescoberta.map)).not.toContain('r-secreto')
    expect(JSON.stringify(semDescoberta.map)).not.toContain('pino-chegada')
  })
})

/**
 * SALA SECRETA COM TETO. Descoberta, ela vira cômodo comum para o jogador —
 * mas o teto continua sendo teto: quem está FORA vê a silhueta, não o NPC lá
 * dentro. Cabana x 900-1150, y 100-450, `room.roof`, porta ABERTA em x = 900.
 */
function cabana(fichas: Token[]): MapData {
  const cab: Partial<Wall> = { regionId: 'r-cab' }
  return {
    ...createEmptyMap('map_cabana', 'Clareira', 1200, 600, 50),
    walls: [
      parede('cab-o1', 900, 100, 900, 250, cab),
      parede('cab-porta', 900, 250, 900, 300, { ...cab, door: { open: true, locked: false, kind: 'normal' } }),
      parede('cab-o2', 900, 300, 900, 450, cab),
      parede('cab-n', 900, 100, 1150, 100, cab),
      parede('cab-l', 1150, 100, 1150, 450, cab),
      parede('cab-s', 1150, 450, 900, 450, cab),
    ],
    regions: [
      sala('r-cab', 'Cabana', 900, 100, 1150, 450, { secret: true, room: { shape: 'rect', name: 'Cabana', roof: true } }),
    ],
    tokens: fichas,
  }
}

describe('sala secreta com teto: descoberta não arranca o teto', () => {
  it('SEGURANÇA: Ana fora da cabana descoberta vê o teto fechado e não recebe o NPC lá dentro', () => {
    const view = filterMapForPlayer(
      cabana([ficha('ana', 700, 275), ficha('npc', 1000, 275)]),
      'p1',
      ownership,
      RADIUS,
      undefined,
      undefined,
      undefined,
      undefined,
      new Set(['r-cab']),
    )
    expect(view.map.tokens.map((t) => t.id)).toEqual(['ana'])
    const sala = view.map.regions.find((r) => r.id === 'r-cab')
    expect(sala?.room?.roof).toBe(true)
    expect(sala?.secret).toBeUndefined()
    expect(view.roofs).toHaveLength(1)
  })

  it('Ana DENTRO da cabana secreta abre o teto para ela e vê o NPC', () => {
    const view = filterMapForPlayer(cabana([ficha('ana', 1050, 200), ficha('npc', 1000, 275)]), 'p1', ownership, RADIUS)
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['ana', 'npc'])
    expect(view.map.regions.find((r) => r.id === 'r-cab')?.room?.name).toBe('Cabana')
    expect(view.roofs).toHaveLength(0)
    expect(view.occupiedSecretRooms).toEqual(['r-cab'])
  })
})
