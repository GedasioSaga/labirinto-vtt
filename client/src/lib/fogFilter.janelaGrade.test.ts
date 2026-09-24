import { describe, expect, it } from 'vitest'
import type { DoorState, MapData, Prop, Region, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * JANELA, GRADE E ESPIAR, lado da REDE: o que cada jogador RECEBE.
 *
 * Adega (sem teto): parede em x=500 com uma GRADE no meio (y 250..350); Carla
 * em (400, 300) e o rato do outro lado em (700, 300).
 *
 * Armazém (teto): 500..900 x 100..500. Parede oeste com JANELA (y 250..350),
 * divisória interna em x=700. Guarda em (600, 300), bem na frente da janela;
 * ladrão em (800, 300), atrás da divisória; caixa em (530, 130), no canto que
 * a janela não mostra. Ana encostada na janela (460, 300); Bia longe (150, 300),
 * vendo a janela mas não junto dela.
 */
const GRID = 50
const RADIUS = 900

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function porta(extra: Partial<DoorState> = {}): DoorState {
  return { open: false, locked: false, kind: 'normal', ...extra }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function predio(id: string, x1: number, y1: number, x2: number, y2: number): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#222',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `nome-${id}`, roof: true },
  }
}

function adega(grade: DoorState): MapData {
  return {
    ...createEmptyMap('m-adega', 'Adega', 20, 12, GRID),
    walls: [parede('n', 500, 0, 500, 250), parede('grade', 500, 250, 500, 350, { door: grade }), parede('s', 500, 350, 500, 600)],
    tokens: [ficha('carla', 400, 300), ficha('rato', 700, 300)],
  }
}

const OESTE_JANELA: Partial<Wall> = { janela: true }

function armazem(vao: Partial<Wall>, jogadores: Token[]): MapData {
  const caixa: Prop = { id: 'caixa-do-canto', x: 530, y: 130, width: 20, height: 20, src: 'caixa.png', linkedMapPath: null }
  return {
    ...createEmptyMap('m-armazem', 'Porto', 20, 12, GRID),
    regions: [predio('armazem', 500, 100, 900, 500)],
    walls: [
      parede('arm-n', 500, 100, 900, 100),
      parede('arm-l', 900, 100, 900, 500),
      parede('arm-s', 900, 500, 500, 500),
      parede('arm-o1', 500, 100, 500, 250),
      parede('vao', 500, 250, 500, 350, vao),
      parede('arm-o2', 500, 350, 500, 500),
      parede('divisoria', 700, 100, 700, 500),
    ],
    props: [caixa],
    tokens: [...jogadores, ficha('guarda', 600, 300), ficha('ladrao', 800, 300)],
  }
}

const ANA = ficha('ana', 460, 300)
const BIA = ficha('bia', 150, 300)
const POSSE = { pAna: ['ana'], pBia: ['bia'] }

function recebidos(map: MapData, playerId: string, peek?: ReadonlySet<string>) {
  const view = filterMapForPlayer(map, playerId, POSSE, RADIUS, undefined, undefined, undefined, undefined, peek)
  return { view, json: JSON.stringify(view.map), tokenIds: view.map.tokens.map((t) => t.id).sort() }
}

describe('grade: deixa ver, não deixa passar', () => {
  it('Carla vê o rato pela grade fechada (e trancada)', () => {
    const carla = filterMapForPlayer(adega(porta({ kind: 'gate', locked: true })), 'pC', { pC: ['carla'] }, RADIUS)
    expect(carla.map.tokens.map((t) => t.id).sort()).toEqual(['carla', 'rato'])
    // A grade sai como estava: fechada e trancada.
    expect(carla.map.walls.find((w) => w.id === 'grade')?.door).toEqual(porta({ kind: 'gate', locked: true }))
  })

  it('porta comum fechada no mesmo lugar esconde o rato (controle)', () => {
    const carla = filterMapForPlayer(adega(porta()), 'pC', { pC: ['carla'] }, RADIUS)
    expect(carla.map.tokens.map((t) => t.id)).toEqual(['carla'])
    expect(carla.map.walls.find((w) => w.id === 'grade')?.door).toEqual(porta())
  })
})

describe('janela de prédio com teto: só o que o olhar alcança, para quem está junto dela', () => {
  it('Ana, junto da janela, recebe o guarda e não recebe o ladrão (atrás da divisória) nem a caixa do canto', () => {
    const { view, json, tokenIds } = recebidos(armazem(OESTE_JANELA, [ANA, BIA]), 'pAna')
    // Bia está na rua, à vista: chega também.
    expect(tokenIds).toEqual(['ana', 'bia', 'guarda'])
    expect(json).not.toContain('ladrao')
    expect(json).not.toContain('caixa-do-canto')
    // O prédio continua silhueta: teto ligado, nome escondido.
    const armazemOut = view.map.regions.find((r) => r.id === 'armazem')
    expect(armazemOut?.room?.roof).toBe(true)
    expect(json).not.toContain('nome-armazem')
    // O recorte do cone vai junto, para a tela dela abrir o telhado ali e só ali.
    expect(view.glimpses.length).toBeGreaterThan(0)
    for (const p of view.glimpses.flat()) {
      expect(p.x).toBeGreaterThanOrEqual(500)
      expect(p.x).toBeLessThanOrEqual(900)
      expect(p.y).toBeGreaterThanOrEqual(100)
      expect(p.y).toBeLessThanOrEqual(500)
    }
    // Nada do cone passa da divisória: o ladrão fica em silhueta.
    expect(Math.max(...view.glimpses.flat().map((p) => p.x))).toBeLessThanOrEqual(710)
  })

  it('a divisória que o olhar alcança chega, a janela chega marcada', () => {
    const { view } = recebidos(armazem(OESTE_JANELA, [ANA]), 'pAna')
    expect(view.map.walls.some((w) => w.id.startsWith('divisoria'))).toBe(true)
    expect(view.map.walls.find((w) => w.id === 'vao')?.janela).toBe(true)
  })

  it('SEGURANÇA: Bia, longe da janela, não recebe nada de dentro — nem o guarda à vista pela janela', () => {
    const { view, json, tokenIds } = recebidos(armazem(OESTE_JANELA, [ANA, BIA]), 'pBia')
    // Ana está do lado de fora, à vista: ela chega; de dentro, nada.
    expect(tokenIds).toEqual(['ana', 'bia'])
    expect(json).not.toContain('guarda')
    expect(json).not.toContain('divisoria')
    expect(view.glimpses).toEqual([])
  })

  it('SEGURANÇA: parede comum no lugar da janela não mostra nada, nem colada nela', () => {
    const { view, tokenIds, json } = recebidos(armazem({}, [ANA]), 'pAna')
    expect(tokenIds).toEqual(['ana'])
    expect(json).not.toContain('divisoria')
    expect(view.glimpses).toEqual([])
  })

  it('porta ABERTA do prédio faz o mesmo que a janela', () => {
    const { tokenIds, view } = recebidos(armazem({ door: porta({ open: true }) }, [ANA]), 'pAna')
    expect(tokenIds).toEqual(['ana', 'guarda'])
    expect(view.glimpses.length).toBeGreaterThan(0)
  })
})

describe("'Espiar' em porta fechada: cone só para quem espiou, porta segue fechada", () => {
  const escritorio = (): MapData => armazem({ door: porta({ locked: true }) }, [ANA, ficha('bia', 460, 320)])

  it('Ana espiando recebe o guarda; a porta chega fechada e trancada', () => {
    const { view, tokenIds } = recebidos(escritorio(), 'pAna', new Set(['vao']))
    expect(tokenIds).toContain('guarda')
    expect(tokenIds).not.toContain('ladrao')
    expect(view.map.walls.find((w) => w.id === 'vao')?.door).toEqual(porta({ locked: true }))
    expect(view.glimpses.length).toBeGreaterThan(0)
  })

  it('SEGURANÇA: sem espiar, a mesma Ana não recebe nada de dentro', () => {
    const { tokenIds, view } = recebidos(escritorio(), 'pAna')
    expect(tokenIds).not.toContain('guarda')
    expect(view.glimpses).toEqual([])
  })

  it('porta espiada em sala SEM teto também só mostra a quem espiou', () => {
    const map = adega(porta())
    const espiando = filterMapForPlayer(map, 'pC', { pC: ['carla'] }, RADIUS, undefined, undefined, undefined, undefined, new Set(['grade']))
    expect(espiando.map.tokens.map((t) => t.id).sort()).toEqual(['carla', 'rato'])
    expect(espiando.map.walls.find((w) => w.id === 'grade')?.door).toEqual(porta())
  })
})
