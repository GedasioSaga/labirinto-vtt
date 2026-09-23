import { describe, expect, it } from 'vitest'
import { LASER_MAX_TRAIL_POINTS, LASER_TRAIL_MS, appendLaserPoints, isLaserKey, pruneLaserTrail } from './laser'

const key = (overrides: Partial<Parameters<typeof isLaserKey>[0]> = {}) => ({ key: 'l', ctrlKey: false, metaKey: false, altKey: false, targetTagName: 'BODY', ...overrides })

describe('isLaserKey', () => {
  it('L e l sem modificador fora de campo liga', () => {
    expect(isLaserKey(key())).toBe(true)
    expect(isLaserKey(key({ key: 'L' }))).toBe(true)
    expect(isLaserKey(key({ targetTagName: '' }))).toBe(true)
    expect(isLaserKey(key({ targetTagName: 'CANVAS' }))).toBe(true)
    expect(isLaserKey(key({ targetTagName: 'BUTTON' }))).toBe(true)
  })

  it('foco em input, textarea ou select nunca liga o laser', () => {
    for (const targetTagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isLaserKey(key({ targetTagName }))).toBe(false)
      expect(isLaserKey(key({ key: 'L', targetTagName }))).toBe(false)
    }
  })

  it('Ctrl, Cmd, Alt ou outra tecla não ligam', () => {
    expect(isLaserKey(key({ ctrlKey: true }))).toBe(false)
    expect(isLaserKey(key({ metaKey: true }))).toBe(false)
    expect(isLaserKey(key({ altKey: true }))).toBe(false)
    expect(isLaserKey(key({ key: 'k' }))).toBe(false)
  })
})

describe('rastro do laser', () => {
  it('pruneLaserTrail tira ponto com LASER_TRAIL_MS de idade e, com keepLast, guarda a ponta', () => {
    const points = [
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 1, t: 500 },
    ]
    expect(pruneLaserTrail(points, LASER_TRAIL_MS - 1)).toEqual(points)
    expect(pruneLaserTrail(points, LASER_TRAIL_MS)).toEqual([points[1]])
    expect(pruneLaserTrail(points, LASER_TRAIL_MS + 500)).toEqual([])
    expect(pruneLaserTrail(points, LASER_TRAIL_MS + 500, true)).toEqual([points[1]])
  })

  it('appendLaserPoints espalha o lote pelo intervalo e termina em now', () => {
    const trail = appendLaserPoints([], [{ x: 1, y: 1 }, { x: 2, y: 2 }], 1000, 50)
    expect(trail).toEqual([
      { x: 1, y: 1, t: 975 },
      { x: 2, y: 2, t: 1000 },
    ])
    expect(appendLaserPoints([], [{ x: 3, y: 3 }], 1000, 50)).toEqual([{ x: 3, y: 3, t: 1000 }])
  })

  it('o rastro guardado não passa do teto', () => {
    const batch = Array.from({ length: LASER_MAX_TRAIL_POINTS + 10 }, (_, i) => ({ x: i, y: 0 }))
    const trail = appendLaserPoints([], batch, 0)
    expect(trail).toHaveLength(LASER_MAX_TRAIL_POINTS)
    expect(trail.at(-1)).toEqual({ x: LASER_MAX_TRAIL_POINTS + 9, y: 0, t: 0 })
  })
})
