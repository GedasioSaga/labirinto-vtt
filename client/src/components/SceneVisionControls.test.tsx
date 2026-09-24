/**
 * "Visão nesta cena", na janela Configurações do mapa: quantos quadrados se
 * enxerga nesta cena. Vazio = sem valor (o raio de cada jogador, como antes).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SceneVisionControls } from './SceneVisionControls'

describe('SceneVisionControls', () => {
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

  const input = () => {
    const found = container.querySelector<HTMLInputElement>('#lb-scene-vision')
    if (found === null) throw new Error('campo "Visão nesta cena" ausente')
    return found
  }

  const typeValue = (value: string) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setValue?.call(input(), value)
      input().dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('campo rotulado, em quadrados, vazio quando a cena não tem valor', () => {
    act(() => root.render(<SceneVisionControls visionCells={undefined} onVisionCellsChange={vi.fn()} />))
    const label = container.querySelector('label[for="lb-scene-vision"]')
    expect(label?.textContent).toBe('Visão nesta cena (quadrados)')
    expect(input().value).toBe('')
    expect(input().type).toBe('number')
  })

  it('digitar 6 grava 6; apagar volta a "sem valor"; 0 não grava', () => {
    const onVisionCellsChange = vi.fn()
    act(() => root.render(<SceneVisionControls visionCells={undefined} onVisionCellsChange={onVisionCellsChange} />))
    typeValue('6')
    expect(onVisionCellsChange).toHaveBeenLastCalledWith(6)

    act(() => root.render(<SceneVisionControls visionCells={6} onVisionCellsChange={onVisionCellsChange} />))
    expect(input().value).toBe('6')
    typeValue('')
    expect(onVisionCellsChange).toHaveBeenLastCalledWith(undefined)

    onVisionCellsChange.mockClear()
    typeValue('0')
    expect(onVisionCellsChange).not.toHaveBeenCalled()
  })
})
