import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import {
  REVISIT_BLINKS,
  REVISIT_COLOR,
  REVISIT_PULSE_DURATION_MS,
  drawRevisitPulse,
  revisitIntensity,
} from './revisitPulse'

/** Picos de brilho numa varredura de 5 em 5 ms: é quantas vezes a área acende. */
function picos(reducedMotion: boolean): number {
  let count = 0
  let before = revisitIntensity(0, reducedMotion)
  let rising = false
  for (let ms = 5; ms <= REVISIT_PULSE_DURATION_MS; ms += 5) {
    const now = revisitIntensity(ms, reducedMotion)
    if (now > before) rising = true
    else if (now < before && rising) {
      count += 1
      rising = false
    }
    before = now
  }
  return count
}

const AREA = { minX: 100, minY: 120, maxX: 180, maxY: 170 }

describe('revisitPulse — a área que mudou pisca e apaga sozinha', () => {
  it('pisca exatamente REVISIT_BLINKS vezes, começando e terminando apagada', () => {
    expect(REVISIT_BLINKS).toBe(3)
    expect(picos(false)).toBe(REVISIT_BLINKS)
    expect(revisitIntensity(0, false)).toBe(0)
    const pico = REVISIT_PULSE_DURATION_MS / REVISIT_BLINKS / 2
    expect(revisitIntensity(pico, false)).toBeCloseTo(1, 5)
    expect(revisitIntensity(pico, false)).toBeGreaterThan(0.99)
    expect(revisitIntensity(REVISIT_PULSE_DURATION_MS, false)).toBe(0)
  })

  it('com movimento reduzido não pisca: acende fixo e apaga no fim', () => {
    expect(picos(true)).toBe(0)
    expect(revisitIntensity(10, true)).toBe(1)
    expect(revisitIntensity(REVISIT_PULSE_DURATION_MS - 1, true)).toBe(1)
    expect(revisitIntensity(REVISIT_PULSE_DURATION_MS, true)).toBe(0)
  })

  it('desenha contorno e véu na cor do aviso em cada área enquanto dura; depois esvazia e devolve false', () => {
    const g = new Graphics()
    const pico = REVISIT_PULSE_DURATION_MS / REVISIT_BLINKS / 2
    expect(drawRevisitPulse(g, [AREA, { minX: 300, minY: 300, maxX: 340, maxY: 330 }], pico, false)).toBe(true)
    const acoes = g.context.instructions.map((i) => i.action)
    expect(acoes.filter((a) => a === 'stroke')).toHaveLength(2)
    expect(acoes.filter((a) => a === 'fill')).toHaveLength(2)
    const traco = g.context.instructions.find((i) => i.action === 'stroke')
    expect(traco?.action === 'stroke' ? traco.data.style.color : null).toBe(REVISIT_COLOR)

    expect(drawRevisitPulse(g, [AREA], REVISIT_PULSE_DURATION_MS, false)).toBe(false)
    expect(g.context.instructions).toHaveLength(0)
  })

  it('tempo inválido não desenha nada', () => {
    const g = new Graphics()
    expect(drawRevisitPulse(g, [AREA], Number.NaN, false)).toBe(false)
    expect(drawRevisitPulse(g, [AREA], -1, false)).toBe(false)
    expect(g.context.instructions).toHaveLength(0)
  })
})
