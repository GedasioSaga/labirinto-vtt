import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { EMPTY_AREA_SELECTION, type AreaSelection } from './areaSelection'
import { guideBoxesForDrag } from './guideBoxes'
import type { Drawing, MapData, Prop, Region, Stair, Wall } from '../types/map'

function sala(id: string, minX: number, minY: number, maxX: number, maxY: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    tag: '',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: id },
    ...extra,
  }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, regionId?: string): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...(regionId === undefined ? {} : { regionId }) }
}

const linha: Drawing = { id: 'linha', kind: 'line', x1: 600, y1: 500, x2: 900, y2: 650, color: '#ffffff', width: 2 }
const bau: Prop = { id: 'bau', src: 'bau.png', x: 1000, y: 400, width: 40, height: 20, linkedMapPath: null }
const bauSelecionado: Prop = { id: 'bau-selecionado', src: 'bau.png', x: 1200, y: 400, width: 40, height: 40, linkedMapPath: null }
const escada: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 300, y1: 700, x2: 400, y2: 700 }], stepWidth: 64 }

function mapa(): MapData {
  return {
    ...createEmptyMap('m_guias', 'Guias', 40, 20, 64),
    regions: [
      sala('sala', 100, 100, 300, 300),
      sala('sub', 150, 150, 250, 250, { parentId: 'sala' }),
      sala('outra', 500, 100, 700, 300),
      sala('longe', 5000, 100, 5200, 300),
      { ...sala('degenerada', 0, 0, 10, 10), points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
      sala('outro-piso', 800, 100, 900, 200, { piso: 1 }),
    ],
    walls: [
      parede('parede-da-sala', 100, 100, 300, 100, 'sala'),
      parede('parede-da-sub', 150, 150, 250, 150, 'sub'),
      parede('parede-da-outra', 500, 100, 700, 100, 'outra'),
      parede('parede-solta', 100, 600, 400, 600),
    ],
    drawings: [linha],
    props: [bau, bauSelecionado],
    stairs: [escada],
  }
}

const TELA = { left: 0, top: 0, right: 1000, bottom: 800 }
const arrastandoASala: AreaSelection = { ...EMPTY_AREA_SELECTION, regions: ['sala'], props: ['bau-selecionado'] }

const OUTRA = { minX: 500, minY: 100, maxX: 700, maxY: 300 }
const PAREDE_SOLTA = { minX: 100, minY: 600, maxX: 400, maxY: 600 }
const LINHA = { minX: 600, minY: 500, maxX: 900, maxY: 650 }
const BAU = { minX: 980, minY: 390, maxX: 1020, maxY: 410 }
const ESCADA = { minX: 300, minY: 700, maxX: 400, maxY: 700 }

describe('guideBoxesForDrag — quem vira guia no arrasto', () => {
  it('a sala arrastada, as sub-salas dela, as paredes que andam junto e o que está na seleção ficam de fora', () => {
    const caixas = guideBoxesForDrag(mapa(), { piso: 0, exclude: arrastandoASala, viewport: TELA, margin: 1000 })
    expect(caixas).toHaveLength(5)
    expect(caixas).toEqual(expect.arrayContaining([OUTRA, PAREDE_SOLTA, LINHA, BAU, ESCADA]))
  })

  it('parede de sala não repete a caixa da sala; com a camada Salas oculta, ela volta a contar por si', () => {
    const oculta: MapData = { ...mapa(), hiddenLayers: ['salas'] }
    const caixas = guideBoxesForDrag(oculta, { piso: 0, exclude: arrastandoASala, viewport: TELA, margin: 1000 })
    expect(caixas).not.toContainEqual(OUTRA)
    expect(caixas).toContainEqual({ minX: 500, minY: 100, maxX: 700, maxY: 100 })
    // A parede da sala que anda continua de fora: ela anda junto.
    expect(caixas).not.toContainEqual({ minX: 100, minY: 100, maxX: 300, maxY: 100 })
  })

  it('o objeto, a parede solta, a linha e a escada arrastados não aparecem nos próprios candidatos', () => {
    const exclude: AreaSelection = { ...EMPTY_AREA_SELECTION, props: ['bau'], walls: ['parede-solta'], drawings: ['linha'], stairs: ['escada'] }
    const caixas = guideBoxesForDrag(mapa(), { piso: 0, exclude, viewport: TELA, margin: 1000 })
    for (const proprio of [BAU, PAREDE_SOLTA, LINHA, ESCADA]) expect(caixas).not.toContainEqual(proprio)
    expect(caixas).toContainEqual(OUTRA)
  })

  it('só o que está na tela ou perto dela: a sala muito longe não entra, e entra quando a tela chega lá', () => {
    const LONGE = { minX: 5000, minY: 100, maxX: 5200, maxY: 300 }
    expect(guideBoxesForDrag(mapa(), { piso: 0, exclude: arrastandoASala, viewport: TELA, margin: 1000 })).not.toContainEqual(LONGE)
    const telaLaLonge = { left: 4500, top: 0, right: 5500, bottom: 800 }
    expect(guideBoxesForDrag(mapa(), { piso: 0, exclude: arrastandoASala, viewport: telaLaLonge, margin: 0 })).toContainEqual(LONGE)
  })

  it('respeita o piso em edição: a sala do 1º piso só vira guia quando o mestre edita o 1º piso', () => {
    const OUTRO_PISO = { minX: 800, minY: 100, maxX: 900, maxY: 200 }
    expect(guideBoxesForDrag(mapa(), { piso: 0, exclude: EMPTY_AREA_SELECTION, viewport: TELA, margin: 1000 })).not.toContainEqual(OUTRO_PISO)
    expect(guideBoxesForDrag(mapa(), { piso: 1, exclude: EMPTY_AREA_SELECTION, viewport: TELA, margin: 1000 })).toEqual([OUTRO_PISO])
  })

  it('região sem polígono (menos de 3 pontos) nunca vira caixa', () => {
    const caixas = guideBoxesForDrag(mapa(), { piso: 0, exclude: EMPTY_AREA_SELECTION, viewport: TELA, margin: 1000 })
    expect(caixas).not.toContainEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    for (const c of caixas) expect([c.minX, c.minY, c.maxX, c.maxY].every(Number.isFinite)).toBe(true)
  })
})
