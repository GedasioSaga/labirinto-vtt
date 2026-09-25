import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WallGestureMenu } from './WallGestureMenu'

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

function abrir() {
  const handlers = { onAbrirVao: vi.fn(), onDesabar: vi.fn(), onClose: vi.fn() }
  act(() => root.render(<WallGestureMenu x={120} y={80} limite={{ width: 1200, height: 800 }} {...handlers} />))
  return handlers
}

function itens(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
}

function nomeAcessivel(item: HTMLElement): string {
  const id = item.getAttribute('aria-labelledby')
  return id === null ? '' : (document.getElementById(id)?.textContent ?? '')
}

function tecla(key: string) {
  const alvo = document.activeElement ?? container
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

describe('WallGestureMenu: o menu do clique direito na parede', () => {
  it('é um menu com "Abrir vão aqui" e "Desabar parede", e o foco entra no primeiro', () => {
    abrir()
    expect(container.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Parede')
    expect(itens().map(nomeAcessivel)).toEqual(['Abrir vão aqui', 'Desabar parede'])
    expect(document.activeElement).toBe(itens()[0])
  })

  it('"Abrir vão aqui" num clique: abre o vão e fecha o menu', () => {
    const h = abrir()
    act(() => itens()[0].click())
    expect(h.onAbrirVao).toHaveBeenCalledTimes(1)
    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(h.onDesabar).not.toHaveBeenCalled()
  })

  it('"Desabar parede" num clique: desaba e fecha o menu', () => {
    const h = abrir()
    act(() => itens()[1].click())
    expect(h.onDesabar).toHaveBeenCalledTimes(1)
    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(h.onAbrirVao).not.toHaveBeenCalled()
  })

  it('setas andam entre os itens e Esc fecha sem fazer nada', () => {
    const h = abrir()
    tecla('ArrowDown')
    expect(document.activeElement).toBe(itens()[1])
    tecla('ArrowDown')
    expect(document.activeElement).toBe(itens()[0])
    tecla('End')
    expect(document.activeElement).toBe(itens()[1])
    tecla('Escape')
    expect(h.onClose).toHaveBeenCalledTimes(1)
    expect(h.onAbrirVao).not.toHaveBeenCalled()
    expect(h.onDesabar).not.toHaveBeenCalled()
  })

  it('a tecla do menu não vaza para os atalhos do editor', () => {
    abrir()
    const atalhoGlobal = vi.fn()
    window.addEventListener('keydown', atalhoGlobal)
    tecla('Escape')
    window.removeEventListener('keydown', atalhoGlobal)
    expect(atalhoGlobal).not.toHaveBeenCalled()
  })

  it('clique fora fecha; clique dentro não', () => {
    const h = abrir()
    act(() => {
      itens()[0].dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(h.onClose).not.toHaveBeenCalled()
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(h.onClose).toHaveBeenCalledTimes(1)
  })
})
