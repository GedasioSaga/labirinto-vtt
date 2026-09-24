import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MovementRules } from '../types/map'
import { MovementControls } from './MovementControls'

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

function render(movement: MovementRules | undefined) {
  const onMovementChange = vi.fn()
  act(() => root.render(<MovementControls movement={movement} onMovementChange={onMovementChange} />))
  return onMovementChange
}

function campoPasso(): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Passo máximo'))
  const id = label?.htmlFor
  const input = id ? document.getElementById(id) : null
  if (!(input instanceof HTMLInputElement)) throw new Error('campo "Passo máximo" sem rótulo associado')
  return input
}

function interruptorOcupa(): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Fichas ocupam espaço'))
  const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (!input) throw new Error('interruptor "Fichas ocupam espaço" ausente')
  return input
}

function digitar(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('MovementControls', () => {
  it('cena sem regra: passo vazio (livre) e ocupação desligada', () => {
    render(undefined)
    expect(campoPasso().value).toBe('')
    expect(interruptorOcupa().checked).toBe(false)
  })

  it('digitar 6 grava passo máximo 6 e mantém a ocupação', () => {
    const onChange = render({ tokensOccupy: true })
    digitar(campoPasso(), '6')
    expect(onChange).toHaveBeenLastCalledWith({ maxStepCells: 6, tokensOccupy: true })
  })

  it('apagar o passo volta a livre; sem nenhuma regra, o campo some do mapa', () => {
    const onChange = render({ maxStepCells: 6 })
    expect(campoPasso().value).toBe('6')
    digitar(campoPasso(), '')
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('zero ou negativo é livre, não passo zero', () => {
    const onChange = render({ maxStepCells: 6, tokensOccupy: true })
    digitar(campoPasso(), '0')
    expect(onChange).toHaveBeenLastCalledWith({ tokensOccupy: true })
  })

  it('ligar "Fichas ocupam espaço" grava a regra', () => {
    const onChange = render({ maxStepCells: 6 })
    act(() => interruptorOcupa().click())
    expect(onChange).toHaveBeenLastCalledWith({ maxStepCells: 6, tokensOccupy: true })
  })
})
