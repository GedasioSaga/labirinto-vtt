import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconnectingOverlay } from './ReconnectingOverlay'

describe('ReconnectingOverlay (mapa esmaecido enquanto a conexão volta)', () => {
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
  })

  it('diz "Reconectando…" num status que o leitor de tela anuncia, e ainda sem botão', () => {
    act(() => root.render(<ReconnectingOverlay info={{ since: 0, attempt: 1, manual: false }} onRetry={vi.fn()} />))
    const status = container.querySelector('[role="status"]')
    expect(status?.textContent).toContain('Reconectando…')
    expect(container.querySelector('button')).toBeNull()
  })

  it('depois de 30 s fora aparece "Reconectar", que tenta na hora', () => {
    const onRetry = vi.fn()
    act(() => root.render(<ReconnectingOverlay info={{ since: 0, attempt: 4, manual: true }} onRetry={onRetry} />))
    const button = container.querySelector('button')
    expect(button?.textContent).toBe('Reconectar')
    act(() => button?.click())
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
