import { afterEach, describe, expect, it, vi } from 'vitest'
import { withViewTransition } from './viewTransition'

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition')
  Reflect.deleteProperty(window, 'matchMedia')
  vi.restoreAllMocks()
})

describe('withViewTransition', () => {
  it('sem a API troca na hora', () => {
    const update = vi.fn()
    withViewTransition(update)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('com a API, a troca roda dentro da transição', () => {
    const start = vi.fn((cb: () => void) => cb())
    Reflect.set(document, 'startViewTransition', start)
    const update = vi.fn()
    withViewTransition(update)
    expect(start).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('com "reduzir movimento" pula a transição', () => {
    const start = vi.fn()
    Reflect.set(document, 'startViewTransition', start)
    Reflect.set(window, 'matchMedia', () => ({ matches: true }))
    const update = vi.fn()
    withViewTransition(update)
    expect(start).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
