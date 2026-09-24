import { describe, expect, it } from 'vitest'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import type { ConcealZone, DoorState, MapData, Region, Wall } from '../types/map'

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

/** Zona oculta na faixa y 400..600 com o pincel de revelar pintado nas colunas `col0..col1` (células de 10 px). */
function zonaPintada(col0: number, col1: number, row0: number, row1: number): ConcealZone {
  const unveiledCells: string[] = []
  for (let col = col0; col <= col1; col += 1) for (let row = row0; row <= row1; row += 1) unveiledCells.push(`${col},${row}`)
  return {
    id: 'z',
    name: 'Ala',
    revealed: false,
    points: [
      { x: 0, y: 400 },
      { x: 1000, y: 400 },
      { x: 1000, y: 600 },
      { x: 0, y: 600 },
    ],
    unveiledCells,
  }
}

describe('fogFilter: porta secreta', () => {
  it('SEGURANÇA: sai como parede comum, fora de visibleDoorIds, sem o campo secret', () => {
    const view = filterMapForPlayer(corredor(porta()), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.every((w) => w.door === null && w.blocksLight && w.blocksMove)).toBe(true)
    expect(view.visibleDoorIds).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain('secret')
  })

  it('SEGURANÇA: a parede chega INTEIRA, sem a quebra que marcaria as pontas da porta nem o id dela', () => {
    const view = filterMapForPlayer(corredor(porta()), 'p', { p: ['t'] }, 400)
    // O pedaço de 50 px entre 'n1' e 'n2' denunciava a porta na rede. Agora é
    // uma parede só, com o id da vizinha de onde a reta começa.
    expect(view.map.walls).toEqual([{ id: 'n1', x1: 0, y1: 500, x2: 1000, y2: 500, blocksLight: true, blocksMove: true, door: null }])
    expect(JSON.stringify(view.map)).not.toContain('"pn"')
  })

  it('SEGURANÇA: a junção guarda a cara da parede e segue a reta de onde ela começa', () => {
    const cara: Partial<Wall> = { wallKind: 'interior', thickness: 'thin', lineStyle: 'straight' }
    const map: MapData = {
      ...corredor(porta()),
      // Os pedaços fora de ordem na lista e a reta de trás para a frente: quem dá o id é a ponta de onde a reta começa.
      walls: [
        parede('b', 500, 500, 0, 500, { ...cara }),
        parede('segredo', 1000, 500, 500, 500, { ...cara, door: porta() }),
        parede('solta', 0, 800, 1000, 800),
      ],
    }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    expect(view.map.walls).toEqual([
      { id: 'b', x1: 1000, y1: 500, x2: 0, y2: 500, blocksLight: true, blocksMove: true, door: null, ...cara },
      { id: 'solta', x1: 0, y1: 800, x2: 1000, y2: 800, blocksLight: true, blocksMove: true, door: null },
    ])
  })

  it('SEGURANÇA: duas portas secretas na mesma parede somem numa parede só', () => {
    const map: MapData = {
      ...corredor(porta()),
      walls: [
        parede('a', 0, 500, 200, 500),
        parede('s1', 200, 500, 250, 500, { door: porta() }),
        parede('meio', 250, 500, 700, 500),
        parede('s2', 700, 500, 750, 500, { door: porta({ open: true }) }),
        parede('c', 750, 500, 1000, 500),
      ],
    }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    expect(view.map.walls).toEqual([{ id: 'a', x1: 0, y1: 500, x2: 1000, y2: 500, blocksLight: true, blocksMove: true, door: null }])
  })

  it('vizinha de outra cara não é engolida: a quebra ali já existia no mapa do mestre', () => {
    const map: MapData = {
      ...corredor(porta()),
      walls: [
        parede('n1', 0, 500, 450, 500),
        parede('pn', 450, 500, 500, 500, { door: porta() }),
        parede('grossa', 500, 500, 1000, 500, { thickness: 'thick' }),
      ],
    }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    expect(view.map.walls).toEqual([
      { id: 'n1', x1: 0, y1: 500, x2: 500, y2: 500, blocksLight: true, blocksMove: true, door: null },
      { id: 'grossa', x1: 500, y1: 500, x2: 1000, y2: 500, blocksLight: true, blocksMove: true, door: null, thickness: 'thick' },
    ])
  })

  it('porta revelada volta a chegar partida, com a porta no meio', () => {
    const view = filterMapForPlayer(corredor({ open: false, locked: false, kind: 'normal' }), 'p', { p: ['t'] }, 400)
    expect(view.map.walls.map((w) => w.id)).toEqual(['n1', 'pn', 'n2'])
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
  it('SEGURANÇA: dentro de zona oculta com o pincel, a porta não chega como pedaço à parte nem com o id dela', () => {
    const map: MapData = { ...corredor(porta()), concealZones: [zonaPintada(0, 99, 40, 59)] }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    // O recorte do pincel renomeia os pedaços ('<id>~pincel<n>'): a junção
    // tem que reconhecer a porta pelo id de origem, senão o trecho de 50 px
    // com o id da porta sai sozinho no pacote.
    expect(view.map.walls).toHaveLength(1)
    expect(view.map.walls[0]).toMatchObject({ id: 'n1~pincel0', x1: 0, y1: 500, y2: 500, door: null, blocksLight: true, blocksMove: true })
    expect(view.map.walls[0]?.x2).toBeGreaterThan(990)
    expect(JSON.stringify(view.map)).not.toContain('pn')
  })

  it('SEGURANÇA: pincel só em volta da porta também junta os pedaços numa parede só', () => {
    const map: MapData = { ...corredor(porta()), concealZones: [zonaPintada(44, 50, 49, 50)] }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    expect(view.map.walls).toHaveLength(1)
    const [w] = view.map.walls
    expect(w?.id).toBe('n1~pincel0')
    expect(w?.x1).toBeLessThan(450)
    expect(w?.x2).toBeGreaterThan(500)
    expect(JSON.stringify(view.map)).not.toContain('pn')
  })

  it('porta revelada na zona pintada continua porta, entre os pedaços do pincel', () => {
    const map: MapData = { ...corredor({ open: false, locked: false, kind: 'normal' }), concealZones: [zonaPintada(0, 99, 40, 59)] }
    const view = filterMapForPlayer(map, 'p', { p: ['t'] }, 400)
    expect(view.map.walls.map((w) => w.id)).toEqual(['n1~pincel0', 'pn', 'n2~pincel0'])
    expect(view.map.walls.find((w) => w.id === 'pn')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
  })
})
