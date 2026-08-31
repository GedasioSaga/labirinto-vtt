import { describe, expect, it } from 'vitest'
import { clampScale, panBy, zoomAt, constrainToAngleStep, angleDegrees, MIN_SCALE, MAX_SCALE } from './world'

describe('clampScale', () => {
  it('mantém valor dentro do intervalo', () => {
    expect(clampScale(1)).toBe(1)
  })

  it('trava no mínimo', () => {
    expect(clampScale(0)).toBe(MIN_SCALE)
  })

  it('trava no máximo', () => {
    expect(clampScale(999)).toBe(MAX_SCALE)
  })
})

describe('panBy', () => {
  it('desloca x/y e preserva escala', () => {
    const result = panBy({ x: 10, y: 10, scale: 2 }, 5, -3)
    expect(result).toEqual({ x: 15, y: 7, scale: 2 })
  })
})

describe('zoomAt', () => {
  it('mantém o ponto do mundo sob o cursor fixo ao aplicar zoom', () => {
    const camera = { x: 0, y: 0, scale: 1 }
    const pointer = { x: 400, y: 300 }

    const worldBefore = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }

    const next = zoomAt(camera, pointer, -100)

    const worldAfter = {
      x: (pointer.x - next.x) / next.scale,
      y: (pointer.y - next.y) / next.scale,
    }

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6)
  })

  it('wheel negativo (scroll pra cima) aumenta o zoom', () => {
    const next = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, -100)
    expect(next.scale).toBeGreaterThan(1)
  })

  it('wheel positivo (scroll pra baixo) diminui o zoom', () => {
    const next = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100)
    expect(next.scale).toBeLessThan(1)
  })
})

describe('constrainToAngleStep', () => {
  it('~37 graus livre (dx=4,dy=3) com step 45 (default) trava em 45 graus, preservando a distância do start', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 4, y: 3 })
    const expected = 5 * Math.SQRT1_2 // distância 5, ângulo 45°
    expect(result.x).toBeCloseTo(expected, 6)
    expect(result.y).toBeCloseTo(expected, 6)
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(5, 6)
  })

  it('mesmo ~37 graus livre com step 90 explícito: cai no eixo mais próximo (só 4 direções), preservando a distância (diferente da versão antiga, que truncava pro eixo dominante)', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 4, y: 3 }, 90)
    expect(result).toEqual({ x: 5, y: 0 })
  })

  it('step 45: ângulo perto de 90° (dx pequeno, dy grande) trava em 90°, preservando a distância', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 1, y: 10 })
    const distance = Math.hypot(1, 10)
    expect(result.x).toBeCloseTo(0, 6)
    expect(result.y).toBeCloseTo(distance, 6)
  })

  it('exatamente 45 graus (dx === dy): com step 45 o resultado FICA na diagonal — 45° agora é um ângulo travado válido, não é mais forçado pro eixo vertical', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 50, y: 50 })
    expect(result.x).toBeCloseTo(50, 6)
    expect(result.y).toBeCloseTo(50, 6)
  })

  it('funciona com deslocamento negativo (arrasto pra esquerda/cima) — trava em 180°', () => {
    const result = constrainToAngleStep({ x: 200, y: 200 }, { x: 120, y: 210 })
    const distance = Math.hypot(80, 10)
    expect(result.x).toBeCloseTo(200 - distance, 6)
    expect(result.y).toBeCloseTo(200, 6)
  })

  it('start != origem: resultado é relativo ao ponto inicial, não a (0,0)', () => {
    const result = constrainToAngleStep({ x: 500, y: 300 }, { x: 500, y: 450 })
    expect(result.x).toBeCloseTo(500, 6)
    expect(result.y).toBeCloseTo(450, 6)
  })

  it('start === end (arrasto de distância zero): não quebra nem retorna NaN', () => {
    const result = constrainToAngleStep({ x: 10, y: 10 }, { x: 10, y: 10 })
    expect(result.x).toBeCloseTo(10, 6)
    expect(result.y).toBeCloseTo(10, 6)
  })
})

describe('angleDegrees', () => {
  it('0° pra direita, 90° pra baixo, 180° pra esquerda, 270° pra cima — sempre em [0,360)', () => {
    expect(angleDegrees({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 6)
    expect(angleDegrees({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6)
    expect(angleDegrees({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180, 6)
    expect(angleDegrees({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(270, 6)
  })

  it('start != origem: ângulo é relativo ao ponto inicial', () => {
    expect(angleDegrees({ x: 500, y: 300 }, { x: 500, y: 450 })).toBeCloseTo(90, 6)
  })
})
