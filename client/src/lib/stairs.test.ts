import { describe, expect, it } from 'vitest'
import {
  isValidStairDraft,
  buildStairFromDraft,
  computeStairSteps,
  computeStairPlan,
  stairStepWidthForPreset,
  stairSizePresetForStepWidth,
  STAIR_STEP_SPACING,
  STAIR_SIZE_PRESET_RATIO,
  STAIR_TREAD_WIDTH_AT_FOOT,
  STAIR_TREAD_WIDTH_AT_TOP,
  type StairTread,
} from './stairs'
import type { StairSegment } from '../types/map'

describe('isValidStairDraft', () => {
  it('rejeita clique sem arrasto (start === end)', () => {
    expect(isValidStairDraft({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })

  it('aceita qualquer arrasto com comprimento não-zero', () => {
    expect(isValidStairDraft({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true)
    expect(isValidStairDraft({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(true)
  })
})

describe('buildStairFromDraft', () => {
  it('produz uma escada reta com 1 segmento, direction default "up"', () => {
    const stair = buildStairFromDraft('s1', { x: 0, y: 0 }, { x: 32, y: 0 }, 24)
    expect(stair).toEqual({
      id: 's1',
      shape: 'straight',
      direction: 'up',
      segments: [{ x1: 0, y1: 0, x2: 32, y2: 0 }],
      stepWidth: 24,
    })
  })

  it('aceita direction explícita', () => {
    const stair = buildStairFromDraft('s2', { x: 0, y: 0 }, { x: 0, y: 20 }, 16, 'down')
    expect(stair.direction).toBe('down')
  })

  it('aceita shape explícita sem quebrar o default (chamador que não passa nada continua com "straight")', () => {
    const straight = buildStairFromDraft('s3', { x: 0, y: 0 }, { x: 10, y: 0 }, 24)
    expect(straight.shape).toBe('straight')

    const doubled = buildStairFromDraft('s4', { x: 0, y: 0 }, { x: 10, y: 0 }, 24, 'up', 'double')
    expect(doubled.shape).toBe('double')
  })
})

describe('stairStepWidthForPreset', () => {
  it('"medium" bate com o default de criação de hoje (stepWidth = map.grid)', () => {
    expect(stairStepWidthForPreset('medium', 64)).toBe(64)
  })

  it('"small" é metade da grade, "large" é o dobro', () => {
    expect(stairStepWidthForPreset('small', 64)).toBe(32)
    expect(stairStepWidthForPreset('large', 64)).toBe(128)
  })

  it('acompanha qualquer grid do mapa, não só o default 64', () => {
    expect(stairStepWidthForPreset('medium', 50)).toBe(50)
    expect(stairStepWidthForPreset('small', 50)).toBe(25)
    expect(stairStepWidthForPreset('large', 50)).toBe(100)
  })
})

describe('stairSizePresetForStepWidth', () => {
  it('reconhece os 3 presets exatos para o grid dado', () => {
    expect(stairSizePresetForStepWidth(32, 64)).toBe('small')
    expect(stairSizePresetForStepWidth(64, 64)).toBe('medium')
    expect(stairSizePresetForStepWidth(128, 64)).toBe('large')
  })

  it('devolve undefined para um valor que não bate com nenhum preset (campo numérico fino)', () => {
    expect(stairSizePresetForStepWidth(40, 64)).toBeUndefined()
  })

  it('devolve undefined para o campo opcional ausente — stepWidth de escada legada sem preset correspondente', () => {
    // Simula o caso "campo novo ausente" de mapa salvo antigo: qualquer
    // stepWidth que não seja múltiplo exato de STAIR_SIZE_PRESET_RATIO não
    // marca nenhum preset como ativo, em vez de escolher um às cegas.
    const legacyStepWidth = 1
    expect(stairSizePresetForStepWidth(legacyStepWidth, 64)).toBeUndefined()
    expect(Object.values(STAIR_SIZE_PRESET_RATIO)).toEqual([0.5, 1, 2])
  })
})

describe('computeStairSteps', () => {
  it('segmento de comprimento zero não gera degrau nenhum', () => {
    const segment: StairSegment = { x1: 10, y1: 10, x2: 10, y2: 10 }
    expect(computeStairSteps(segment, 20)).toEqual([])
  })

  it('gera degraus igualmente espaçados, perpendiculares ao lance, cobrindo as duas pontas', () => {
    // comprimento 32 == 2x STAIR_STEP_SPACING (16) -> 2 passos -> 3 degraus (t=0, 0.5, 1)
    const segment: StairSegment = { x1: 0, y1: 0, x2: 2 * STAIR_STEP_SPACING, y2: 0 }
    const steps = computeStairSteps(segment, 20)
    expect(steps).toHaveLength(3)

    // segmento horizontal -> perpendicular é vertical: cada degrau é uma
    // linha vertical (mesmo x nas duas pontas), centrada em y=0, largura=stepWidth
    for (const [i, step] of steps.entries()) {
      const expectedX = i * STAIR_STEP_SPACING
      expect(step.x1).toBeCloseTo(expectedX)
      expect(step.x2).toBeCloseTo(expectedX)
      expect(step.y1).toBeCloseTo(10)
      expect(step.y2).toBeCloseTo(-10)
    }
  })

  it('lance curto (menor que STAIR_STEP_SPACING) ainda produz pelo menos 1 passo (2 degraus)', () => {
    const segment: StairSegment = { x1: 0, y1: 0, x2: 4, y2: 0 }
    const steps = computeStairSteps(segment, 10)
    expect(steps).toHaveLength(2)
    expect(steps[0].x1).toBeCloseTo(0)
    expect(steps[1].x1).toBeCloseTo(4)
  })
})

describe('computeStairPlan', () => {
  /** Lance deitado para a direita: `at(along, across)` vira (along, across). */
  const horizontal = (length: number): StairSegment => ({ x1: 0, y1: 0, x2: length, y2: 0 })
  /** Avanço do bico do degrau ao longo do lance. */
  const bicoDe = (tread: StairTread): number => tread.points[1].x - tread.points[0].x

  it('segmento de comprimento zero não tem lance para planejar', () => {
    expect(computeStairPlan({ x1: 7, y1: 7, x2: 7, y2: 7 }, 64, 'up')).toBeNull()
  })

  it('"up" sobe no sentido do traço e "down" desce: o topo troca de ponta, o pé também', () => {
    const segment = horizontal(256)
    const up = computeStairPlan(segment, 64, 'up')
    const down = computeStairPlan(segment, 64, 'down')
    expect(up?.foot).toEqual({ x: 0, y: 0 })
    expect(up?.top).toEqual({ x: 256, y: 0 })
    expect(down?.foot).toEqual({ x: 256, y: 0 })
    expect(down?.top).toEqual({ x: 0, y: 0 })
  })

  it('as vigas correm o lance inteiro, uma de cada lado do eixo', () => {
    const plan = computeStairPlan(horizontal(256), 64, 'up')
    if (!plan) throw new Error('lance válido devolveu null')
    expect(plan.rails[0]).toEqual([{ x: 0, y: 32 }, { x: 256, y: 32 }])
    expect(plan.rails[1]).toEqual([{ x: 0, y: -32 }, { x: 256, y: -32 }])
  })

  it('todo degrau aponta para o alto do lance, de viga a viga', () => {
    const plan = computeStairPlan(horizontal(256), 64, 'up')
    if (!plan) throw new Error('lance válido devolveu null')
    expect(plan.treads.length).toBeGreaterThan(4)
    for (const tread of plan.treads) {
      const [ladoA, bico, ladoB] = tread.points
      expect(ladoA.y).toBeCloseTo(32) // encosta numa viga
      expect(ladoB.y).toBeCloseTo(-32) // e na outra
      expect(bico.y).toBeCloseTo(0) // bico no eixo
      expect(bico.x).toBeGreaterThan(ladoA.x) // avançado ladeira acima
      expect(ladoA.x).toBeCloseTo(ladoB.x)
    }
  })

  it('"down" espelha: o mesmo degrau aponta para o outro lado', () => {
    const plan = computeStairPlan(horizontal(256), 64, 'down')
    if (!plan) throw new Error('lance válido devolveu null')
    for (const tread of plan.treads) expect(tread.points[1].x).toBeLessThan(tread.points[0].x)
  })

  it('o degrau engorda e o tom sobe do pé para o topo (climb 0 -> 1)', () => {
    const plan = computeStairPlan(horizontal(256), 64, 'up')
    if (!plan) throw new Error('lance válido devolveu null')
    const primeiro = plan.treads[0]
    const ultimo = plan.treads[plan.treads.length - 1]
    expect(primeiro.climb).toBe(0)
    expect(ultimo.climb).toBe(1)
    expect(primeiro.width).toBeCloseTo(64 * STAIR_TREAD_WIDTH_AT_FOOT, 6)
    expect(ultimo.width).toBeCloseTo(64 * STAIR_TREAD_WIDTH_AT_TOP, 6)
    for (const [i, tread] of plan.treads.entries()) {
      if (i === 0) continue
      expect(tread.width).toBeGreaterThan(plan.treads[i - 1].width)
    }
  })

  it('nenhum traço passa das pontas do lance: o bico mais alto encosta no topo', () => {
    const plan = computeStairPlan(horizontal(256), 64, 'up')
    if (!plan) throw new Error('lance válido devolveu null')
    expect(plan.treads[0].points[0].x).toBeCloseTo(0)
    expect(plan.treads[plan.treads.length - 1].points[1].x).toBeCloseTo(256)
    for (const tread of plan.treads) expect(tread.points[1].x).toBeLessThanOrEqual(256 + 1e-9)
  })

  it('o bico alcança a base do degrau seguinte: nunca sobra faixa de chão atravessando o lance', () => {
    for (const stepWidth of [16, 32, 64, 128]) {
      const plan = computeStairPlan(horizontal(400), stepWidth, 'up')
      if (!plan) throw new Error('lance válido devolveu null')
      const passo = plan.treads[1].points[0].x - plan.treads[0].points[0].x
      expect(bicoDe(plan.treads[0])).toBeGreaterThanOrEqual(passo)
    }
  })

  it('degrau e espaçamento acompanham a largura do lance, não um px fixo', () => {
    const estreito = computeStairPlan(horizontal(256), 32, 'up')
    const largo = computeStairPlan(horizontal(256), 128, 'up')
    if (!estreito || !largo) throw new Error('lance válido devolveu null')
    expect(largo.treads.length).toBeLessThan(estreito.treads.length)
    expect(largo.treads[0].width).toBeCloseTo(4 * estreito.treads[0].width, 6)
  })

  it('lance mais curto que um degrau ainda desenha alguma coisa', () => {
    const plan = computeStairPlan(horizontal(6), 64, 'up')
    if (!plan) throw new Error('lance válido devolveu null')
    expect(plan.treads.length).toBeGreaterThanOrEqual(2)
    for (const tread of plan.treads) expect(tread.points[1].x).toBeLessThanOrEqual(6 + 1e-9)
  })

  it('lance vertical: o degrau continua atravessando o lance, bico para o topo', () => {
    const plan = computeStairPlan({ x1: 0, y1: 0, x2: 0, y2: 128 }, 64, 'up')
    if (!plan) throw new Error('lance válido devolveu null')
    for (const tread of plan.treads) {
      const [ladoA, bico, ladoB] = tread.points
      expect(Math.abs(ladoA.x - ladoB.x)).toBeCloseTo(64)
      expect(bico.x).toBeCloseTo(0)
      expect(bico.y).toBeGreaterThan(ladoA.y)
    }
  })
})
