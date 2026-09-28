import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ROOM_LABEL_DEFAULT_COLOR, type RoomLabelStyle } from '../lib/roomLabelStyle'
import { RoomLabelStyleControls } from './RoomLabelStyleControls'

/**
 * ESTILO DO TÍTULO, lado do PAINEL: fundo, tamanho, cor e orientação logo
 * abaixo do Nome. Cada controle manda só o eixo que mexeu.
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

const PADRAO: RoomLabelStyle = { plate: true, scale: 1, color: ROOM_LABEL_DEFAULT_COLOR, vertical: false }

function render(style: Partial<RoomLabelStyle> = {}): ReturnType<typeof vi.fn> {
  const onChange = vi.fn()
  act(() => root.render(<RoomLabelStyleControls style={{ ...PADRAO, ...style }} onChange={onChange} />))
  return onChange
}

function interruptorDoFundo(): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Fundo do título')
  return label?.querySelector('input') ?? null
}

function campo(rotulo: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  const input = document.getElementById(label?.htmlFor ?? '')
  if (!(input instanceof HTMLInputElement)) throw new Error(`sem campo ${rotulo}`)
  return input
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function opcao(rotulo: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === rotulo)
}

function botaoPadrao(): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Padrão')
}

describe('RoomLabelStyleControls', () => {
  it('fundo: aparece ligado e desligar manda { plate: false }', () => {
    const onChange = render()
    expect(interruptorDoFundo()?.checked).toBe(true)
    act(() => interruptorDoFundo()?.click())
    expect(onChange).toHaveBeenCalledWith({ plate: false })
  })

  it('tamanho: mostra a porcentagem e o slider manda a escala', () => {
    const onChange = render({ scale: 0.75 })
    const slider = campo('Tamanho do título')
    expect(slider.value).toBe('75')
    expect(container.textContent).toContain('75%')
    digitar(slider, '50')
    expect(onChange).toHaveBeenCalledWith({ scale: 0.5 })
  })

  it('cor: o seletor manda a cor; "Padrão" só aparece fora do padrão e devolve a cor de sempre', () => {
    const onChange = render()
    expect(botaoPadrao()).toBeUndefined()
    digitar(campo('Cor do título'), '#ffcc00')
    expect(onChange).toHaveBeenCalledWith({ color: '#ffcc00' })

    const onChange2 = render({ color: '#ffcc00' })
    act(() => botaoPadrao()?.click())
    expect(onChange2).toHaveBeenCalledWith({ color: ROOM_LABEL_DEFAULT_COLOR })
  })

  it('orientação: marca a atual e o outro lado manda { vertical }', () => {
    const onChange = render()
    expect(opcao('Horizontal')?.getAttribute('aria-checked')).toBe('true')
    expect(opcao('Vertical')?.getAttribute('aria-checked')).toBe('false')
    act(() => opcao('Vertical')?.click())
    expect(onChange).toHaveBeenCalledWith({ vertical: true })

    render({ vertical: true })
    expect(opcao('Vertical')?.getAttribute('aria-checked')).toBe('true')
  })
})
