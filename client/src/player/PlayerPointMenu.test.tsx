import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerPointMenu, WalkHereItem } from './PlayerPointMenu'

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

describe('WalkHereItem (o item sozinho, para o menu das ações no ponto)', () => {
  it('mora em outro menu do toque longo: com caminho anda; sem caminho diz o motivo e não anda', () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onWalk = vi.fn()
    const menu = (canWalk: boolean) => (
      <div role="menu" aria-label="Ações no ponto">
        <button type="button" role="menuitem">
          Sinalizar
        </button>
        <WalkHereItem canWalk={canWalk} onWalk={onWalk} />
      </div>
    )
    act(() => root.render(menu(true)))
    const itens = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menu"] > [role="menuitem"]'))
    expect(itens().map((b) => b.textContent)).toEqual(['Sinalizar', 'Andar até aqui'])
    act(() => itens()[1]?.click())
    expect(onWalk).toHaveBeenCalledTimes(1)

    act(() => root.render(menu(false)))
    expect(itens()[1]?.getAttribute('aria-disabled')).toBe('true')
    expect(itens()[1]?.textContent).toBe('Andar até aquiVocê não conhece o caminho')
    act(() => itens()[1]?.click())
    expect(onWalk).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    container.remove()
  })
})
