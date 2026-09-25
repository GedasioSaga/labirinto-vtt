import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PisoControls, type PisoControlsProps } from './PisoControls'

/**
 * PISOS NA MESMA CENA no painel do mestre: "Piso" da ficha e da escada, e
 * "Leva ao piso" só na escada (vazio = enfeite).
 */
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

function render(props: PisoControlsProps): void {
  act(() => root.render(<PisoControls {...props} />))
}

/** Digitar como o React enxerga: setter nativo + evento `input`. */
function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function campo(rotulo: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent === rotulo)
  const input = label === undefined ? null : document.getElementById(label.htmlFor)
  if (!(input instanceof HTMLInputElement)) throw new Error(`sem o campo "${rotulo}"`)
  return input
}

describe('PisoControls', () => {
  it('ficha: só o campo Piso, com o valor dela; digitar grava o inteiro', () => {
    const onPisoChange = vi.fn()
    render({ piso: 0, onPisoChange })
    expect(campo('Piso').value).toBe('0')
    expect(container.textContent).not.toContain('Leva ao piso')
    digitar(campo('Piso'), '3')
    expect(onPisoChange).toHaveBeenLastCalledWith(3)
    digitar(campo('Piso'), '-2')
    expect(onPisoChange).toHaveBeenLastCalledWith(-2)
  })

  it('Piso apagado não grava nada (não existe ficha sem piso)', () => {
    const onPisoChange = vi.fn()
    render({ piso: 1, onPisoChange })
    digitar(campo('Piso'), '')
    expect(onPisoChange).not.toHaveBeenCalled()
  })

  it('escada: "Leva ao piso" mostra o número; apagar vira enfeite (null)', () => {
    const onLevaAoPisoChange = vi.fn()
    render({ piso: 0, onPisoChange: vi.fn(), levaAoPiso: 1, onLevaAoPisoChange })
    expect(campo('Leva ao piso').value).toBe('1')
    digitar(campo('Leva ao piso'), '')
    expect(onLevaAoPisoChange).toHaveBeenLastCalledWith(null)
    digitar(campo('Leva ao piso'), '4')
    expect(onLevaAoPisoChange).toHaveBeenLastCalledWith(4)
  })

  it('escada de enfeite: o campo começa vazio', () => {
    render({ piso: 2, onPisoChange: vi.fn(), levaAoPiso: null, onLevaAoPisoChange: vi.fn() })
    expect(campo('Leva ao piso').value).toBe('')
    expect(campo('Piso').value).toBe('2')
  })
})
