import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from './PinControls'

/**
 * Painel do pino: "Marco: todos veem" e "Ler só de perto" com o número de
 * casas. Os dois só aparecem com um pino selecionado (é propriedade do pino,
 * não preferência do próximo).
 */

describe('PinControls: marco e ler só de perto', () => {
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

  function render(extra: Partial<PinControlsProps>): void {
    const props: PinControlsProps = {
      kind: 'exclamacao',
      onKindChange: () => {},
      description: 'Carta',
      onDescriptionChange: () => {},
      locked: false,
      onLockedChange: () => {},
      marco: false,
      onMarcoChange: () => {},
      lerDePerto: null,
      onLerDePertoChange: () => {},
      image: null,
      onChooseImage: () => {},
      onClearImage: () => {},
      onDelete: () => {},
      ...extra,
    }
    act(() => root.render(<PinControls {...props} />))
  }

  /** O checkbox do interruptor com este rótulo. */
  function interruptor(rotulo: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label.lb-switch')).find((l) => l.querySelector('span')?.textContent === rotulo)
    const input = label?.querySelector('input')
    if (!(input instanceof HTMLInputElement)) throw new Error(`sem interruptor "${rotulo}"`)
    return input
  }

  function campoCasas(): HTMLInputElement | null {
    const input = container.querySelector('#lb-pin-ler-de-perto')
    return input instanceof HTMLInputElement ? input : null
  }

  /** Escreve no campo como o navegador escreve: pelo setter nativo, e o React ouve o `input`. */
  function digitar(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('"Marco: todos veem" liga o marco do pino', () => {
    const onMarcoChange = vi.fn()
    render({ onMarcoChange })
    const marco = interruptor('Marco: todos veem')
    expect(marco.checked).toBe(false)
    act(() => marco.click())
    expect(onMarcoChange).toHaveBeenCalledWith(true)
  })

  it('"Ler só de perto" liga com 1 casa; desligar volta a null', () => {
    const onLerDePertoChange = vi.fn()
    render({ onLerDePertoChange })
    expect(campoCasas()).toBeNull()
    act(() => interruptor('Ler só de perto').click())
    expect(onLerDePertoChange).toHaveBeenLastCalledWith(1)
    render({ onLerDePertoChange, lerDePerto: 2 })
    act(() => interruptor('Ler só de perto').click())
    expect(onLerDePertoChange).toHaveBeenLastCalledWith(null)
  })

  it('ligado, o campo de casas mostra o valor e aceita outro número; fora de 1 a 20 não muda', () => {
    const onLerDePertoChange = vi.fn()
    render({ onLerDePertoChange, lerDePerto: 2 })
    const casas = campoCasas()
    expect(casas?.value).toBe('2')
    if (casas === null) throw new Error('sem campo de casas')
    digitar(casas, '3')
    expect(onLerDePertoChange).toHaveBeenLastCalledWith(3)
    onLerDePertoChange.mockClear()
    digitar(casas, '0')
    digitar(casas, '')
    expect(onLerDePertoChange).not.toHaveBeenCalled()
  })

  it('sem pino selecionado, nenhum dos dois aparece', () => {
    render({ description: null })
    expect(container.textContent).not.toContain('Marco: todos veem')
    expect(container.textContent).not.toContain('Ler só de perto')
  })
})
