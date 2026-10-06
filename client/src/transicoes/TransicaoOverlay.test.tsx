import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TransicaoOverlay } from './TransicaoOverlay'

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

const pular = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Pular')

describe('TransicaoOverlay', () => {
  it('"Pular" fecha a transição; outro nonce toca de novo', () => {
    vi.useFakeTimers()
    act(() => root.render(<TransicaoOverlay nonce={1} escolha={{ id: 'porta' }} />))
    expect(pular()).toBeDefined()
    act(() => pular()?.click())
    act(() => vi.advanceTimersByTime(400))
    expect(pular()).toBeUndefined()
    act(() => root.render(<TransicaoOverlay nonce={2} escolha={{ id: 'porta' }} />))
    expect(pular()).toBeDefined()
  })
})
