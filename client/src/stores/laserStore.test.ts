import { beforeEach, describe, expect, it } from 'vitest'
import { isLaserArmed, laserStrokeEnded, useLaserStore } from './laserStore'

describe('laserStore', () => {
  beforeEach(() => {
    useLaserStore.setState({ held: false, toggled: false, drawing: false, trail: [] })
  })

  it('L ou botão Laser armam; sem armar o traço não começa', () => {
    expect(isLaserArmed(useLaserStore.getState())).toBe(false)
    useLaserStore.getState().setDrawing(true)
    expect(useLaserStore.getState().drawing).toBe(false)

    useLaserStore.getState().setToggled(true)
    expect(isLaserArmed(useLaserStore.getState())).toBe(true)
    // Armar sozinho não é traço.
    expect(useLaserStore.getState().drawing).toBe(false)
    useLaserStore.getState().setDrawing(true)
    expect(useLaserStore.getState().drawing).toBe(true)
  })

  it('desarmar no meio do traço encerra o traço; o outro caminho ainda armado mantém', () => {
    const { setHeld, setToggled, setDrawing } = useLaserStore.getState()
    setHeld(true)
    setToggled(true)
    setDrawing(true)
    setHeld(false)
    expect(useLaserStore.getState().drawing).toBe(true)
    setToggled(false)
    expect(useLaserStore.getState().drawing).toBe(false)
  })

  it('laserStrokeEnded só na transição traço -> sem traço', () => {
    expect(laserStrokeEnded({ drawing: true }, { drawing: false })).toBe(true)
    expect(laserStrokeEnded({ drawing: false }, { drawing: false })).toBe(false)
    expect(laserStrokeEnded({ drawing: false }, { drawing: true })).toBe(false)
    expect(laserStrokeEnded({ drawing: true }, { drawing: true })).toBe(false)
  })
})
