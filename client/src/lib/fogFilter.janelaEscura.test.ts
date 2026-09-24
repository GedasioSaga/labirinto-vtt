import { describe, expect, it } from 'vitest'
import type { Light, MapData, Region, RegionPoint, Token, Wall } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * CONE PELO VÃO x ESCURO. A janela de um prédio de teto fechado abre um cone
 * para a ficha junto dela; o escuro (cena escura, sala escura) decide o que
 * esse cone deixa ver. A pergunta é sempre o que o jogador RECEBE.
 *
 * Armazém (teto): 500..900 x 100..500, janela na parede oeste (y 250..350),
 * divisória interna em x=700. Ana encostada na janela, do lado de fora, em
 * (460, 300). Guarda em (600, 300): na frente da janela, a 140 px de Ana —
 * longe da "casa em volta" (1 casa = 50 px) que o escuro deixa ver.
 */
const GRID = 50
const RADIUS = 900
const POSSE = { pAna: ['ana'] }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function retangulo(x1: number, y1: number, x2: number, y2: number): RegionPoint[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

function sala(id: string, points: RegionPoint[], room: { roof?: boolean; dark?: boolean }, extra: Partial<Region> = {}): Region {
  return {
    id,
    points,
    tag: '',
    fillColor: '#222',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `nome-${id}`, ...room },
    ...extra,
  }
}

function luz(id: string, x: number, y: number, radius: number): Light {
  return { id, x, y, radius, color: '#ffcc66', intensity: 1 }
}

function armazem(extra: Partial<MapData> = {}, predio: { dark?: boolean } = {}, salas: Region[] = []): MapData {
  return {
    ...createEmptyMap('m-armazem', 'Porto', 20, 12, GRID),
    regions: [sala('armazem', retangulo(500, 100, 900, 500), { roof: true, ...predio }), ...salas],
    walls: [
      parede('arm-n', 500, 100, 900, 100),
      parede('arm-l', 900, 100, 900, 500),
      parede('arm-s', 900, 500, 500, 500),
      parede('arm-o1', 500, 100, 500, 250),
      parede('janela', 500, 250, 500, 350, { janela: true }),
      parede('arm-o2', 500, 350, 500, 500),
      parede('divisoria', 700, 100, 700, 500),
    ],
    tokens: [ficha('ana', 460, 300), ficha('guarda', 600, 300)],
    ...extra,
  }
}

function recebido(map: MapData) {
  const view = filterMapForPlayer(map, 'pAna', POSSE, RADIUS)
  return { view, tokenIds: view.map.tokens.map((t) => t.id).sort(), json: JSON.stringify(view) }
}

/** Maior x alcançado pelo recorte do cone (`glimpses`); -Infinity sem cone. */
function alcanceDoCone(glimpses: RegionPoint[][]): number {
  return Math.max(Number.NEGATIVE_INFINITY, ...glimpses.flat().map((p) => p.x))
}

describe('controle: cena clara, prédio sem escuro', () => {
  it('o cone mostra o guarda na frente da janela', () => {
    const { view, tokenIds } = recebido(armazem())
    expect(tokenIds).toEqual(['ana', 'guarda'])
    expect(alcanceDoCone(view.glimpses)).toBeGreaterThanOrEqual(650)
  })
})

describe('cena escura: o cone pela janela só vê a casa em volta da ficha', () => {
  it('sem luz, o guarda a 140 px não sai e o cone não passa de uma casa além da parede', () => {
    const { view, tokenIds, json } = recebido(armazem({ dark: true }))
    expect(tokenIds).toEqual(['ana'])
    expect(json).not.toContain('nome-guarda')
    // Casa de Ana: 50 px em volta de (460, 300) — o cone, se houver, para em x ≤ 510 (+ a célula do recorte).
    expect(alcanceDoCone(view.glimpses)).toBeLessThanOrEqual(520)
  })
})

describe('sala escura e o cone pela janela', () => {
  it('o próprio prédio marcado escuro: o guarda não sai pela janela', () => {
    const { view, tokenIds } = recebido(armazem({}, { dark: true }))
    expect(tokenIds).toEqual(['ana'])
    expect(alcanceDoCone(view.glimpses)).toBeLessThanOrEqual(520)
  })

  it('cômodo escuro DENTRO do prédio (parentId): o guarda no escuro não sai pela janela', () => {
    const escuro = sala('deposito-escuro', retangulo(500, 100, 700, 500), { dark: true }, { parentId: 'armazem' })
    const { view, tokenIds, json } = recebido(armazem({}, {}, [escuro]))
    expect(tokenIds).toEqual(['ana'])
    expect(json).not.toContain('nome-guarda')
    expect(alcanceDoCone(view.glimpses)).toBeLessThanOrEqual(520)
    // O cômodo continua interior: nem polígono nem nome no pacote.
    expect(json).not.toContain('deposito-escuro')
  })

  it('cômodo escuro órfão (sem parentId, engolido pela geometria): mesmo resultado', () => {
    const escuro = sala('deposito-escuro', retangulo(500, 100, 700, 500), { dark: true })
    const { view, tokenIds, json } = recebido(armazem({}, {}, [escuro]))
    expect(tokenIds).toEqual(['ana'])
    expect(alcanceDoCone(view.glimpses)).toBeLessThanOrEqual(520)
    expect(json).not.toContain('deposito-escuro')
  })

  it('cômodo escuro do OUTRO lado da divisória não apaga o cone da frente da janela', () => {
    const escuro = sala('fundos-escuros', retangulo(700, 100, 900, 500), { dark: true }, { parentId: 'armazem' })
    const { view, tokenIds, json } = recebido(armazem({}, {}, [escuro]))
    expect(tokenIds).toEqual(['ana', 'guarda'])
    expect(alcanceDoCone(view.glimpses)).toBeGreaterThanOrEqual(650)
    expect(json).not.toContain('fundos-escuros')
  })
})

describe('o escuro de fora não vaza para dentro pela janela', () => {
  it('cena escura com lampião aceso na rua junto de Ana: o cone continua preso à casa dela', () => {
    const { view, tokenIds } = recebido(armazem({ dark: true, lights: [luz('lampiao-da-rua', 300, 300, 80)] }))
    expect(tokenIds).toEqual(['ana'])
    expect(alcanceDoCone(view.glimpses)).toBeLessThanOrEqual(520)
  })
})
