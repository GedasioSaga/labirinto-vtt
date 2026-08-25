import { describe, expect, it } from 'vitest'
import { isValidWallDraft, buildWallFromDraft, buildLightAt, buildRegionFromPoints } from './drawingFactory'

describe('isValidWallDraft', () => {
  it('mesmo ponto de início e fim é inválido (clique sem arrastar)', () => {
    expect(isValidWallDraft({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(false)
  })

  it('pontos diferentes é válido', () => {
    expect(isValidWallDraft({ x: 0, y: 0 }, { x: 64, y: 0 })).toBe(true)
  })
})

describe('buildWallFromDraft', () => {
  it('cria parede sólida (bloqueia luz e movimento, sem porta) com o id dado', () => {
    const wall = buildWallFromDraft('w1', { x: 0, y: 0 }, { x: 64, y: 0 })
    expect(wall).toEqual({
      id: 'w1',
      x1: 0,
      y1: 0,
      x2: 64,
      y2: 0,
      blocksLight: true,
      blocksMove: true,
      door: null,
    })
  })
})

describe('buildLightAt', () => {
  it('cria luz com raio proporcional ao grid e defaults de tocha', () => {
    const light = buildLightAt('l1', { x: 32, y: 32 }, 64)
    expect(light).toEqual({
      id: 'l1',
      x: 32,
      y: 32,
      radius: 512,
      color: '#ffaa33',
      intensity: 0.8,
    })
  })

  it('raio escala com o tamanho do grid', () => {
    const light = buildLightAt('l2', { x: 0, y: 0 }, 32)
    expect(light.radius).toBe(256)
  })
})

describe('buildRegionFromPoints', () => {
  it('cria região com tag default', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r1', points)
    expect(region).toEqual({ id: 'r1', points, tag: 'region', data: {} })
  })

  it('aceita tag customizada', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r2', points, 'trap')
    expect(region.tag).toBe('trap')
  })
})
