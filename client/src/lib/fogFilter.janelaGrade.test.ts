import { describe, expect, it } from 'vitest'
import type { DoorState, FloorPiece, MapData, Prop, Region, RegionPoint, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { pointInRing } from './floorContour'
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
  const view = filterMapForPlayer(map, playerId, POSSE, RADIUS, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, peek)
  return { view, json: JSON.stringify(view.map), tokenIds: view.map.tokens.map((t) => t.id).sort() }
}

describe('grade: deixa ver, não deixa passar', () => {
  it('Carla vê o rato pela grade fechada (e trancada)', () => {
    const carla = filterMapForPlayer(adega(porta({ kind: 'gate', locked: true })), 'pC', { pC: ['carla'] }, RADIUS)
    expect(carla.map.tokens.map((t) => t.id).sort()).toEqual(['carla', 'rato'])
    // A grade sai fechada; o cadeado nunca sai (PORTA TRANCADA VIRA PEDIDO: o jogador descobre tentando).
    expect(carla.map.walls.find((w) => w.id === 'grade')?.door).toEqual(porta({ kind: 'gate' }))
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

/**
 * PRÉDIO COM CHÃO PRÓPRIO — o que o balde cria ao encher o interior fechado por
 * paredes (`floorTool.baldeNoPonto`). A rua é uma peça (0..500) e o armazém
 * outra (500..900 x 100..500). O chão do prédio sai da conta do jogador
 * (teto fechado), e sem ele a borda do chão da rua passava bem na janela.
 */
function retangulo(id: string, x1: number, y1: number, x2: number, y2: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: x2 - x1, h: y2 - y1 }, op: 'add', modifiers: {} }
}

function comChao(map: MapData): MapData {
  return { ...map, floor: [retangulo('rua', 0, 0, 500, 600), retangulo('chao-armazem', 500, 100, 900, 500)] }
}

const cobre = (vision: readonly RegionPoint[][], p: RegionPoint): boolean => vision.some((ring) => ring.length >= 3 && pointInRing(p, ring))

describe('prédio com chão próprio (o do balde): o cone pelo vão continua saindo', () => {
  it('Ana junto da janela recebe o guarda, o cone e a visão sobre ele; o ladrão e o chão inteiro não', () => {
    const { view, json, tokenIds } = recebidos(comChao(armazem(OESTE_JANELA, [ANA])), 'pAna')
    expect(tokenIds).toEqual(['ana', 'guarda'])
    expect(json).not.toContain('ladrao')
    expect(view.glimpses.length).toBeGreaterThan(0)
    // Nada do cone passa da divisória.
    expect(Math.max(...view.glimpses.flat().map((p) => p.x))).toBeLessThanOrEqual(710)
    // A visão enviada cobre o guarda: sem isso a névoa preta tampava o buraco do telhado.
    expect(cobre(view.vision, { x: 600, y: 300 })).toBe(true)
    // E não cobre o ladrão, atrás da divisória.
    expect(cobre(view.vision, { x: 800, y: 300 })).toBe(false)
    // O chão do prédio sai só recortado nas células do cone, nunca como a peça inteira.
    expect(view.map.floor.map((f) => f.id)).toEqual(['rua', 'chao-armazem~pincel'])
    const doPredio = view.map.floor.find((f) => f.id === 'chao-armazem~pincel')
    expect(doPredio?.shape.kind).toBe('blocos')
    // Só as células do cone: nada passa da divisória.
    const celulas = doPredio?.shape.kind === 'blocos' ? doPredio.shape : null
    expect(celulas?.cells.length).toBeGreaterThan(0)
    for (const c of celulas?.cells ?? []) expect((c.col + 1) * (celulas?.cell ?? 0)).toBeLessThanOrEqual(710)
  })

  it('porta espiada no escritório com chão próprio: guarda e visão sobre ele', () => {
    const map = comChao(armazem({ door: porta({ locked: true }) }, [ANA]))
    const { view, tokenIds } = recebidos(map, 'pAna', new Set(['vao']))
    expect(tokenIds).toEqual(['ana', 'guarda'])
    expect(view.glimpses.length).toBeGreaterThan(0)
    expect(cobre(view.vision, { x: 600, y: 300 })).toBe(true)
  })

  it('SEGURANÇA: com chão próprio, Bia longe e Ana sem espiar continuam sem nada de dentro', () => {
    const bia = recebidos(comChao(armazem(OESTE_JANELA, [ANA, BIA])), 'pBia')
    expect(bia.tokenIds).toEqual(['ana', 'bia'])
    expect(bia.view.glimpses).toEqual([])
    expect(cobre(bia.view.vision, { x: 600, y: 300 })).toBe(false)
    expect(bia.view.map.floor.map((f) => f.id)).toEqual(['rua'])
    const semEspiar = recebidos(comChao(armazem({ door: porta({ locked: true }) }, [ANA])), 'pAna')
    expect(semEspiar.tokenIds).toEqual(['ana'])
    expect(semEspiar.view.glimpses).toEqual([])
    expect(cobre(semEspiar.view.vision, { x: 600, y: 300 })).toBe(false)
  })
})

describe("'Espiar' em porta fechada: cone só para quem espiou, porta segue fechada", () => {
  const escritorio = (): MapData => armazem({ door: porta({ locked: true }) }, [ANA, ficha('bia', 460, 320)])

  it('Ana espiando recebe o guarda; a porta chega fechada e trancada', () => {
    const { view, tokenIds } = recebidos(escritorio(), 'pAna', new Set(['vao']))
    expect(tokenIds).toContain('guarda')
    expect(tokenIds).not.toContain('ladrao')
    // Trancada no mapa do mestre; para o jogador chega só fechada (PORTA TRANCADA VIRA PEDIDO: o cadeado nunca sai).
    expect(view.map.walls.find((w) => w.id === 'vao')?.door).toEqual(porta())
    expect(view.glimpses.length).toBeGreaterThan(0)
  })

  it('SEGURANÇA: sem espiar, a mesma Ana não recebe nada de dentro', () => {
    const { tokenIds, view } = recebidos(escritorio(), 'pAna')
    expect(tokenIds).not.toContain('guarda')
    expect(view.glimpses).toEqual([])
  })

  it('porta espiada em sala SEM teto também só mostra a quem espiou', () => {
    const map = adega(porta())
    const espiando = filterMapForPlayer(map, 'pC', { pC: ['carla'] }, RADIUS, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new Set(['grade']))
    expect(espiando.map.tokens.map((t) => t.id).sort()).toEqual(['carla', 'rato'])
    expect(espiando.map.walls.find((w) => w.id === 'grade')?.door).toEqual(porta())
  })
})
