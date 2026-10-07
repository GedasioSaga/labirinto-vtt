import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WallStyleControls } from './WallStyleControls'

/** "Deixa passar", "Deixa ver" e "Cor da parede" no painel da parede selecionada. */
describe('WallStyleControls — passagem e cor', () => {
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

  function interruptor(texto: string): HTMLInputElement {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(texto))
    const input = label?.querySelector('input')
    if (!(input instanceof HTMLInputElement)) throw new Error(`interruptor ${texto} ausente`)
    return input
  }

  function botao(texto: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  }

  it('os dois interruptores pedem a mudança certa', () => {
    const onDeixaPassarChange = vi.fn()
    const onDeixaVerChange = vi.fn()
    act(() =>
      root.render(
        <WallStyleControls
          wallKind={undefined}
          onWallKindChange={vi.fn()}
          passagem={{ deixaPassar: false, onDeixaPassarChange, deixaVer: true, onDeixaVerChange }}
        />,
      ),
    )
    expect(interruptor('Deixa passar').checked).toBe(false)
    expect(interruptor('Deixa ver').checked).toBe(true)
    act(() => interruptor('Deixa passar').click())
    expect(onDeixaPassarChange).toHaveBeenCalledWith(true)
    act(() => interruptor('Deixa ver').click())
    expect(onDeixaVerChange).toHaveBeenCalledWith(false)
  })

  it('Cor da parede: Padrão só aparece com cor escolhida e devolve null', () => {
    const onColorChange = vi.fn()
    act(() => root.render(<WallStyleControls wallKind={undefined} onWallKindChange={vi.fn()} cor={{ color: null, onColorChange }} />))
    expect(container.querySelector<HTMLInputElement>('#lb-wall-color')?.value).toBe('#d8d2c4')
    expect(botao('Padrão')).toBeUndefined()
    act(() => root.render(<WallStyleControls wallKind={undefined} onWallKindChange={vi.fn()} cor={{ color: '#ff0000', onColorChange }} />))
    act(() => botao('Padrão')?.click())
    expect(onColorChange).toHaveBeenCalledWith(null)
  })

  it('sem parede selecionada nada disso aparece', () => {
    act(() => root.render(<WallStyleControls wallKind={undefined} onWallKindChange={vi.fn()} />))
    const labels = [...container.querySelectorAll('label')].map((l) => l.textContent ?? '')
    expect(labels.some((t) => t.includes('Deixa passar') || t.includes('Cor da parede'))).toBe(false)
  })
})
