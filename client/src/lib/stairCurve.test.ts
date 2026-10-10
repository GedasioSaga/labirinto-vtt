import { describe, expect, it } from 'vitest'
import type { Stair } from '../types/map'
import {
  clampStairLength,
  clampStairWidth,
  curvaForTurnDegrees,
  stairArcOf,
  stairCenterline,
  stairCurveLimit,
  stairCurveOf,
  stairLength,
  stairMaxTurnDegrees,
  stairTurnDegrees,
  STAIR_MAX_LENGTH_CELLS,
  STAIR_MAX_WIDTH_CELLS,
  STAIR_MIN_CELLS,
  withStairLength,
} from './stairCurve'

const GRID = 70

function escada(overrides: Partial<Stair> = {}): Stair {
  return {
    id: 's1',
    shape: 'straight',
    direction: 'up',
    segments: [{ x1: 0, y1: 0, x2: 280, y2: 0 }],
    stepWidth: 70,
    ...overrides,
  }
}

const perto = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

describe('stairCurveOf — a curva que vale para o desenho', () => {
  it('ausente, zero ou não-número = reta', () => {
    expect(stairCurveOf(escada())).toBe(0)
    expect(stairCurveOf(escada({ curva: 0 }))).toBe(0)
    expect(stairCurveOf(escada({ curva: Number.NaN }))).toBe(0)
    expect(stairCurveOf(escada({ curva: Number.POSITIVE_INFINITY }))).toBe(0)
  })

  it('só a escada reta de um lance curva: espiral, L e dupla ficam retas', () => {
    expect(stairCurveOf(escada({ curva: 40 }))).toBe(40)
    expect(stairCurveOf(escada({ curva: 40, shape: 'spiral' }))).toBe(0)
    expect(stairCurveOf(escada({ curva: 40, shape: 'l' }))).toBe(0)
    expect(stairCurveOf(escada({ curva: 40, shape: 'double' }))).toBe(0)
    expect(stairCurveOf(escada({ curva: 40, segments: [] }))).toBe(0)
  })

  it('curva acima do limite é limitada, com o sinal guardado', () => {
    const limite = stairCurveLimit(280, 70)
    expect(stairCurveOf(escada({ curva: 10_000 }))).toBe(limite)
    expect(stairCurveOf(escada({ curva: -10_000 }))).toBe(-limite)
  })

  it('curva de menos de meio px é desenhada reta (o arco seria invisível)', () => {
    expect(stairCurveOf(escada({ curva: 0.3 }))).toBe(0)
  })
})

describe('stairCurveLimit — os degraus radiais nunca se cruzam', () => {
  it('escada longa e estreita chega a meia volta (flecha = meia corda)', () => {
    expect(stairCurveLimit(280, 70)).toBe(140)
  })

  it('escada larga e curta para antes: o raio de dentro fica com meia largura', () => {
    const limite = stairCurveLimit(140, 140)
    const arco = stairArcOf({ x1: 0, y1: 0, x2: 140, y2: 0 }, limite)
    expect(arco).not.toBeNull()
    // Raio do meio = largura: o de dentro sobra com meia largura, sem nó no centro.
    expect(perto(arco?.radius ?? 0, 140, 1e-6)).toBe(true)
    expect(limite).toBeLessThan(70)
  })

  it('lance sem comprimento não curva', () => {
    expect(stairCurveLimit(0, 70)).toBe(0)
    expect(stairCurveLimit(Number.NaN, 70)).toBe(0)
  })
})

describe('stairArcOf — o arco passa pelas duas pontas e pelo meio', () => {
  it('flecha positiva vai para a esquerda de quem anda de (x1,y1) para (x2,y2)', () => {
    const seg = { x1: 0, y1: 0, x2: 200, y2: 0 }
    const arco = stairArcOf(seg, 50)
    if (arco === null) throw new Error('esperava arco')
    const ponto = (angulo: number) => ({ x: arco.center.x + arco.radius * Math.cos(angulo), y: arco.center.y + arco.radius * Math.sin(angulo) })
    const inicio = ponto(arco.startAngle)
    const fim = ponto(arco.startAngle + arco.sweep)
    const meio = ponto(arco.startAngle + arco.sweep / 2)
    expect(perto(inicio.x, 0) && perto(inicio.y, 0)).toBe(true)
    expect(perto(fim.x, 200) && perto(fim.y, 0)).toBe(true)
    // Perpendicular (−dy, dx) de (200, 0) é (0, 200): y positivo, para baixo na tela.
    expect(perto(meio.x, 100) && perto(meio.y, 50)).toBe(true)
  })

  it('vale para qualquer direção do lance (escada girada)', () => {
    const seg = { x1: 10, y1: 20, x2: 10 + 120, y2: 20 + 160 } // 200 de corda, na diagonal
    const arco = stairArcOf(seg, -30)
    if (arco === null) throw new Error('esperava arco')
    const meio = { x: arco.center.x + arco.radius * Math.cos(arco.startAngle + arco.sweep / 2), y: arco.center.y + arco.radius * Math.sin(arco.startAngle + arco.sweep / 2) }
    // Normal (−dy, dx)/L = (−0,8, 0,6); flecha −30 = (24, −18) a partir do meio (70, 100).
    expect(perto(meio.x, 70 + 24) && perto(meio.y, 100 - 18)).toBe(true)
  })

  it('reta não tem arco', () => {
    expect(stairArcOf({ x1: 0, y1: 0, x2: 100, y2: 0 }, 0)).toBeNull()
    expect(stairArcOf({ x1: 0, y1: 0, x2: 0, y2: 0 }, 10)).toBeNull()
  })
})

describe('stairTurnDegrees / curvaForTurnDegrees — a volta em graus', () => {
  it('meia volta = 180°, um quarto = 90°, reta = 0', () => {
    expect(stairTurnDegrees(escada())).toBe(0)
    expect(perto(stairTurnDegrees(escada({ curva: 140 })), 180)).toBe(true)
    const quarto = curvaForTurnDegrees(90, 280)
    expect(perto(stairTurnDegrees(escada({ curva: quarto })), 90)).toBe(true)
    expect(perto(stairTurnDegrees(escada({ curva: -quarto })), -90)).toBe(true)
  })

  it('o teto em graus segue o limite da flecha e é 0 nas formas que não curvam', () => {
    expect(perto(stairMaxTurnDegrees(escada()), 180)).toBe(true)
    expect(stairMaxTurnDegrees(escada({ shape: 'spiral' }))).toBe(0)
    expect(stairMaxTurnDegrees(escada({ stepWidth: 280 }))).toBeLessThan(180)
  })
})

describe('stairCenterline — a linha do meio que clique, borracha e área usam', () => {
  it('reta devolve os próprios lances', () => {
    const reta = escada()
    expect(stairCenterline(reta)).toBe(reta.segments)
  })

  it('curva vira cordas encadeadas sobre o arco, das pontas exatas', () => {
    const curva = escada({ curva: 100 })
    const cordas = stairCenterline(curva)
    expect(cordas.length).toBeGreaterThan(4)
    expect(cordas[0].x1).toBe(0)
    expect(cordas[0].y1).toBe(0)
    expect(cordas[cordas.length - 1].x2).toBe(280)
    expect(cordas[cordas.length - 1].y2).toBe(0)
    for (let i = 1; i < cordas.length; i += 1) {
      expect(cordas[i].x1).toBe(cordas[i - 1].x2)
      expect(cordas[i].y1).toBe(cordas[i - 1].y2)
    }
    // Algum vértice passa pelo meio do arco (140, 100).
    expect(cordas.some((c) => perto(c.x2, 140, 1e-6) && perto(c.y2, 100, 1e-6))).toBe(true)
  })
})

describe('tamanho: limites e mudança de comprimento', () => {
  it('largura e comprimento ficam entre o mínimo e o máximo, em casas', () => {
    expect(clampStairWidth(0, GRID)).toBe(GRID * STAIR_MIN_CELLS)
    expect(clampStairWidth(-50, GRID)).toBe(GRID * STAIR_MIN_CELLS)
    expect(clampStairWidth(Number.NaN, GRID)).toBe(GRID * STAIR_MIN_CELLS)
    expect(clampStairWidth(1e9, GRID)).toBe(GRID * STAIR_MAX_WIDTH_CELLS)
    expect(clampStairLength(0, GRID)).toBe(GRID * STAIR_MIN_CELLS)
    expect(clampStairLength(1e9, GRID)).toBe(GRID * STAIR_MAX_LENGTH_CELLS)
    expect(clampStairLength(210, GRID)).toBe(210)
  })

  it('comprimento novo com a ponta de cima parada: só (x1,y1) anda, na mesma reta', () => {
    const nova = withStairLength(escada(), 140, 'end')
    expect(nova.segments[0]).toEqual({ x1: 140, y1: 0, x2: 280, y2: 0 })
    expect(stairLength(nova)).toBe(140)
  })

  it('com a ponta do começo parada: só (x2,y2) anda', () => {
    const nova = withStairLength(escada({ segments: [{ x1: 0, y1: 0, x2: 0, y2: 280 }] }), 420, 'start')
    expect(nova.segments[0]).toEqual({ x1: 0, y1: 0, x2: 0, y2: 420 })
  })

  it('a curva acompanha o comprimento: a volta em graus não muda', () => {
    const antes = escada({ curva: 60 })
    const depois = withStairLength(antes, 140, 'start')
    expect(depois.curva).toBe(30)
    expect(perto(stairTurnDegrees(depois), stairTurnDegrees(antes))).toBe(true)
  })

  it('L e dupla escalam inteiras a partir da ponta parada', () => {
    const l = escada({ shape: 'l', segments: [{ x1: 0, y1: 0, x2: 100, y2: 0 }, { x1: 100, y1: 0, x2: 100, y2: 100 }] })
    const nova = withStairLength(l, 400, 'start')
    expect(nova.segments).toEqual([{ x1: 0, y1: 0, x2: 200, y2: 0 }, { x1: 200, y1: 0, x2: 200, y2: 200 }])
  })

  it('comprimento inválido ou lance zero devolve a mesma escada', () => {
    const reta = escada()
    expect(withStairLength(reta, 0, 'start')).toBe(reta)
    expect(withStairLength(reta, Number.NaN, 'start')).toBe(reta)
    expect(withStairLength(reta, 280, 'start')).toBe(reta)
    const zero = escada({ segments: [{ x1: 5, y1: 5, x2: 5, y2: 5 }] })
    expect(withStairLength(zero, 100, 'start')).toBe(zero)
  })
})
