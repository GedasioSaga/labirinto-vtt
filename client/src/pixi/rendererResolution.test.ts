import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_RENDERER_RESOLUTION, chooseRendererResolution, watchDevicePixelRatio } from './rendererResolution'

describe('chooseRendererResolution', () => {
  it('usa o devicePixelRatio dentro da faixa', () => {
    expect(chooseRendererResolution(1)).toBe(1)
    expect(chooseRendererResolution(1.25)).toBe(1.25)
    expect(chooseRendererResolution(1.5)).toBe(1.5)
    expect(chooseRendererResolution(2)).toBe(2)
  })

  it('não desce abaixo de 1 (zoom de navegador reduzido)', () => {
    expect(chooseRendererResolution(0.5)).toBe(1)
    expect(chooseRendererResolution(0)).toBe(1)
    expect(chooseRendererResolution(-2)).toBe(1)
  })

  it('limita ao teto para não estourar memória', () => {
    expect(MAX_RENDERER_RESOLUTION).toBe(3)
    expect(chooseRendererResolution(3)).toBe(3)
    expect(chooseRendererResolution(4)).toBe(3)
    expect(chooseRendererResolution(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('valor ausente ou inválido vira 1', () => {
    expect(chooseRendererResolution(undefined)).toBe(1)
    expect(chooseRendererResolution(Number.NaN)).toBe(1)
  })
})

describe('watchDevicePixelRatio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // jsdom não implementa matchMedia: o stub faz o papel do navegador.
  function stubMatchMedia() {
    const queries: { media: string; listener: (() => void) | null; removed: boolean }[] = []
    vi.stubGlobal('matchMedia', (media: string) => {
      const entry = { media, listener: null as (() => void) | null, removed: false }
      queries.push(entry)
      return {
        media,
        matches: true,
        addEventListener: (_type: string, listener: () => void) => {
          entry.listener = listener
        },
        removeEventListener: (_type: string, listener: () => void) => {
          if (entry.listener === listener) entry.removed = true
        },
      } as unknown as MediaQueryList
    })
    return queries
  }

  it('avisa a resolução nova e refaz a query com o dppx novo', () => {
    const queries = stubMatchMedia()
    vi.stubGlobal('devicePixelRatio', 1)
    const onChange = vi.fn()
    watchDevicePixelRatio(onChange)
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 1dppx)'])

    vi.stubGlobal('devicePixelRatio', 1.5)
    queries[0].listener?.()
    expect(onChange).toHaveBeenCalledWith(1.5)
    expect(queries.map((q) => q.media)).toEqual(['(resolution: 1dppx)', '(resolution: 1.5dppx)'])

    vi.stubGlobal('devicePixelRatio', 5)
    queries[1].listener?.()
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('resize da janela também detecta a troca, sem avisar duas vezes o mesmo valor', () => {
    const queries = stubMatchMedia()
    vi.stubGlobal('devicePixelRatio', 1)
    const onChange = vi.fn()
    const stop = watchDevicePixelRatio(onChange)

    window.dispatchEvent(new Event('resize'))
    expect(onChange).not.toHaveBeenCalled()

    vi.stubGlobal('devicePixelRatio', 1.25)
    window.dispatchEvent(new Event('resize'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(1.25)
    // O 'change' atrasado da query antiga não repete o aviso.
    queries[0].listener?.()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(queries[queries.length - 1].media).toBe('(resolution: 1.25dppx)')

    stop()
    vi.stubGlobal('devicePixelRatio', 2)
    window.dispatchEvent(new Event('resize'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('cleanup remove o listener e ignora troca posterior', () => {
    const queries = stubMatchMedia()
    vi.stubGlobal('devicePixelRatio', 1.25)
    const onChange = vi.fn()
    const stop = watchDevicePixelRatio(onChange)
    stop()
    expect(queries[0].removed).toBe(true)
    queries[0].listener?.()
    expect(onChange).not.toHaveBeenCalled()
  })
})
