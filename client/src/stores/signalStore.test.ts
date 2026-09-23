import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_ACTIVE_SIGNALS, SIGNAL_TTL_MS } from '../lib/signals'
import { useSignalStore } from './signalStore'

const SIGNAL = { playerId: 'p1', name: 'Ana', color: '#64b5f6', x: 120, y: 80 }

describe('signalStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSignalStore.getState().clear()
  })
  afterEach(() => {
    useSignalStore.getState().clear()
    vi.useRealTimers()
  })

  it('push guarda o sinal com nome, cor e instante, e ele some sozinho em 3 s', () => {
    const id = useSignalStore.getState().push(SIGNAL, 1000)
    expect(useSignalStore.getState().signals).toEqual([{ id, ...SIGNAL, createdAt: 1000 }])
    vi.advanceTimersByTime(SIGNAL_TTL_MS - 1)
    expect(useSignalStore.getState().signals).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useSignalStore.getState().signals).toEqual([])
  })

  it('clear remove tudo e cancela os timers', () => {
    useSignalStore.getState().push(SIGNAL)
    useSignalStore.getState().push({ ...SIGNAL, playerId: 'p2' })
    useSignalStore.getState().clear()
    expect(useSignalStore.getState().signals).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('acima do teto descarta o mais antigo', () => {
    const first = useSignalStore.getState().push(SIGNAL)
    for (let i = 0; i < MAX_ACTIVE_SIGNALS; i += 1) useSignalStore.getState().push({ ...SIGNAL, x: i })
    const { signals } = useSignalStore.getState()
    expect(signals).toHaveLength(MAX_ACTIVE_SIGNALS)
    expect(signals.some((s) => s.id === first)).toBe(false)
    expect(vi.getTimerCount()).toBe(MAX_ACTIVE_SIGNALS)
  })
})
