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
      parede('bib-n', 500, 100, 900, 100, bib),
      parede('bib-l1', 900, 100, 900, 250, bib),
      parede('bib-l2', 900, 300, 900, 450, bib),
      parede('bib-s', 900, 450, 500, 450, bib),
      parede('bib-o', 500, 450, 500, 100, bib),
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

  it('a estante sai como parede comum no lugar do vão: sem porta, sem vínculo, com a aparência da parede do lado', () => {
    const { map } = filterMapForPlayer(mansao({ espessura: 'thin' }), 'p1', ownership, RADIUS)
    const naEstante = map.walls.filter((w) => w.x1 === ESTANTE_X && w.x2 === ESTANTE_X && Math.min(w.y1, w.y2) <= 250 && Math.max(w.y1, w.y2) >= 300)
    expect(naEstante).toHaveLength(1)
    const [disfarce] = naEstante
    expect(disfarce.door).toBeNull()
    expect(disfarce.blocksLight).toBe(true)
    expect(disfarce.blocksMove).toBe(true)
    expect(disfarce.regionId).toBeUndefined()
    expect(disfarce.regionEdgeIndex).toBeUndefined()
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

  it('parede da sala secreta que NÃO está na borda de sala do jogador continua sem sair (sala solta no meio do nada)', () => {
    const solta: MapData = {
      ...mansao(),
      regions: [sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450, { secret: true })],
    }
    const view = filterMapForPlayer(solta, 'p1', ownership, RADIUS)
    const ids = view.map.walls.map((w) => w.id)
    expect(ids).not.toContain('estante')
    expect(ids).not.toContain('sec-n')
  })
})
