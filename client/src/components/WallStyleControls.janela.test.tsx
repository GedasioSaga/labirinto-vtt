import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WallStyleControls } from './WallStyleControls'

/** "Janela" no painel da parede: um interruptor com rótulo visível, ligado à parede selecionada. */
describe('WallStyleControls — Janela', () => {
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

  function janelaCheckbox(): HTMLInputElement {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Janela'))
    const input = label?.querySelector('input')
    if (!(input instanceof HTMLInputElement)) throw new Error('interruptor Janela ausente')
    return input
  }

  it('ligar o interruptor pede janela na parede', () => {
    const onJanelaChange = vi.fn()
    act(() => root.render(<WallStyleControls wallKind={undefined} onWallKindChange={vi.fn()} janela={false} onJanelaChange={onJanelaChange} />))
    const input = janelaCheckbox()
    expect(input.checked).toBe(false)
    act(() => input.click())
    expect(onJanelaChange).toHaveBeenCalledWith(true)
  })

  it('parede já janela aparece ligada e desligar volta a parede comum', () => {
    const onJanelaChange = vi.fn()
    act(() => root.render(<WallStyleControls wallKind={undefined} onWallKindChange={vi.fn()} janela onJanelaChange={onJanelaChange} />))
    const input = janelaCheckbox()
    expect(input.checked).toBe(true)
    act(() => input.click())
    expect(onJanelaChange).toHaveBeenCalledWith(false)
  })

  it('sem parede selecionada (sem onJanelaChange) o interruptor nem aparece', () => {
    act(() => root.render(<WallStyleControls wallKind={undefined} onWallKindChange={vi.fn()} />))
    const labels = [...container.querySelectorAll('label')].map((l) => l.textContent ?? '')
    expect(labels.some((t) => t.includes('Janela'))).toBe(false)
    expect(labels.some((t) => t.includes('Parede interna'))).toBe(true)
  })
})
