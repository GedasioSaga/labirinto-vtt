import { describe, expect, it, vi } from 'vitest'
import { createSignalSound, playSignalSound, type SignalAudioContext } from './signalSound'

interface FakeNode {
  name: string
}

function fakeParam() {
  return { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
}

function fakeContext(state: AudioContextState = 'running') {
  const destination: FakeNode = { name: 'saida' }
  const gain = { name: 'ganho', gain: fakeParam(), connect: vi.fn() }
  const oscillator = { type: 'square' as OscillatorType, frequency: fakeParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  const context: SignalAudioContext<FakeNode> = {
    currentTime: 2,
    state,
    destination,
    resume: vi.fn(async () => undefined),
    createOscillator: () => oscillator,
    createGain: () => gain,
  }
  return { context, gain, oscillator, destination }
}

describe('signalSound', () => {
  it('sem AudioContext (jsdom) não lança e devolve false', () => {
    expect(() => playSignalSound()).not.toThrow()
    expect(playSignalSound()).toBe(false)
  })

  it('toca um bipe curto ligando oscilador -> ganho -> saída e reaproveita o contexto', () => {
    const fake = fakeContext()
    const create = vi.fn(() => fake.context)
    const play = createSignalSound(create)
    expect(play()).toBe(true)
    expect(play()).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
    expect(fake.oscillator.connect).toHaveBeenCalledWith(fake.gain)
    expect(fake.gain.connect).toHaveBeenCalledWith(fake.destination)
    expect(fake.oscillator.start).toHaveBeenCalledWith(2)
    const stopAt = fake.oscillator.stop.mock.calls[0]?.[0]
    expect(stopAt).toBeGreaterThan(2)
    expect(stopAt).toBeLessThanOrEqual(2.5)
  })

  it('contexto suspenso é retomado; falha ao criar vira false', () => {
    const suspended = fakeContext('suspended')
    createSignalSound(() => suspended.context)()
    expect(suspended.context.resume).toHaveBeenCalled()
    const broken = createSignalSound((): SignalAudioContext<FakeNode> | null => {
      throw new Error('bloqueado')
    })
    expect(broken()).toBe(false)
  })
})
