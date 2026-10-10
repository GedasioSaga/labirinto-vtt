import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StairControls, type StairTamanhoProps } from './StairControls'
import type { StairShape } from '../types/map'

/**
 * Comprimento, Largura e Curva da escada JÁ colocada, na ficha de hoje
 * (pedido de 10/10/2026): os números em casas, com − e +, e a curva num
 * deslizante (0 = reta). A espiral só tem o diâmetro.
 */

const GRID = 64

function tamanho(extra: Partial<StairTamanhoProps> = {}): StairTamanhoProps {
  return {
    length: 4 * GRID,
    onLengthChange: vi.fn(),
    curve: { degrees: 0, maxDegrees: 180 },
    onCurveChange: vi.fn(),
    ...extra,
  }
}

describe('StairControls: tamanho e curva', () => {
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

  function render(t: StairTamanhoProps, opcoes: { shape?: StairShape; stepWidth?: number; onStepWidthChange?: (w: number) => void } = {}): void {
    act(() =>
      root.render(
        <StairControls
          direction="up"
          onDirectionChange={() => {}}
          shape={opcoes.shape ?? 'straight'}
          onShapeChange={() => {}}
          stepWidth={opcoes.stepWidth ?? GRID}
          onStepWidthChange={opcoes.onStepWidthChange ?? (() => {})}
          grid={GRID}
          travel={null}
          tamanho={t}
        />,
      ),
    )
  }

  const campo = (rotulo: string): HTMLInputElement => {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
    const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null
    if (!(input instanceof HTMLInputElement)) throw new Error(`sem campo ${rotulo}`)
    return input
  }
  const botao = (nome: string): HTMLButtonElement => {
    const achado = container.querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`)
    if (!achado) throw new Error(`sem botão ${nome}`)
    return achado
  }
  const digitar = (input: HTMLInputElement, texto: string) => {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, texto)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
  }

  it('comprimento em casas: − e + andam meia casa, e o número digitado vale no Enter', () => {
    const t = tamanho()
    render(t)
    expect(campo('Comprimento').value).toBe('4')
    act(() => botao('Aumentar o comprimento').click())
    expect(t.onLengthChange).toHaveBeenLastCalledWith(4.5 * GRID)
    act(() => botao('Diminuir o comprimento').click())
    expect(t.onLengthChange).toHaveBeenLastCalledWith(3.5 * GRID)
    digitar(campo('Comprimento'), '6,5')
    expect(t.onLengthChange).toHaveBeenLastCalledWith(6.5 * GRID)
  })

  it('texto que não é número não grava nada e volta ao valor', () => {
    const t = tamanho()
    render(t)
    digitar(campo('Comprimento'), 'abc')
    expect(t.onLengthChange).not.toHaveBeenCalled()
  })

  it('largura em casas, também com − e +', () => {
    const onStepWidthChange = vi.fn()
    render(tamanho(), { onStepWidthChange })
    expect(campo('Largura').value).toBe('1')
    act(() => botao('Aumentar a largura').click())
    expect(onStepWidthChange).toHaveBeenLastCalledWith(1.5 * GRID)
  })

  it('no mínimo, o − não faz nada', () => {
    const t = tamanho({ length: 0.25 * GRID })
    render(t)
    act(() => botao('Diminuir o comprimento').click())
    expect(t.onLengthChange).not.toHaveBeenCalled()
  })

  it('curva: deslizante de −máximo a +máximo, "Reta" no zero', () => {
    const t = tamanho({ curve: { degrees: 0, maxDegrees: 120 } })
    render(t)
    const curva = campo('Curva')
    expect(curva.type).toBe('range')
    expect(curva.min).toBe('-120')
    expect(curva.max).toBe('120')
    expect(container.textContent).toContain('Reta')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(curva, '45')
      curva.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(t.onCurveChange).toHaveBeenLastCalledWith(45)
  })

  it('curvada: mostra os graus e o botão de endireitar', () => {
    const t = tamanho({ curve: { degrees: -60, maxDegrees: 180 } })
    render(t)
    expect(container.textContent).toContain('60°')
    const endireitar = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Endireitar')
    act(() => endireitar?.click())
    expect(t.onCurveChange).toHaveBeenLastCalledWith(0)
  })

  it('espiral: só o diâmetro, sem largura nem curva', () => {
    render(tamanho({ curve: null }), { shape: 'spiral' })
    expect(campo('Diâmetro').value).toBe('4')
    expect(() => campo('Largura')).toThrow()
    expect(() => campo('Curva')).toThrow()
  })
})
