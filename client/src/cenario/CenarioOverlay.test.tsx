import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CenarioOverlay } from './CenarioOverlay'
import { CENARIO_PADRAO } from './catalogo'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('CenarioOverlay', () => {
  it('"Pular" encerra a animação e devolve a vez ao cartão', () => {
    vi.useFakeTimers()
    const onFim = vi.fn()
    act(() => root.render(<CenarioOverlay imagem="data:image/png;base64,AAAA" cenario={{ ...CENARIO_PADRAO, som: false }} onFim={onFim} />))
    const pular = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Pular')
    expect(pular).toBeDefined()
    act(() => pular?.click())
    act(() => vi.advanceTimersByTime(400))
    expect(onFim).toHaveBeenCalledTimes(1)
  })
})
