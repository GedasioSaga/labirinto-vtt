import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POINT_MENU_HEIGHT_PX, POINT_MENU_OFFSET_PX, POINT_MENU_WIDTH_PX, PointActionMenu } from './PointActionMenu'

describe('PointActionMenu (toque longo no mapa)', () => {
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

  function render(onChoose = vi.fn(), onClose = vi.fn()) {
    act(() => root.render(<PointActionMenu screenX={200} screenY={150} onChoose={onChoose} onClose={onClose} />))
    return { onChoose, onClose }
  }

  function itens(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  }

  function tecla(key: string) {
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }

  it('abre um menu com Procurar, Escutar, Espiar e Revistar, com o foco no primeiro', () => {
    render()
    const menu = container.querySelector('[role="menu"]')
    expect(menu?.getAttribute('aria-label')).toBe('Ações no ponto')
    expect(itens().map((b) => b.textContent)).toEqual(['Procurar', 'Escutar', 'Espiar', 'Revistar'])
    expect(document.activeElement).toBe(itens()[0])
  })

  it('escolher Procurar devolve a ação', () => {
    const { onChoose } = render()
    act(() => itens()[0]?.click())
    expect(onChoose).toHaveBeenCalledWith('procurar')
    act(() => itens()[3]?.click())
    expect(onChoose).toHaveBeenLastCalledWith('revistar')
  })

  it('setas andam entre os itens (com volta), e Escape fecha', () => {
    const { onClose } = render()
    tecla('ArrowDown')
    expect(document.activeElement).toBe(itens()[1])
    tecla('ArrowUp')
    tecla('ArrowUp')
    expect(document.activeElement).toBe(itens()[3])
    tecla('Home')
    expect(document.activeElement).toBe(itens()[0])
    tecla('End')
    expect(document.activeElement).toBe(itens()[3])
    tecla('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('abre ao lado do ponto, sem cobrir o lugar onde o dedo segurou', () => {
    render()
    const menu = container.querySelector<HTMLElement>('[role="menu"]')
    expect(menu?.style.left).toBe(`${200 + POINT_MENU_OFFSET_PX}px`)
    expect(menu?.style.top).toBe(`${150 + POINT_MENU_OFFSET_PX}px`)
  })

  it('perto da borda direita e de baixo, vira para o outro lado do ponto (ainda sem cobri-lo)', () => {
    const x = window.innerWidth - 20
    const y = window.innerHeight - 20
    act(() => root.render(<PointActionMenu screenX={x} screenY={y} onChoose={vi.fn()} onClose={vi.fn()} />))
    const menu = container.querySelector<HTMLElement>('[role="menu"]')
    // A borda de fora do menu fica antes do ponto: o dedo que segura de novo cai no mapa.
    expect(Number.parseFloat(menu?.style.left ?? '') + POINT_MENU_WIDTH_PX).toBeLessThanOrEqual(x - POINT_MENU_OFFSET_PX)
    expect(Number.parseFloat(menu?.style.top ?? '') + POINT_MENU_HEIGHT_PX).toBeLessThanOrEqual(y - POINT_MENU_OFFSET_PX)
  })
})
