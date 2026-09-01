import { describe, expect, it } from 'vitest'
import {
  isValidStairDraft,
  buildStairFromDraft,
  computeStairSteps,
  computeStairArrow,
  stairStepWidthForPreset,
  stairSizePresetForStepWidth,
  STAIR_STEP_SPACING,
  STAIR_SIZE_PRESET_RATIO,
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

describe('computeStairArrow', () => {
  it('direction "up": a ponta fica no fim do segmento, no sentido do traço', () => {
    const segment: StairSegment = { x1: 0, y1: 0, x2: 10, y2: 0 }
    const arrow = computeStairArrow(segment, 'up')
    expect(arrow.tip).toEqual({ x: 10, y: 0 })
    // hastes traseiras ficam atrás da ponta (x menor), não à frente
    expect(arrow.back1.x).toBeLessThan(arrow.tip.x)
    expect(arrow.back2.x).toBeLessThan(arrow.tip.x)
  })

  it('direction "down": a ponta fica no início do segmento, sentido contrário ao traço', () => {
    const segment: StairSegment = { x1: 0, y1: 0, x2: 10, y2: 0 }
    const arrow = computeStairArrow(segment, 'down')
    expect(arrow.tip).toEqual({ x: 0, y: 0 })
    // apontando pra trás (sentido contrário ao traço) -> hastes ficam à frente (x maior)
    expect(arrow.back1.x).toBeGreaterThan(arrow.tip.x)
    expect(arrow.back2.x).toBeGreaterThan(arrow.tip.x)
  })

  it('as duas hastes são simétricas em torno do eixo do traço', () => {
    const segment: StairSegment = { x1: 0, y1: 0, x2: 10, y2: 0 }
    const arrow = computeStairArrow(segment, 'up')
    expect(arrow.back1.y).toBeCloseTo(-arrow.back2.y)
  })
})
