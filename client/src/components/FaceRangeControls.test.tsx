/**
 * "Rostos só de perto" na janela Configurações do mapa: a caixa liga e desliga
 * a opção da cena; o campo de casas só vale com ela ligada e só manda número
 * inteiro de 1 a 99.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FaceRangeControls } from './FaceRangeControls'

describe('FaceRangeControls', () => {
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

  const render = (faceRangeCells: number | null, onFaceRangeCellsChange = vi.fn()) => {
    act(() => root.render(<FaceRangeControls faceRangeCells={faceRangeCells} onFaceRangeCellsChange={onFaceRangeCellsChange} />))
    return onFaceRangeCellsChange
  }
  const toggle = (): HTMLInputElement => {
    const el = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (el === null) throw new Error('caixa "Rostos só de perto" ausente')
    return el
  }
  const cells = (): HTMLInputElement => {
    const el = container.querySelector<HTMLInputElement>('input[type="number"]')
    if (el === null) throw new Error('campo de casas ausente')
    return el
  }
  const type = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('desligada: a caixa aparece desmarcada, com rótulo, e o campo de casas fica desabilitado', () => {
    render(null)
    expect(toggle().checked).toBe(false)
    expect(toggle().labels?.[0]?.textContent).toContain('Rostos só de perto')
    expect(cells().disabled).toBe(true)
  })

  it('marcar a caixa liga a opção com 3 casas', () => {
    const onChange = render(null)
    act(() => toggle().click())
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('ligada: mostra as casas e desmarcar desliga a opção', () => {
    const onChange = render(5)
    expect(toggle().checked).toBe(true)
    expect(cells().value).toBe('5')
    expect(cells().disabled).toBe(false)
    act(() => toggle().click())
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('digitar um número válido de casas manda o número', () => {
    const onChange = render(3)
    type(cells(), '6')
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('campo vazio, zero, fração ou acima de 99 não mandam nada', () => {
    const onChange = render(3)
    for (const valor of ['', '0', '2.5', '100']) type(cells(), valor)
    expect(onChange).not.toHaveBeenCalled()
  })
})
