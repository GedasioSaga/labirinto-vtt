import { describe, expect, it } from 'vitest'
import { EMPTY_AREA_SELECTION, areaSelectionBounds, type AreaBounds, type AreaSelection } from './areaSelection'
import { guideBoxesForDrag } from './guideBoxes'
import { createEmptyMap } from './mapFactory'
import {
  EXACT_ALIGNMENT_WORLD_PX,
  SMART_GUIDE_SCREEN_PX,
  dragBoxWithGuides,
  dragPointWithGuides,
  guideModeForDrag,
  pointBox,
  sameGuides,
  screenPxToWorld,
  snapBox,
  type GuideMode,
  type SmartGuide,
} from './smartGuides'
import type { Drawing, MapData, Region } from '../types/map'

function caixa(minX: number, minY: number, maxX: number, maxY: number): AreaBounds {
  return { minX, minY, maxX, maxY }
}

describe('screenPxToWorld — a tolerância vem em px de TELA', () => {
  it('zoom afastado alarga em mundo, zoom próximo estreita: a sensação na tela é a mesma', () => {
    expect(screenPxToWorld(6, 0.25)).toBe(24)
    expect(screenPxToWorld(6, 2)).toBe(3)
    expect(screenPxToWorld(SMART_GUIDE_SCREEN_PX, 1)).toBe(SMART_GUIDE_SCREEN_PX)
  })

  it('escala zero, negativa ou que não é número cai na escala 1: nunca Infinity nem NaN', () => {
    for (const escala of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(screenPxToWorld(6, escala)).toBe(6)
    }
  })
})

describe('snapBox — encaixe por borda e por centro da caixa', () => {
  it('sala redonda com o centro a 3 px do centro da outra encaixa pelo centro, e a guia liga os dois centros', () => {
    // Larguras diferentes: só o par centro-centro fica dentro da tolerância.
    const movendo = caixa(103, 0, 203, 100)
    const alvo = caixa(120, 300, 180, 360)
    const resultado = snapBox(movendo, [alvo], 6)
    expect(resultado.dx).toBe(-3)
    expect(resultado.dy).toBe(0)
    expect(resultado.guides).toEqual([{ axis: 'x', position: 150, from: 50, to: 330, marks: [50, 330] }])
  })

  it('borda esquerda a 4 px da borda direita da vizinha encaixa borda com borda', () => {
    const vizinha = caixa(0, 0, 100, 100)
    const resultado = snapBox(caixa(104, 200, 204, 300), [vizinha], 6)
    expect(resultado.dx).toBe(-4)
    expect(resultado.guides).toEqual([{ axis: 'x', position: 100, from: 50, to: 250, marks: [50, 250] }])
  })

  it('a 7 px com tolerância 6 não encaixa nem desenha guia', () => {
    const resultado = snapBox(caixa(107, 200, 207, 300), [caixa(0, 0, 100, 100)], 6)
    expect(resultado).toEqual({ dx: 0, dy: 0, guides: [] })
  })

  it('empate de distância: borda com borda vence centro com centro', () => {
    // A: borda direita em 97 (a borda esquerda do movido está a -3).
    // B: centro em 153 (o centro do movido está a +3).
    const movendo = caixa(100, 0, 200, 100)
    const a = caixa(37, 400, 97, 460)
    const b = caixa(123, 400, 183, 460)
    expect(snapBox(movendo, [b, a], 6).dx).toBe(-3)
  })

  it('empate de distância entre duas bordas: vence a caixa mais perto', () => {
    const movendo = caixa(100, 0, 200, 100)
    const esquerdaPerto = caixa(37, 0, 97, 100)
    const direitaLonge = caixa(203, 2000, 263, 2100)
    expect(snapBox(movendo, [direitaLonge, esquerdaPerto], 6).dx).toBe(-3)

    const esquerdaLonge = caixa(37, 2000, 97, 2100)
    const direitaPerto = caixa(203, 0, 263, 100)
    expect(snapBox(movendo, [esquerdaLonge, direitaPerto], 6).dx).toBe(3)
  })

  it('duas salas no mesmo centro Y viram UMA guia que passa pelas três, com uma marca em cada', () => {
    const movendo = caixa(0, 3, 100, 103)
    const a = caixa(300, 20, 400, 80)
    const b = caixa(600, 30, 700, 70)
    const resultado = snapBox(movendo, [a, b], 6)
    expect(resultado.dy).toBe(-3)
    expect(resultado.dx).toBe(0)
    expect(resultado.guides).toEqual([{ axis: 'y', position: 50, from: 50, to: 650, marks: [50, 350, 650] }])
  })

  it('os dois eixos encaixam de forma independente', () => {
    // Canto com canto: borda esquerda na direita da vizinha (x) e topo no topo dela (y).
    // Alturas diferentes: no eixo y só o topo fica alinhado depois do encaixe.
    const resultado = snapBox(caixa(102, 4, 202, 104), [caixa(0, 0, 100, 60)], 6)
    expect(resultado.dx).toBe(-2)
    expect(resultado.dy).toBe(-4)
    expect(resultado.guides.map((g) => [g.axis, g.position])).toEqual([
      ['x', 100],
      ['y', 0],
    ])
  })

  it('sem vizinha, ou tolerância inválida, a caixa fica onde está', () => {
    expect(snapBox(caixa(0, 0, 10, 10), [], 6)).toEqual({ dx: 0, dy: 0, guides: [] })
    for (const tolerancia of [Number.NaN, -1]) {
      expect(snapBox(caixa(102, 0, 202, 100), [caixa(0, 0, 100, 100)], tolerancia)).toEqual({ dx: 0, dy: 0, guides: [] })
    }
  })
})

describe('dragBoxWithGuides — posição pelo delta TOTAL do gesto', () => {
  const inicio = caixa(100, 0, 200, 100)
  const ponteiroInicial = { x: 150, y: 50 }
  // Só a borda esquerda (100) e o centro dela (200 = borda direita do movido)
  // estão alinhados no começo; nenhum outro par chega perto nos 20 passos.
  const vizinha = caixa(100, 300, 300, 340)

  it('deriva: encaixada, a peça solta assim que o cursor passa da tolerância e daí acompanha o cursor 1 a 1', () => {
    for (let passo = 1; passo <= 20; passo += 1) {
      const ponteiro = { x: ponteiroInicial.x + passo, y: ponteiroInicial.y }
      const r = dragBoxWithGuides({ startBounds: inicio, startPointer: ponteiroInicial, pointer: ponteiro, others: [vizinha], tolerance: 6, mode: 'snap' })
      if (passo <= 6) {
        expect(r.offsetX).toBe(0)
        expect(r.guides.length).toBeGreaterThan(0)
      } else {
        expect(r.offsetX).toBe(ponteiro.x - ponteiroInicial.x)
        expect(r.guides).toEqual([])
      }
      expect(r.offsetY).toBe(0)
    }
  })

  it("'free' (Ctrl): o delta cru, sem encaixe e sem guia", () => {
    const r = dragBoxWithGuides({ startBounds: inicio, startPointer: ponteiroInicial, pointer: { x: 153, y: 50 }, others: [vizinha], tolerance: 6, mode: 'free' })
    expect(r).toEqual({ offsetX: 3, offsetY: 0, guides: [] })
  })

  it("'gridExact' (a grade manda): nunca move por guia, mas mostra a guia quando o alinhamento é exato", () => {
    const outra = caixa(300, 500, 400, 600)
    const arrasta = (dx: number) =>
      dragBoxWithGuides({ startBounds: inicio, startPointer: ponteiroInicial, pointer: { x: 150 + dx, y: 50 }, others: [outra], tolerance: 6, mode: 'gridExact' })

    const exato = arrasta(200)
    expect(exato.offsetX).toBe(200)
    expect(exato.guides.map((g) => g.position)).toEqual([300, 350, 400])

    const quaseExato = arrasta(200 + EXACT_ALIGNMENT_WORLD_PX / 2)
    expect(quaseExato.offsetX).toBe(200 + EXACT_ALIGNMENT_WORLD_PX / 2)
    expect(quaseExato.guides).toHaveLength(3)

    const perto = arrasta(203)
    expect(perto.offsetX).toBe(203)
    expect(perto.guides).toEqual([])
  })
})

describe('dragPointWithGuides — a ponta, o vértice e a ficha encaixam como uma caixa sem tamanho', () => {
  const sala = caixa(100, 0, 200, 100)

  it('pointBox: as três âncoras do ponto são o próprio ponto', () => {
    expect(pointBox({ x: 7, y: -3 })).toEqual({ minX: 7, minY: -3, maxX: 7, maxY: -3 })
  })

  it('ponto a 3 px do centro da caixa encaixa no centro, e a guia vai do ponto até o meio da caixa', () => {
    const r = dragPointWithGuides({ point: { x: 153, y: 500 }, others: [sala], tolerance: 6, mode: 'snap' })
    expect(r.point).toEqual({ x: 150, y: 500 })
    expect(r.guides).toEqual([{ axis: 'x', position: 150, from: 50, to: 500, marks: [50, 500] }])
  })

  it('a borda da caixa também é âncora: a 4 px da borda direita, encaixa nela', () => {
    const r = dragPointWithGuides({ point: { x: 204, y: 500 }, others: [sala], tolerance: 6, mode: 'snap' })
    expect(r.point).toEqual({ x: 200, y: 500 })
    expect(r.guides.map((g) => [g.axis, g.position])).toEqual([['x', 200]])
  })

  it('ponto solto (a ponta de outra parede) entra como caixa sem tamanho: encaixa nele e a guia liga os dois', () => {
    const r = dragPointWithGuides({ point: { x: 403, y: 200 }, others: [pointBox({ x: 400, y: 50 })], tolerance: 6, mode: 'snap' })
    expect(r.point).toEqual({ x: 400, y: 200 })
    expect(r.guides).toEqual([{ axis: 'x', position: 400, from: 50, to: 200, marks: [50, 200] }])
  })

  it('os dois eixos de uma vez: o ponto vai ao canto da caixa', () => {
    const r = dragPointWithGuides({ point: { x: 203, y: 104 }, others: [sala], tolerance: 6, mode: 'snap' })
    expect(r.point).toEqual({ x: 200, y: 100 })
  })

  it("'free' (Ctrl): o ponto fica onde está, sem guia", () => {
    expect(dragPointWithGuides({ point: { x: 153, y: 500 }, others: [sala], tolerance: 6, mode: 'free' })).toEqual({ point: { x: 153, y: 500 }, guides: [] })
  })

  it("'gridExact' (a grade manda): o ponto não anda pela guia, e ela só aparece no alinhamento exato", () => {
    const perto = dragPointWithGuides({ point: { x: 153, y: 500 }, others: [sala], tolerance: 6, mode: 'gridExact' })
    expect(perto).toEqual({ point: { x: 153, y: 500 }, guides: [] })
    const exato = dragPointWithGuides({ point: { x: 150, y: 500 }, others: [sala], tolerance: 6, mode: 'gridExact' })
    expect(exato.point).toEqual({ x: 150, y: 500 })
    expect(exato.guides.map((g) => g.position)).toEqual([150])
  })

  it('a 7 px com tolerância 6, nada encaixa', () => {
    expect(dragPointWithGuides({ point: { x: 157, y: 500 }, others: [sala], tolerance: 6, mode: 'snap' })).toEqual({ point: { x: 157, y: 500 }, guides: [] })
  })
})

describe('seleção de vários itens — a caixa da união encaixa, e a própria seleção não vira guia', () => {
  // Um corredor de duas linhas (x = 100 e x = 140), abaixo e à esquerda de uma
  // sala: nenhuma altura da sala (100, 200, 300) bate com as do corredor.
  const linha = (id: string, x: number): Drawing => ({ id, kind: 'line', x1: x, y1: 400, x2: x, y2: 600, color: '#ffffff', width: 2 })
  const sala: Region = {
    id: 'sala',
    points: [
      { x: 300, y: 100 },
      { x: 500, y: 100 },
      { x: 500, y: 300 },
      { x: 300, y: 300 },
    ],
    tag: '',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'sala' },
  }
  const map: MapData = { ...createEmptyMap('m_uniao', 'União', 40, 20, 64), drawings: [linha('a', 100), linha('b', 140)], regions: [sala] }
  const selecao: AreaSelection = { ...EMPTY_AREA_SELECTION, drawings: ['a', 'b'] }
  const inicio = areaSelectionBounds(map, selecao)
  const outras = guideBoxesForDrag(map, { piso: 0, exclude: selecao, viewport: { left: 0, top: 0, right: 1000, bottom: 800 }, margin: 1000 })

  it('a união vai de 100 a 140 e só a sala é candidata', () => {
    expect(inicio).toEqual({ minX: 100, minY: 400, maxX: 140, maxY: 600 })
    expect(outras).toEqual([{ minX: 300, minY: 100, maxX: 500, maxY: 300 }])
  })

  it('a borda esquerda da união, a 3 px da borda direita da sala, encaixa nela', () => {
    if (inicio === null) throw new Error('a seleção do teste tem caixa')
    const r = dragBoxWithGuides({ startBounds: inicio, startPointer: { x: 120, y: 500 }, pointer: { x: 523, y: 500 }, others: outras, tolerance: 6, mode: 'snap' })
    expect(r.offsetX).toBe(400)
    expect(r.offsetY).toBe(0)
    expect(r.guides).toEqual([{ axis: 'x', position: 500, from: 200, to: 500, marks: [200, 500] }])
  })

  it('3 px de arrasto não prende a seleção na posição de onde ela saiu', () => {
    if (inicio === null) throw new Error('a seleção do teste tem caixa')
    const r = dragBoxWithGuides({ startBounds: inicio, startPointer: { x: 120, y: 500 }, pointer: { x: 123, y: 500 }, others: outras, tolerance: 6, mode: 'snap' })
    expect(r).toEqual({ offsetX: 3, offsetY: 0, guides: [] })
  })
})

describe('sameGuides — a guia do passo anterior serve de novo?', () => {
  const guia: SmartGuide = { axis: 'x', position: 150, from: 50, to: 330, marks: [50, 330] }

  it('mesmas guias (outro array, outro objeto) são iguais; listas vazias também', () => {
    expect(sameGuides([guia], [{ ...guia, marks: [50, 330] }])).toBe(true)
    expect(sameGuides([], [])).toBe(true)
  })

  it('qualquer diferença — eixo, posição, ponta, marca ou quantidade — pede redesenho', () => {
    expect(sameGuides([guia], [])).toBe(false)
    expect(sameGuides([guia], [{ ...guia, axis: 'y' }])).toBe(false)
    expect(sameGuides([guia], [{ ...guia, position: 151 }])).toBe(false)
    expect(sameGuides([guia], [{ ...guia, to: 331 }])).toBe(false)
    expect(sameGuides([guia], [{ ...guia, marks: [50, 200, 330] }])).toBe(false)
    expect(sameGuides([guia], [{ ...guia, marks: [50, 331] }])).toBe(false)
  })
})

describe('guideModeForDrag — quem manda no gesto: guia, grade ou ninguém', () => {
  const casos: Array<[{ free: boolean; altKey: boolean; gridBySetting: boolean }, GuideMode]> = [
    // Ctrl solta tudo, com ou sem grade, com ou sem Alt.
    [{ free: true, altKey: false, gridBySetting: false }, 'free'],
    [{ free: true, altKey: true, gridBySetting: true }, 'free'],
    // Grade ligada na configuração e sem Alt: a grade manda.
    [{ free: false, altKey: false, gridBySetting: true }, 'gridExact'],
    // Alt inverteu a grade no gesto (para um lado ou para o outro): a guia encaixa.
    [{ free: false, altKey: true, gridBySetting: true }, 'snap'],
    [{ free: false, altKey: true, gridBySetting: false }, 'snap'],
    // Sem grade (o padrão do app): a guia encaixa.
    [{ free: false, altKey: false, gridBySetting: false }, 'snap'],
  ]
  it.each(casos)('%o -> %s', (entrada, esperado) => {
    expect(guideModeForDrag(entrada)).toBe(esperado)
  })
})
