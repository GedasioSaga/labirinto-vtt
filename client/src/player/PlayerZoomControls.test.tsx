import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerZoomControls } from './PlayerZoomControls'

describe('PlayerZoomControls (botões + e − do mapa)', () => {
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

  function render(canZoomIn: boolean, canZoomOut: boolean, onZoom: (direction: 1 | -1, animate: boolean) => void): void {
    act(() => root.render(<PlayerZoomControls canZoomIn={canZoomIn} canZoomOut={canZoomOut} onZoom={onZoom} />))
  }

  function button(name: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === name)
    if (!found) throw new Error(`sem botão "${name}"`)
    return found
  }

  /** Clique de dedo ou mouse: `detail` conta os cliques (1). Enter e Espaço sintetizam clique com `detail` 0. */
  function press(target: HTMLButtonElement, detail: number): void {
    act(() => {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
    })
  }

  it('um grupo "Zoom do mapa" com dois botões de verdade: "Aproximar" e "Afastar"', () => {
    render(true, true, () => {})
    const group = container.querySelector('[role="group"]')
    expect(group?.getAttribute('aria-label')).toBe('Zoom do mapa')
    const names = Array.from(group?.querySelectorAll('button') ?? []).map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Aproximar', 'Afastar'])
    for (const name of names) {
      const b = button(name ?? '')
      expect(b.type).toBe('button')
      // O desenho do + e do − é enfeite: quem dá o nome é o aria-label.
      expect(b.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('toque ou clique pede um degrau animado; Enter/Espaço pede o degrau sem animação', () => {
    const onZoom = vi.fn()
    render(true, true, onZoom)
    press(button('Aproximar'), 1)
    expect(onZoom).toHaveBeenLastCalledWith(1, true)
    press(button('Afastar'), 1)
    expect(onZoom).toHaveBeenLastCalledWith(-1, true)
    press(button('Aproximar'), 0)
    expect(onZoom).toHaveBeenLastCalledWith(1, false)
    expect(onZoom).toHaveBeenCalledTimes(3)
  })

  it('no zoom máximo o + fica indisponível, diz o motivo e não pede nada; o − continua valendo', () => {
    const onZoom = vi.fn()
    render(false, true, onZoom)
    const mais = button('Aproximar')
    expect(mais.getAttribute('aria-disabled')).toBe('true')
    expect(mais.title).toBe('Zoom máximo')
    press(mais, 1)
    expect(onZoom).not.toHaveBeenCalled()
    expect(button('Afastar').getAttribute('aria-disabled')).not.toBe('true')
    press(button('Afastar'), 1)
    expect(onZoom).toHaveBeenCalledWith(-1, true)
  })

  it('no zoom mínimo o − fica indisponível com o motivo', () => {
    const onZoom = vi.fn()
    render(true, false, onZoom)
    const menos = button('Afastar')
    expect(menos.getAttribute('aria-disabled')).toBe('true')
    expect(menos.title).toBe('Zoom mínimo')
    press(menos, 1)
    expect(onZoom).not.toHaveBeenCalled()
  })

  it('indisponível continua focável: quem chega ao limite pelo teclado não perde o foco', () => {
    render(true, true, () => {})
    const mais = button('Aproximar')
    mais.focus()
    expect(document.activeElement).toBe(mais)
    render(false, true, () => {})
    expect(mais.disabled).toBe(false)
    expect(document.activeElement).toBe(mais)
  })
})
