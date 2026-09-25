import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinChooser } from './PlayerPinChooser'

/**
 * "Aqui há 2 coisas": a folha que o toque abre quando há mais de um pino sob
 * o dedo. Uma linha por pino (a cabeça e as primeiras palavras), na ordem que
 * o toque mandou; tocar numa linha abre aquele cartão. Fecha como o cartão do
 * pino: Escape, "Fechar" ou tocar fora.
 */

const RELOGIO: Pin = { id: 'relogio', x: 300, y: 300, kind: 'exclamacao', description: 'Relógio de volta, luneta e espelho de sinal. Está impecável demais.', image: null }
const BAU: Pin = { id: 'bau', x: 300, y: 300, kind: 'interrogacao', icon: 'bau', description: '', image: null }

describe('PlayerPinChooser', () => {
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
    act(() => root.render(<PlayerPinChooser pins={[RELOGIO, BAU]} stairs={[]} onChoose={onChoose} onClose={onClose} />))
    return { onChoose, onClose }
  }

  function linhas(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('.pp-pinchooser__option'))
  }

  it('diz quantas coisas há e mostra uma linha por pino, na ordem do toque', () => {
    render()
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-label')).toBe('Aqui há 2 coisas')
    expect(container.textContent).toContain('Aqui há 2 coisas')
    const textos = linhas().map((b) => b.textContent ?? '')
    expect(textos).toHaveLength(2)
    expect(textos[0]).toContain('Relógio de volta')
    expect(textos[1]).toContain('Baú')
  })

  it('o foco começa na primeira linha', () => {
    render()
    expect(document.activeElement).toBe(linhas()[0])
  })

  it('tocar numa linha escolhe aquele pino', () => {
    const { onChoose } = render()
    act(() => linhas()[1].click())
    expect(onChoose).toHaveBeenCalledWith('bau')
    expect(onChoose).toHaveBeenCalledTimes(1)
  })

  it('setas andam entre as linhas, dando a volta', () => {
    render()
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(document.activeElement).toBe(linhas()[1])
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(document.activeElement).toBe(linhas()[0])
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    })
    expect(document.activeElement).toBe(linhas()[1])
  })

  it('Escape fecha sem escolher', () => {
    const { onChoose, onClose } = render()
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('tocar fora fecha; tocar dentro não', () => {
    const { onClose } = render()
    act(() => {
      linhas()[0].dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
