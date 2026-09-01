import { describe, expect, it } from 'vitest'
import { isLocked, canInteract, isHidden, rotationToRadians } from './itemTransform'

describe('isLocked / canInteract', () => {
  it('caso típico: locked true bloqueia interação, locked false libera', () => {
    expect(isLocked({ locked: true })).toBe(true)
    expect(canInteract({ locked: true })).toBe(false)
    expect(isLocked({ locked: false })).toBe(false)
    expect(canInteract({ locked: false })).toBe(true)
  })

  it('campo opcional ausente (undefined): trata como não travado, nunca === null', () => {
    const semCampo = {} as { locked?: boolean }
    expect(isLocked(semCampo)).toBe(false)
    expect(canInteract(semCampo)).toBe(true)
  })
})

describe('isHidden', () => {
  it('caso típico: hidden true/false', () => {
    expect(isHidden({ hidden: true })).toBe(true)
    expect(isHidden({ hidden: false })).toBe(false)
  })

  it('campo opcional ausente (undefined): trata como visível', () => {
    const semCampo = {} as { hidden?: boolean }
    expect(isHidden(semCampo)).toBe(false)
  })
})

describe('rotationToRadians', () => {
  it('caso típico: graus para radianos', () => {
    expect(rotationToRadians(180)).toBeCloseTo(Math.PI)
    expect(rotationToRadians(90)).toBeCloseTo(Math.PI / 2)
    expect(rotationToRadians(360)).toBeCloseTo(Math.PI * 2)
  })

  it('campo opcional ausente (undefined): 0 radiano, aparência idêntica à de hoje', () => {
    expect(rotationToRadians(undefined)).toBe(0)
  })
})
