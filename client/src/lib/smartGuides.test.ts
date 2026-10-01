import { describe, expect, it } from 'vitest'
import { EMPTY_AREA_SELECTION, areaSelectionBounds, type AreaBounds, type AreaSelection } from './areaSelection'
import { guideBoxesForDrag } from './guideBoxes'
import { createEmptyMap } from './mapFactory'
import {
  EXACT_ALIGNMENT_WORLD_PX,
  SMART_GUIDE_SCREEN_PX,
  dragBoxWithGuides,
  dragPointWithGuides,
  gapEnds,
  guideModeForDrag,
  pointBox,
  sameGuides,
  sameOverlay,
  screenPxToWorld,
  snapBox,
  type BoxSnap,
  type GapMark,
  type GuideAxis,
  type GuideMode,
  type GuideOverlay,
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
    expect(resultado).toEqual({ dx: 0, dy: 0, guides: [], gaps: [] })
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

  it('mapa denso: a guia vai só até as 2 vizinhas alinhadas mais perto, sem atravessar a tela (conferência guias-4e5, print 22)', () => {
    // Uma coluna de 10 salas iguais (centros em y = 50, 250, ..., 1850) e a que
    // anda entre a 5ª e a 6ª, 3 px fora da coluna.
    const coluna = Array.from({ length: 10 }, (_, i) => caixa(0, i * 200, 100, i * 200 + 100))
    const resultado = snapBox(caixa(3, 920, 103, 980), coluna, 6)
    expect(resultado.dx).toBe(-3)
    expect(resultado.dy).toBe(0)
    // Borda esquerda, centro e borda direita alinham com a coluna inteira; cada
    // guia liga só a de cima e a de baixo, com um "x" em cada uma.
    expect(resultado.guides).toEqual([0, 50, 100].map((position) => ({ axis: 'x', position, from: 850, to: 1050, marks: [850, 950, 1050] })))
  })

  it('mapa denso: a vizinha que é um ponto (ponta de parede) conta uma vez só entre as 2 mais perto', () => {
    // A ponta solta encosta na guia com as 3 âncoras no mesmo lugar: não pode ocupar as duas vagas.
    const ponta = pointBox({ x: 50, y: 700 })
    const longe = caixa(0, 1200, 100, 1300)
    const resultado = snapBox(caixa(3, 920, 103, 980), [ponta, longe], 6)
    expect(resultado.guides.find((g) => g.position === 50)).toEqual({ axis: 'x', position: 50, from: 700, to: 1250, marks: [700, 950, 1250] })
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
    expect(snapBox(caixa(0, 0, 10, 10), [], 6)).toEqual({ dx: 0, dy: 0, guides: [], gaps: [] })
    for (const tolerancia of [Number.NaN, -1]) {
      expect(snapBox(caixa(102, 0, 202, 100), [caixa(0, 0, 100, 100)], tolerancia)).toEqual({ dx: 0, dy: 0, guides: [], gaps: [] })
      // Também com os vãos ligados: tolerância que não serve não encaixa nada.
      expect(snapBox(caixa(153, 10, 253, 30), [caixa(0, 0, 100, 100), caixa(300, 0, 400, 100)], tolerancia, { gaps: true })).toEqual({
        dx: 0,
        dy: 0,
        guides: [],
        gaps: [],
      })
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
    expect(r).toEqual({ offsetX: 3, offsetY: 0, guides: [], gaps: [] })
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
    expect(r).toEqual({ offsetX: 3, offsetY: 0, guides: [], gaps: [] })
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

/**
 * FATIA 3: espaçamento igual e a medida dos vãos. Fileiras em y = 0..100; a
 * peça movida é baixa (y = 10..30), para nenhuma altura dela alinhar com as
 * vizinhas e o teste olhar só o eixo x.
 */
describe('snapBox com os vãos — espaçamento igual (fatia 3)', () => {
  const A = caixa(0, 0, 100, 100)
  const B = caixa(300, 0, 400, 100)
  const comVaos = { gaps: true }

  it('entre duas vizinhas: centraliza, e os dois vãos iguais saem medidos', () => {
    const r = snapBox(caixa(153, 10, 253, 30), [A, B], 6, comVaos)
    expect(r.dx).toBe(-3)
    expect(r.dy).toBe(0)
    expect(r.guides).toEqual([])
    expect(r.gaps).toEqual([
      { axis: 'x', from: 100, to: 150, at: 20 },
      { axis: 'x', from: 250, to: 300, at: 20 },
    ])
  })

  it('depois da última da fileira: repete o vão que já existe entre as duas de antes', () => {
    const r = snapBox(caixa(297, 10, 377, 30), [caixa(0, 0, 100, 100), caixa(150, 0, 250, 100)], 6, comVaos)
    expect(r.dx).toBe(3)
    // O vão da peça primeiro; o vão repetido, na altura das duas vizinhas.
    expect(r.gaps).toEqual([
      { axis: 'x', from: 250, to: 300, at: 20 },
      { axis: 'x', from: 100, to: 150, at: 50 },
    ])
  })

  it('antes da primeira da fileira: repete o vão das duas de depois', () => {
    const r = snapBox(caixa(23, 10, 103, 30), [caixa(150, 0, 250, 100), caixa(300, 0, 400, 100)], 6, comVaos)
    expect(r.dx).toBe(-3)
    expect(r.gaps).toEqual([
      { axis: 'x', from: 100, to: 150, at: 20 },
      { axis: 'x', from: 250, to: 300, at: 50 },
    ])
  })

  it('a fileira inteira de vãos iguais aparece, do vão da peça ao mais longe', () => {
    const fileira = [caixa(0, 0, 100, 100), caixa(150, 0, 250, 100), caixa(300, 0, 400, 100)]
    const r = snapBox(caixa(453, 10, 533, 30), fileira, 6, comVaos)
    expect(r.dx).toBe(-3)
    expect(r.gaps).toEqual([
      { axis: 'x', from: 400, to: 450, at: 20 },
      { axis: 'x', from: 250, to: 300, at: 50 },
      { axis: 'x', from: 100, to: 150, at: 50 },
    ])
  })

  it('caixa fora da fileira (sem sobreposição no outro eixo) não conta', () => {
    const foraDaFileira = caixa(0, 200, 100, 300)
    const r = snapBox(caixa(297, 10, 377, 30), [foraDaFileira, caixa(150, 0, 250, 100)], 6, comVaos)
    expect(r).toEqual({ dx: 0, dy: 0, guides: [], gaps: [] })
  })

  it('coluna: o mesmo no eixo y', () => {
    const r = snapBox(caixa(10, 153, 30, 253), [caixa(0, 0, 100, 100), caixa(0, 300, 100, 400)], 6, comVaos)
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(-3)
    expect(r.gaps).toEqual([
      { axis: 'y', from: 100, to: 150, at: 20 },
      { axis: 'y', from: 250, to: 300, at: 20 },
    ])
  })

  it('empate de ajuste entre alinhamento (+3) e espaçamento (-3): vence o alinhamento', () => {
    // Fora da fileira, com a borda esquerda a 3 px da borda direita do movido.
    const alinhavel = caixa(256, 500, 356, 600)
    const r = snapBox(caixa(153, 10, 253, 30), [A, B, alinhavel], 6, comVaos)
    expect(r.dx).toBe(3)
    expect(r.guides).toEqual([{ axis: 'x', position: 256, from: 20, to: 550, marks: [20, 550] }])
    // Os vãos da fileira (56 e 44) não ficaram iguais: só a medida até a alinhada.
    expect(r.gaps).toEqual([{ axis: 'y', from: 30, to: 500, at: 256 }])
  })

  it('espaçamento mais perto que o alinhamento (3 contra 4): vence o espaçamento', () => {
    const r = snapBox(caixa(153, 10, 253, 30), [A, B, caixa(257, 500, 357, 600)], 6, comVaos)
    expect(r.dx).toBe(-3)
    expect(r.guides).toEqual([])
    expect(r.gaps).toHaveLength(2)
  })

  it('sem a opção (o arrasto de ponto), nada de espaçamento nem de medida', () => {
    expect(snapBox(caixa(153, 10, 253, 30), [A, B], 6)).toEqual({ dx: 0, dy: 0, guides: [], gaps: [] })
    expect(snapBox(caixa(104, 200, 204, 300), [caixa(0, 0, 100, 100)], 6).gaps).toEqual([])
  })
})

describe('snapBox com os vãos — a medida até a peça alinhada (fatia 3)', () => {
  const comVaos = { gaps: true }

  it('borda com borda e a vizinha em cima: o vão vertical entre as duas, ao longo da guia', () => {
    const r = snapBox(caixa(104, 200, 204, 300), [caixa(0, 0, 100, 100)], 6, comVaos)
    expect(r.dx).toBe(-4)
    expect(r.gaps).toEqual([{ axis: 'y', from: 100, to: 200, at: 100 }])
  })

  it('mesma largura (borda, centro e borda alinhados): a medida corre pela guia do centro', () => {
    const r = snapBox(caixa(103, 300, 203, 400), [caixa(100, 0, 200, 100)], 6, comVaos)
    expect(r.guides.map((g) => g.position)).toEqual([100, 150, 200])
    expect(r.gaps).toEqual([{ axis: 'y', from: 100, to: 300, at: 150 }])
  })

  it('várias alinhadas na mesma guia: mede só até a mais perto', () => {
    const r = snapBox(caixa(0, 3, 100, 103), [caixa(300, 20, 400, 80), caixa(650, 30, 750, 70)], 6, comVaos)
    expect(r.dy).toBe(-3)
    expect(r.guides).toEqual([{ axis: 'y', position: 50, from: 50, to: 700, marks: [50, 350, 700] }])
    expect(r.gaps).toEqual([{ axis: 'x', from: 100, to: 300, at: 50 }])
  })

  it('encostada na alinhada (vão zero) ou sobreposta no outro eixo: sem medida', () => {
    const r = snapBox(caixa(103, 0, 203, 100), [caixa(0, 0, 100, 100)], 6, comVaos)
    expect(r.dx).toBe(-3)
    expect(r.guides.length).toBeGreaterThan(0)
    expect(r.gaps).toEqual([])
  })

  it('a medida que já é um vão do espaçamento não sai repetida', () => {
    // Mesma altura da fileira: alinha em y E centraliza em x; o vão até a
    // alinhada mais perto (A) é o mesmo vão esquerdo do espaçamento.
    const r = snapBox(caixa(153, 0, 253, 100), [caixa(0, 0, 100, 100), caixa(300, 0, 400, 100)], 6, comVaos)
    expect(r.dx).toBe(-3)
    expect(r.dy).toBe(0)
    expect(r.gaps).toEqual([
      { axis: 'x', from: 100, to: 150, at: 50 },
      { axis: 'x', from: 250, to: 300, at: 50 },
    ])
  })
})

/**
 * CORREÇÃO da fatia 3: a fileira de um eixo depende de onde a peça está no
 * OUTRO eixo. O espaçamento só puxa a peça se, na posição final, os vãos
 * iguais estão na tela: nada de pulo sem explicação.
 */
describe('snapBox com os vãos — a fileira vale onde a peça termina', () => {
  const comVaos = { gaps: true }
  const A = caixa(0, 0, 100, 100)
  const B = caixa(200, 0, 300, 100)
  const EIXOS: readonly GuideAxis[] = ['x', 'y']

  /** A peça andou no eixo sem guia nele? Então os vãos iguais estão na tela: dois do mesmo tamanho. */
  function puxaoExplicado(r: BoxSnap, eixo: GuideAxis): boolean {
    const ajuste = eixo === 'x' ? r.dx : r.dy
    if (ajuste === 0 || r.guides.some((g) => g.axis === eixo)) return true
    const vaos = r.gaps.filter((g) => g.axis === eixo).map((g) => g.to - g.from)
    return vaos.some((vao, i) => vaos.some((outro, j) => i !== j && Math.abs(vao - outro) < 1e-6))
  }

  it('o encaixe de y tira a peça da fileira: o espaçamento de x não puxa, e fica só a guia de y', () => {
    // M entra 3 px na fileira e repetiria o vão AB a 2 px (x 402 → 400), mas a
    // borda de cima encaixa na de baixo de B (+3): encostada, já não é fileira.
    const r = snapBox(caixa(402, 97, 502, 197), [A, B], 6, comVaos)
    expect(r).toEqual({
      dx: 0,
      dy: 3,
      guides: [{ axis: 'y', position: 100, from: 50, to: 452, marks: [50, 250, 452] }],
      gaps: [{ axis: 'x', from: 300, to: 402, at: 100 }],
    })
  })

  it('varredura em volta da quina da fileira e da coluna: nenhum puxão sem os vãos iguais na tela', () => {
    const coluna = [A, caixa(0, 200, 100, 300)]
    const semExplicacao: string[] = []
    let puxoesPeloEspacamento = 0
    for (let x = 396; x <= 408; x += 0.5) {
      for (let y = 90; y <= 110; y += 0.5) {
        const naFileira = snapBox(caixa(x, y, x + 100, y + 100), [A, B], 6, comVaos)
        const naColuna = snapBox(caixa(y, x, y + 100, x + 100), coluna, 6, comVaos)
        for (const eixo of EIXOS) {
          if (!puxaoExplicado(naFileira, eixo)) semExplicacao.push(`fileira (${x}, ${y}) em ${eixo}`)
          if (!puxaoExplicado(naColuna, eixo)) semExplicacao.push(`coluna (${y}, ${x}) em ${eixo}`)
        }
        if (naFileira.dx !== 0 && !naFileira.guides.some((g) => g.axis === 'x')) puxoesPeloEspacamento += 1
      }
    }
    expect(semExplicacao).toEqual([])
    // A correção não desliga o espaçamento: dentro da fileira, longe do encaixe de y, ele continua puxando.
    expect(puxoesPeloEspacamento).toBeGreaterThan(0)
  })

  it('quando o espaçamento do outro eixo vence, a fileira é conferida de novo: a vizinha baixa volta e x não puxa', () => {
    // Fileira em x: A e B altas (y 0..200) com vão de 100, e R baixa (y 0..100)
    // logo antes de M. Coluna em y: C e D abaixo de M, com vão de 101.
    const altaA = caixa(0, 0, 100, 200)
    const altaB = caixa(200, 0, 300, 200)
    const R = caixa(330, 0, 380, 100)
    const C = caixa(410, 300, 460, 400)
    const D = caixa(410, 501, 460, 601)
    // Com y alinhado (+3, M encosta embaixo de R), R sai da fileira e x repetiria
    // o vão AB (-2). Mas y vence pelo espaçamento da coluna (+2): M fica 1 px
    // dentro da fileira de R, R vira a vizinha de antes, e o vão AB não se repete.
    const r = snapBox(caixa(402, 97, 502, 197), [altaA, altaB, R, C, D], 6, comVaos)
    expect(r).toEqual({
      dx: 0,
      dy: 2,
      guides: [],
      gaps: [
        { axis: 'y', from: 199, to: 300, at: 435 },
        { axis: 'y', from: 400, to: 501, at: 435 },
      ],
    })
  })
})

/**
 * CORREÇÃO da fatia 3: parede solta e linha retas não têm espessura (a caixa é
 * o segmento cru), e sobreposição estrita nunca as junta numa fileira. Pedaços
 * da mesma reta — a parede cortada pelas portas — são fileira.
 */
describe('snapBox com os vãos — retas sem espessura na mesma reta', () => {
  const comVaos = { gaps: true }
  /** Paredes deitadas em y = 100: a caixa de cada uma é o próprio segmento. */
  const W1 = caixa(0, 100, 100, 100)
  const W2 = caixa(200, 100, 300, 100)

  it('parede na mesma reta das outras repete o vão delas, e os dois vãos iguais saem medidos', () => {
    const r = snapBox(caixa(402, 100, 502, 100), [W1, W2], 6, comVaos)
    expect(r).toEqual({
      dx: -2,
      dy: 0,
      guides: [{ axis: 'y', position: 100, from: 50, to: 450, marks: [50, 250, 450] }],
      gaps: [
        { axis: 'x', from: 300, to: 400, at: 100 },
        { axis: 'x', from: 100, to: 200, at: 100 },
      ],
    })
  })

  it('2 px fora da reta (a mão treme no arrasto): o encaixe de y a põe na reta, e o vão igual vale lá', () => {
    const r = snapBox(caixa(402, 102, 502, 102), [W1, W2], 6, comVaos)
    expect(r.dx).toBe(-2)
    expect(r.dy).toBe(-2)
    expect(r.gaps).toEqual([
      { axis: 'x', from: 300, to: 400, at: 100 },
      { axis: 'x', from: 100, to: 200, at: 100 },
    ])
  })

  it('paredes em pé na mesma reta: o mesmo na coluna', () => {
    const r = snapBox(caixa(101, 402, 101, 502), [caixa(100, 0, 100, 100), caixa(100, 200, 100, 300)], 6, comVaos)
    expect(r.dx).toBe(-1)
    expect(r.dy).toBe(-2)
    expect(r.gaps).toEqual([
      { axis: 'y', from: 300, to: 400, at: 100 },
      { axis: 'y', from: 100, to: 200, at: 100 },
    ])
  })

  it('só retas na mesma coordenada: a paralela em outra altura, e a parede encostada na borda das salas, não são fileira', () => {
    expect(snapBox(caixa(402, 150, 502, 150), [W1, W2], 6, comVaos)).toEqual({ dx: 0, dy: 0, guides: [], gaps: [] })
    // Encostar não divide fileira, como nas salas empilhadas.
    expect(snapBox(caixa(402, 100, 502, 100), [caixa(0, 0, 100, 100), caixa(200, 0, 300, 100)], 6, comVaos).dx).toBe(0)
  })
})

describe('dragBoxWithGuides — espaçamento igual no arrasto de corpo (fatia 3)', () => {
  const fileira = [caixa(0, 0, 100, 100), caixa(300, 0, 400, 100)]
  // Já centralizada entre as duas: vãos de 50 e 50.
  const inicio = caixa(150, 10, 250, 30)
  const ponteiroInicial = { x: 200, y: 20 }
  const arrasta = (dx: number, mode: GuideMode) =>
    dragBoxWithGuides({ startBounds: inicio, startPointer: ponteiroInicial, pointer: { x: 200 + dx, y: 20 }, others: fileira, tolerance: 6, mode })

  it('deriva: presa no espaçamento, a peça solta assim que o cursor passa da tolerância e daí acompanha o cursor', () => {
    for (let passo = 1; passo <= 10; passo += 1) {
      const r = arrasta(passo, 'snap')
      if (passo <= 6) {
        expect(r.offsetX).toBe(0)
        expect(r.gaps).toHaveLength(2)
      } else {
        expect(r.offsetX).toBe(passo)
        expect(r.gaps).toEqual([])
      }
    }
  })

  it("'gridExact' (a grade manda): mostra os vãos só quando já são iguais, sem mover a peça", () => {
    expect(arrasta(0, 'gridExact')).toMatchObject({ offsetX: 0, gaps: [{ from: 100, to: 150 }, { from: 250, to: 300 }] })
    expect(arrasta(EXACT_ALIGNMENT_WORLD_PX / 2, 'gridExact')).toMatchObject({ offsetX: EXACT_ALIGNMENT_WORLD_PX / 2 })
    expect(arrasta(EXACT_ALIGNMENT_WORLD_PX / 2, 'gridExact').gaps).toHaveLength(2)
    expect(arrasta(2, 'gridExact')).toEqual({ offsetX: 2, offsetY: 0, guides: [], gaps: [] })
  })

  it("'free' (Ctrl): sem encaixe e sem medida", () => {
    expect(arrasta(3, 'free')).toEqual({ offsetX: 3, offsetY: 0, guides: [], gaps: [] })
  })
})

describe('gapEnds — as duas pontas do vão em px de mundo', () => {
  it("'x' corre na horizontal, na altura `at`; 'y' na vertical", () => {
    expect(gapEnds({ axis: 'x', from: 100, to: 150, at: 20 })).toEqual({ start: { x: 100, y: 20 }, end: { x: 150, y: 20 } })
    expect(gapEnds({ axis: 'y', from: 100, to: 200, at: 150 })).toEqual({ start: { x: 150, y: 100 }, end: { x: 150, y: 200 } })
  })
})

describe('sameOverlay — guias e vãos do passo anterior servem de novo?', () => {
  const guia: SmartGuide = { axis: 'x', position: 150, from: 50, to: 330, marks: [50, 330] }
  const vao: GapMark = { axis: 'y', from: 100, to: 300, at: 150 }
  const quadro: GuideOverlay = { guides: [guia], gaps: [vao] }

  it('mesmas guias e mesmos vãos, em objetos novos: iguais', () => {
    expect(sameOverlay(quadro, { guides: [{ ...guia, marks: [50, 330] }], gaps: [{ ...vao }] })).toBe(true)
    expect(sameOverlay({ guides: [], gaps: [] }, { guides: [], gaps: [] })).toBe(true)
  })

  it('qualquer diferença num vão ou numa guia pede redesenho', () => {
    expect(sameOverlay(quadro, { guides: [guia], gaps: [] })).toBe(false)
    expect(sameOverlay(quadro, { guides: [guia], gaps: [{ ...vao, axis: 'x' }] })).toBe(false)
    expect(sameOverlay(quadro, { guides: [guia], gaps: [{ ...vao, from: 101 }] })).toBe(false)
    expect(sameOverlay(quadro, { guides: [guia], gaps: [{ ...vao, to: 301 }] })).toBe(false)
    expect(sameOverlay(quadro, { guides: [guia], gaps: [{ ...vao, at: 151 }] })).toBe(false)
    expect(sameOverlay(quadro, { guides: [{ ...guia, position: 151 }], gaps: [vao] })).toBe(false)
  })
})
