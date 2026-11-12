import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StairControls, type StairGiroProps } from './StairControls'

/**
 * Rotação da escada JÁ colocada (pedido de 12/11/2026: "uma vez que eu coloco
 * a escada não da para colocar trocar para vertical e horizontal faz a opção
 * de colocar a rotação"): o ângulo do lance em graus e o "Girar 90°".
 */

const GRID = 64

describe('StairControls: rotação', () => {
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

  it('mostra o ângulo; "Girar 90°" pede um quarto de volta, e o número digitado gira o que falta até ele', () => {
    const giro: StairGiroProps = { degrees: 30, onRotate: vi.fn() }
    act(() =>
      root.render(
        <StairControls
          direction="up"
          onDirectionChange={() => {}}
          shape="straight"
          onShapeChange={() => {}}
          stepWidth={GRID}
          onStepWidthChange={() => {}}
          grid={GRID}
          travel={null}
          giro={giro}
        />,
      ),
    )
    const campo = document.getElementById('lb-stair-rotation')
    if (!(campo instanceof HTMLInputElement)) throw new Error('sem o campo Rotação')
    expect(campo.value).toBe('30')

    const girar = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Girar 90°')
    act(() => girar?.click())
    expect(giro.onRotate).toHaveBeenLastCalledWith(90)

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, '-45')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(giro.onRotate).toHaveBeenLastCalledWith(-75)
  })
})
