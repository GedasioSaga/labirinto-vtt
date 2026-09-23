import { describe, expect, it } from 'vitest'
import type { DoorState, MapData, Region, Token, Wall } from '../types/map'
import { pointInRing } from './floorContour'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * SALA SECRETA NÃO VAZA — a porta (ou parede) de sala "Oculta para jogadores"
 * que fica na borda de uma sala que o jogador recebe chega como PAREDE COMUM:
 * sem porta, sem vínculo com a sala secreta, e a visão enviada para nela.
 *
 * Planta (a mesma da régua e2e task-jornada-sala-secreta-nao-vaza): Biblioteca
 * x 500-900, y 100-450, com a parede leste partida em y 250-300 pela ESTANTE —
 * porta trancada do Quarto Secreto (x 900-1150, y 100-450, secret).
 */
const ESTANTE_X = 900
const RADIUS = 700
const ownership = { p1: ['lanterna'] }
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

interface Opcoes {
  secreta?: boolean
  porta?: DoorState
  /** Espessura das paredes da Biblioteca (a estante disfarçada tem de copiar a do lado). */
  espessura?: Wall['thickness']
  fichas?: Token[]
}

function mansao({ secreta = true, porta = trancada, espessura, fichas = [ficha('lanterna', 825, 275)] }: Opcoes = {}): MapData {
  const bib: Partial<Wall> = { regionId: 'r-bib', wallKind: 'interior', ...(espessura === undefined ? {} : { thickness: espessura }) }
  const sec: Partial<Wall> = { regionId: 'r-secreto', wallKind: 'exterior', thickness: 'thick', lineStyle: 'straight' }
  return {
    ...createEmptyMap('map_estante', 'Mansao', 1200, 600, 50),
    walls: [
      parede('bib-n', 500, 100, 900, 100, { ...bib, regionEdgeIndex: 0 }),
      parede('bib-l1', 900, 100, 900, 250, { ...bib, regionEdgeIndex: 1 }),
      parede('bib-l2', 900, 300, 900, 450, { ...bib, regionEdgeIndex: 1 }),
      parede('bib-s', 900, 450, 500, 450, { ...bib, regionEdgeIndex: 2 }),
      parede('bib-o', 500, 450, 500, 100, { ...bib, regionEdgeIndex: 3 }),
      parede('estante', ESTANTE_X, 250, ESTANTE_X, 300, { ...sec, door: porta }),
      parede('sec-n', 900, 100, 1150, 100, sec),
      parede('sec-l', 1150, 100, 1150, 450, sec),
      parede('sec-s', 1150, 450, 900, 450, sec),
    ],
    regions: [sala('r-bib', 'Biblioteca', 500, 100, 900, 450), sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450, { secret: secreta })],
    tokens: fichas,
  }
}

describe('sala secreta: a porta na borda chega como parede inteira', () => {
  it('a visão enviada para na parede leste: nenhum ponto do anel entra no Quarto Secreto', () => {
    const { vision } = filterMapForPlayer(mansao(), 'p1', ownership, RADIUS)
    expect(vision).toHaveLength(1)
    const [anel] = vision
    expect(pointInRing({ x: 1000, y: 275 }, anel)).toBe(false)
    expect(pointInRing({ x: 910, y: 275 }, anel)).toBe(false)
    expect(Math.max(...anel.map((p) => p.x))).toBeLessThanOrEqual(ESTANTE_X + 0.5)
  })

  it('a estante sai como parede comum no lugar do vão: sem porta, com a aparência e o vínculo da parede do lado', () => {
    const { map } = filterMapForPlayer(mansao({ espessura: 'thin' }), 'p1', ownership, RADIUS)
    const naEstante = map.walls.filter((w) => w.x1 === ESTANTE_X && w.x2 === ESTANTE_X && Math.min(w.y1, w.y2) <= 250 && Math.max(w.y1, w.y2) >= 300)
    expect(naEstante).toHaveLength(1)
    const [disfarce] = naEstante
    expect(disfarce.door).toBeNull()
    expect(disfarce.blocksLight).toBe(true)
    expect(disfarce.blocksMove).toBe(true)
    // Vínculo da Biblioteca (que o jogador já conhece), igual ao de bib-l1 e
    // bib-l2: sem ele, o trecho de 50 px sem sala na borda seria a porta.
    expect(disfarce.regionId).toBe('r-bib')
    expect(disfarce.regionEdgeIndex).toBe(1)
    // Mesma cara da parede leste da Biblioteca, nunca a da sala secreta.
    expect(disfarce.wallKind).toBe('interior')
    expect(disfarce.thickness).toBe('thin')
    expect(disfarce.lineStyle).toBeUndefined()
  })

  it('SEGURANÇA: nada do Quarto Secreto chega — nome, id, as outras paredes dele, a porta', () => {
    const view = filterMapForPlayer(mansao(), 'p1', ownership, RADIUS)
    const json = JSON.stringify(view.map)
    expect(json).not.toContain('r-secreto')
    expect(json).not.toContain('Quarto Secreto')
    for (const id of ['sec-n', 'sec-l', 'sec-s']) expect(json).not.toContain(`"${id}"`)
    expect(view.map.walls.some((w) => w.door !== null)).toBe(false)
    // Tocar não faz nada: a estante não é porta que o jogador vê.
    expect(view.visibleDoorIds).not.toContain('estante')
  })

  it('SEGURANÇA: com a estante ABERTA e a sala ainda secreta, a visão não entra e quem está lá dentro não sai', () => {
    const aberta: DoorState = { open: true, locked: false, kind: 'normal' }
    const view = filterMapForPlayer(mansao({ porta: aberta, fichas: [ficha('lanterna', 825, 275), ficha('guarda', 1000, 275)] }), 'p1', ownership, RADIUS)
    expect(JSON.stringify(view.map)).not.toContain('guarda')
    expect(pointInRing({ x: 1000, y: 275 }, view.vision[0])).toBe(false)
    expect(view.map.walls.find((w) => w.id === 'estante')?.door).toBeNull()
  })

  it('mestre desliga o oculto e destranca: a porta aparece de verdade, no estado real, e o jogador pode tocá-la', () => {
    const view = filterMapForPlayer(mansao({ secreta: false, porta: { open: false, locked: false, kind: 'normal' } }), 'p1', ownership, RADIUS)
    const estante = view.map.walls.find((w) => w.id === 'estante')
    expect(estante?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(estante?.regionId).toBe('r-secreto')
    expect(view.visibleDoorIds).toContain('estante')
  })

  it('parede da sala secreta que não encosta em parede nenhuma do jogador continua sem sair (sala solta no meio do nada)', () => {
    const base = mansao()
    const solta: MapData = {
      ...base,
      walls: base.walls.filter((w) => w.regionId === 'r-secreto'),
      regions: [sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450, { secret: true })],
    }
    const view = filterMapForPlayer(solta, 'p1', ownership, RADIUS)
    expect(view.map.walls).toEqual([])
  })
})

/**
 * Corredor feito com a ferramenta de parede: as paredes soltas em volta da
 * lanterna NÃO têm Sala. A borda da área visível é a mesma, e a estante que tapa
 * o buraco na parede leste tem de chegar como parede — senão sobra o vão.
 */
function corredor(porta: DoorState = trancada, fichas: Token[] = [ficha('lanterna', 825, 275)]): MapData {
  const base = mansao({ porta, fichas })
  return {
    ...base,
    walls: base.walls.map((w) => (w.regionId === 'r-bib' ? parede(w.id, w.x1, w.y1, w.x2, w.y2, { wallKind: 'interior' }) : w)),
    regions: base.regions.filter((r) => r.id === 'r-secreto'),
  }
}

describe('sala secreta: borda de corredor sem Sala', () => {
  it('a visão para na estante: nenhum ponto do anel entra no Quarto Secreto', () => {
    const [anel] = filterMapForPlayer(corredor(), 'p1', ownership, RADIUS).vision
    expect(pointInRing({ x: 1000, y: 275 }, anel)).toBe(false)
    expect(Math.max(...anel.map((p) => p.x))).toBeLessThanOrEqual(ESTANTE_X + 0.5)
  })

  it('a estante sai como parede comum, sem porta e sem vínculo, tapando o buraco 250-300', () => {
    const view = filterMapForPlayer(corredor(), 'p1', ownership, RADIUS)
    const naEstante = view.map.walls.filter((w) => w.x1 === ESTANTE_X && w.x2 === ESTANTE_X && Math.min(w.y1, w.y2) <= 250 && Math.max(w.y1, w.y2) >= 300)
    expect(naEstante).toHaveLength(1)
    const [disfarce] = naEstante
    expect(disfarce.door).toBeNull()
    expect(disfarce.blocksLight).toBe(true)
    expect(disfarce.regionId).toBeUndefined()
    expect(disfarce.wallKind).toBe('interior')
    expect(disfarce.thickness).toBeUndefined()
    expect(view.visibleDoorIds).not.toContain('estante')
  })

  it('SEGURANÇA: parede secreta que só continua a do corredor de UM lado não sai (seria o contorno do quarto)', () => {
    const json = JSON.stringify(filterMapForPlayer(corredor(), 'p1', ownership, RADIUS).map)
    expect(json).not.toContain('r-secreto')
    expect(json).not.toContain('Quarto Secreto')
    for (const id of ['sec-n', 'sec-l', 'sec-s']) expect(json).not.toContain(`"${id}"`)
  })

  it('SEGURANÇA: com a estante ABERTA, a visão não entra e quem está lá dentro não sai', () => {
    const aberta: DoorState = { open: true, locked: false, kind: 'normal' }
    const view = filterMapForPlayer(corredor(aberta, [ficha('lanterna', 825, 275), ficha('guarda', 1000, 275)]), 'p1', ownership, RADIUS)
    expect(JSON.stringify(view.map)).not.toContain('guarda')
    expect(pointInRing({ x: 1000, y: 275 }, view.vision[0])).toBe(false)
  })
})

/**
 * Caso MAIS COMUM (mapFactory: cada Sala tem a própria parede na aresta
 * comum): a Biblioteca tem a parede leste INTEIRA e a porta trancada está na
 * parede do Quarto Secreto, partida em 3 pedaços. O que o jogador recebe em
 * x = 900 tem de ser idêntico a uma Biblioteca sem sala nenhuma ao lado.
 */
function mansaoComum(fichas: Token[] = [ficha('lanterna', 825, 275)]): MapData {
  const bib: Partial<Wall> = { regionId: 'r-bib', wallKind: 'interior' }
  const sec: Partial<Wall> = { regionId: 'r-secreto', wallKind: 'interior' }
  return {
    ...createEmptyMap('map_estante', 'Mansao', 1200, 600, 50),
    walls: [
      parede('bib-n', 500, 100, 900, 100, { ...bib, regionEdgeIndex: 0 }),
      parede('bib-e', 900, 100, 900, 450, { ...bib, regionEdgeIndex: 1 }),
      parede('bib-s', 900, 450, 500, 450, { ...bib, regionEdgeIndex: 2 }),
      parede('bib-o', 500, 450, 500, 100, { ...bib, regionEdgeIndex: 3 }),
      parede('sec-wa', 900, 450, 900, 300, { ...sec, regionEdgeIndex: 3 }),
      parede('estante', 900, 300, 900, 250, { ...sec, regionEdgeIndex: 3, door: trancada }),
      parede('sec-wb', 900, 250, 900, 100, { ...sec, regionEdgeIndex: 3 }),
      parede('sec-n', 900, 100, 1150, 100, { ...sec, regionEdgeIndex: 0 }),
      parede('sec-l', 1150, 100, 1150, 450, { ...sec, regionEdgeIndex: 1 }),
      parede('sec-s', 1150, 450, 900, 450, { ...sec, regionEdgeIndex: 2 }),
    ],
    regions: [sala('r-bib', 'Biblioteca', 500, 100, 900, 450), sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450, { secret: true })],
    tokens: fichas,
  }
}

describe('sala secreta: pedaço secreto já coberto pela parede da sala do jogador', () => {
  it('SEGURANÇA: em x = 900 sai só a parede leste da Biblioteca, sem pedaço sobreposto nem quebra na altura da porta', () => {
    const { map } = filterMapForPlayer(mansaoComum(), 'p1', ownership, RADIUS)
    const emX900 = map.walls.filter((w) => w.x1 === ESTANTE_X && w.x2 === ESTANTE_X)
    expect(emX900.map((w) => w.id)).toEqual(['bib-e'])
    const pontas = map.walls.flatMap((w) => [w.y1, w.y2])
    expect(pontas).not.toContain(250)
    expect(pontas).not.toContain(300)
    const json = JSON.stringify(map)
    for (const id of ['sec-wa', 'estante', 'sec-wb']) expect(json).not.toContain(`"${id}"`)
  })

  it('a parede da Biblioteca segura a visão sozinha, mesmo com a estante aberta e alguém lá dentro', () => {
    const base = mansaoComum([ficha('lanterna', 825, 275), ficha('guarda', 1000, 275)])
    const aberta: MapData = { ...base, walls: base.walls.map((w) => (w.id === 'estante' ? { ...w, door: { open: true, locked: false, kind: 'normal' } } : w)) }
    const view = filterMapForPlayer(aberta, 'p1', ownership, RADIUS)
    expect(pointInRing({ x: 1000, y: 275 }, view.vision[0])).toBe(false)
    expect(Math.max(...view.vision[0].map((p) => p.x))).toBeLessThanOrEqual(ESTANTE_X + 0.5)
    expect(JSON.stringify(view.map)).not.toContain('guarda')
  })

  it('pedaço secreto coberto só em parte sai APARADO no trecho descoberto, com a cara e o vínculo da Biblioteca', () => {
    // Biblioteca com a parede leste partida (vão em 250-300) e o Quarto Secreto
    // com uma parede só, inteira, de 100 a 450: sai só o trecho 250-300.
    const base = mansao()
    const map: MapData = {
      ...base,
      walls: [
        ...base.walls.filter((w) => w.id !== 'estante'),
        parede('sec-w', 900, 450, 900, 100, { regionId: 'r-secreto', regionEdgeIndex: 3, wallKind: 'exterior', thickness: 'thick' }),
      ],
    }
    const view = filterMapForPlayer(map, 'p1', ownership, RADIUS)
    const emX900 = view.map.walls.filter((w) => w.x1 === ESTANTE_X && w.x2 === ESTANTE_X)
    const disfarce = emX900.filter((w) => w.id !== 'bib-l1' && w.id !== 'bib-l2')
    expect(disfarce).toHaveLength(1)
    const [trecho] = disfarce
    expect([Math.min(trecho.y1, trecho.y2), Math.max(trecho.y1, trecho.y2)]).toEqual([250, 300])
    expect(trecho.regionId).toBe('r-bib')
    expect(trecho.regionEdgeIndex).toBe(1)
    expect(trecho.wallKind).toBe('interior')
    expect(trecho.thickness).toBeUndefined()
    expect(JSON.stringify(view.map)).not.toContain('r-secreto')
    expect(Math.max(...view.vision[0].map((p) => p.x))).toBeLessThanOrEqual(ESTANTE_X + 0.5)
  })
})
