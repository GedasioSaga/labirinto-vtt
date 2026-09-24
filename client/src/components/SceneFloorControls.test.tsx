/**
 * MAPA POR ANDARES no mestre: "Andar do prédio" na janela Configurações do
 * mapa. O mestre dá o nome do prédio e o rótulo do andar; grava ao sair do
 * campo, e só forma válida chega à store.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SceneFloorControls } from './SceneFloorControls'

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

function campo(rotulo: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === rotulo)
  const input = label === undefined ? null : document.getElementById(label.htmlFor)
  if (!(input instanceof HTMLInputElement)) throw new Error(`campo ${rotulo} ausente`)
  return input
}

function digitarESair(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
}

describe('SceneFloorControls', () => {
  it('cena comum: campos vazios; prédio e andar preenchidos gravam o andar limpo', () => {
    const onChange = vi.fn()
    act(() => root.render(<SceneFloorControls andar={undefined} onChange={onChange} />))
    expect(campo('Prédio').value).toBe('')
    expect(campo('Andar').value).toBe('')
    digitarESair(campo('Prédio'), 'Mansão Spencer')
    // Só o prédio ainda não é andar: nada grava.
    expect(onChange).not.toHaveBeenCalled()
    digitarESair(campo('Andar'), 'b1')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ predio: 'Mansão Spencer', rotulo: 'B1' })
  })

  it('rótulo que não é de andar avisa e não grava', () => {
    const onChange = vi.fn()
    act(() => root.render(<SceneFloorControls andar={{ predio: 'Mansão', rotulo: '1F' }} onChange={onChange} />))
    expect(campo('Andar').value).toBe('1F')
    digitarESair(campo('Andar'), 'Porão')
    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('1F, 2F, B1')
    expect(campo('Andar').getAttribute('aria-invalid')).toBe('true')
  })

  it('apagar os dois campos tira a cena do prédio', () => {
    const onChange = vi.fn()
    act(() => root.render(<SceneFloorControls andar={{ predio: 'Mansão', rotulo: '1F' }} onChange={onChange} />))
    digitarESair(campo('Prédio'), '')
    expect(onChange).not.toHaveBeenCalled()
    digitarESair(campo('Andar'), '')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
