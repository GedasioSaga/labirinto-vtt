import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerPointMenu } from './PlayerPointMenu'

describe('PlayerPointMenu (menu do toque longo)', () => {
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

  function render(canWalk: boolean, onWalk: () => void, onClose: () => void): void {
    act(() => root.render(<PlayerPointMenu at={{ x: 200, y: 400 }} canWalk={canWalk} onWalk={onWalk} onClose={onClose} />))
  }

  function item(): HTMLButtonElement {
    const achado = container.querySelector<HTMLButtonElement>('[role="menuitem"]')
    if (!achado) throw new Error('sem item no menu')
    return achado
  }

  it('com caminho: "Andar até aqui" anda e fecha o menu', () => {
    const onWalk = vi.fn()
    const onClose = vi.fn()
    render(true, onWalk, onClose)
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    expect(item().textContent).toBe('Andar até aqui')
    expect(item().getAttribute('aria-disabled')).toBeNull()
    expect(document.activeElement).toBe(item())
    act(() => item().click())
    expect(onWalk).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('área preta: item esmaecido no mesmo lugar, diz "Você não conhece o caminho" e não anda', () => {
    const onWalk = vi.fn()
    const onClose = vi.fn()
    render(false, onWalk, onClose)
    expect(item().textContent).toContain('Andar até aqui')
    expect(item().textContent).toContain('Você não conhece o caminho')
    expect(item().getAttribute('aria-disabled')).toBe('true')
    act(() => item().click())
    expect(onWalk).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Escape fecha; tocar fora fecha; tocar dentro não fecha', () => {
    const onClose = vi.fn()
    render(true, () => {}, onClose)
    act(() => {
      item().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => {
      item().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
