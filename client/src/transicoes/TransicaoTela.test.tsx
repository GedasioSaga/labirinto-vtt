import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TransicaoTela } from './TransicaoTela'

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

describe('TransicaoTela', () => {
  it('sem WebGL termina na hora: o jogo nunca fica preso atrás da animação', async () => {
    const onFim = vi.fn()
    act(() => root.render(<TransicaoTela escolha={{ id: 'porta' }} volume={0} onFim={onFim} />))
    await vi.waitFor(() => expect(onFim).toHaveBeenCalledTimes(1), { timeout: 5000 })
  })
})
