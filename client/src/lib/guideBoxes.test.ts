import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { EMPTY_AREA_SELECTION, type AreaBounds, type AreaSelection } from './areaSelection'
import { guideBoxesForDrag } from './guideBoxes'
import { planStairFlight } from '../pixi/stairFlight'
import type { Drawing, MapData, Prop, Region, Stair, StairDirection, StairSegment, Wall } from '../types/map'

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
/** O lance deitado em y = 700 com 64 de largura: a placa pintada vai de 668 a 732, não só a linha do meio. */
const ESCADA = { minX: 300, minY: 668, maxX: 400, maxY: 732 }

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

/** Só as peças dadas, no piso 0, nada excluído e a tela inteira ao alcance. */
function caixasDe(props: Prop[], stairs: Stair[] = []): AreaBounds[] {
  const map: MapData = { ...createEmptyMap('m_desenho', 'Desenho', 40, 20, 64), props, stairs }
  return guideBoxesForDrag(map, { piso: 0, exclude: EMPTY_AREA_SELECTION, viewport: TELA, margin: 1000 })
}

/** Min e max de pontos soltos: o "girar os cantos e tirar min/max" do achado, escrito à parte da conta do módulo. */
function caixaDosPontos(pontos: readonly { x: number; y: number }[]): AreaBounds {
  const xs = pontos.map((p) => p.x)
  const ys = pontos.map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

const LADOS: ReadonlyArray<keyof AreaBounds> = ['minX', 'minY', 'maxX', 'maxY']

function esperaPerto(atual: AreaBounds | undefined, esperado: AreaBounds): void {
  if (atual === undefined) throw new Error('a peça não virou caixa de guia')
  for (const lado of LADOS) expect(atual[lado]).toBeCloseTo(esperado[lado], 9)
}

describe('guideBoxesForDrag — a caixa é a da peça como ela aparece no mapa', () => {
  const mesa = (extra: Partial<Prop>): Prop => ({ id: 'mesa', src: 'mesa.png', x: 500, y: 400, width: 100, height: 50, linkedMapPath: null, ...extra })
  const lance = (segments: StairSegment[], extra: Partial<Stair> = {}): Stair => ({
    id: 'lance',
    shape: 'straight',
    direction: 'up',
    segments,
    stepWidth: 50,
    ...extra,
  })

  it('objeto girado um quarto de volta fica em pé: a caixa troca largura por altura, como o sprite girado', () => {
    for (const rotation of [90, -90, 270]) {
      expect(caixasDe([mesa({ rotation })])).toEqual([{ minX: 475, minY: 350, maxX: 525, maxY: 450 }])
    }
    expect(caixasDe([mesa({ rotation: 180 })])).toEqual([{ minX: 450, minY: 375, maxX: 550, maxY: 425 }])
  })

  it('objeto girado num ângulo qualquer: a caixa cerca os quatro cantos girados em volta do centro', () => {
    const graus = 30
    const rad = (graus * Math.PI) / 180
    const cantos = [
      { dx: -50, dy: -25 },
      { dx: 50, dy: -25 },
      { dx: 50, dy: 25 },
      { dx: -50, dy: 25 },
    ].map(({ dx, dy }) => ({ x: 500 + dx * Math.cos(rad) - dy * Math.sin(rad), y: 400 + dx * Math.sin(rad) + dy * Math.cos(rad) }))
    esperaPerto(caixasDe([mesa({ rotation: graus })])[0], caixaDosPontos(cantos))
  })

  it('barril girado: a caixa é a da elipse desenhada, não a do retângulo girado', () => {
    const barril = mesa({ id: 'barril', src: '', width: 40, height: 40, mobilia: 'barril', rotation: 45 })
    // Barril redondo girado 45 graus continua um círculo de raio 20; o retângulo girado passaria de 28.
    esperaPerto(caixasDe([barril])[0], { minX: 480, minY: 380, maxX: 520, maxY: 420 })
    // Elipse deitada (60 x 30) fica em pé depois de um quarto de volta.
    expect(caixasDe([{ ...barril, width: 60, height: 30, rotation: 90 }])).toEqual([{ minX: 485, minY: 370, maxX: 515, maxY: 430 }])
  })

  it('lance em pé: a caixa vai meia largura de degrau para cada lado da linha do meio', () => {
    expect(caixasDe([], [lance([{ x1: 100, y1: 200, x2: 100, y2: 400 }])])).toEqual([{ minX: 75, minY: 200, maxX: 125, maxY: 400 }])
  })

  it('a caixa do lance é a da placa que o mapa pinta (planStairFlight): deitado, em pé, na diagonal, nos dois sentidos', () => {
    const segmentos: StairSegment[] = [
      { x1: 300, y1: 700, x2: 400, y2: 700 },
      { x1: 100, y1: 400, x2: 100, y2: 200 },
      { x1: 100, y1: 100, x2: 300, y2: 250 },
      { x1: 640, y1: 320, x2: 512, y2: 448 },
    ]
    const sentidos: StairDirection[] = ['up', 'down']
    for (const segmento of segmentos) {
      for (const direction of sentidos) {
        const placa = planStairFlight(segmento, 64, direction)?.plate
        if (placa === undefined) throw new Error('o lance do teste tem comprimento, a placa existe')
        esperaPerto(caixasDe([], [lance([segmento], { stepWidth: 64, direction })])[0], caixaDosPontos(placa))
      }
    }
  })

  it('escada em L: a caixa cerca os dois lances, cada um com a largura dele', () => {
    const emL = lance(
      [
        { x1: 100, y1: 100, x2: 300, y2: 100 },
        { x1: 300, y1: 100, x2: 300, y2: 300 },
      ],
      { shape: 'l', stepWidth: 40 },
    )
    expect(caixasDe([], [emL])).toEqual([{ minX: 100, minY: 80, maxX: 320, maxY: 300 }])
  })

  it('espiral: a caixa é a do círculo desenhado, com o lance de diâmetro', () => {
    const espiral = lance([{ x1: 100, y1: 100, x2: 300, y2: 100 }], { shape: 'spiral' })
    expect(caixasDe([], [espiral])).toEqual([{ minX: 100, minY: 0, maxX: 300, maxY: 200 }])
  })

  it('lance de comprimento zero não se desenha e não vira guia, reto ou espiral', () => {
    const parado = { x1: 500, y1: 500, x2: 500, y2: 500 }
    expect(caixasDe([], [lance([parado]), lance([parado], { id: 'espiral', shape: 'spiral' })])).toEqual([])
  })

  it('largura que não forma lance (NaN, infinita, negativa, zero) desenha só a linha do meio, e a caixa é ela', () => {
    for (const stepWidth of [Number.NaN, Number.POSITIVE_INFINITY, -10, 0]) {
      expect(caixasDe([], [lance([{ x1: 100, y1: 200, x2: 100, y2: 400 }], { stepWidth })])).toEqual([{ minX: 100, minY: 200, maxX: 100, maxY: 400 }])
    }
  })
})
