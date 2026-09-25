// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VISION_RADIUS_MAX, VISION_RADIUS_MIN } from '../net/hostSession'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * "Raio de visão aqui", lado do PAINEL: o mestre dá à Sala um raio próprio
 * (mirante enxerga longe, caracol enxerga pouco). Vazio = vale o raio do
 * jogador. Como a Rotação, o número só é gravado no Enter ou ao sair do campo:
 * digitar "700" não pode passar por 7 e virar 50 no caminho.
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

function render(overrides: Partial<RoomControlsProps> = {}) {
  const props: RoomControlsProps = {
    name: 'Mirante',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 128,
    height: 384,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
  return props
}

function campoRaio(): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Raio de visão aqui')
  const input = label ? document.getElementById(label.htmlFor) : null
  return input instanceof HTMLInputElement ? input : null
}

function campo(): HTMLInputElement {
  const input = campoRaio()
  if (input === null) throw new Error('o painel da sala não tem o campo "Raio de visão aqui"')
  return input
}

function digitar(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(input: HTMLInputElement, key: string) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('RoomControls — Raio de visão aqui', () => {
  it('sem quem grave, o campo não aparece', () => {
    render()
    expect(campoRaio()).toBe(null)
  })

  it('mostra o raio da sala; sem raio, fica vazio dizendo que vale o do jogador', () => {
    render({ raioDeVisao: 1500, onRaioDeVisaoChange: vi.fn() })
    expect(campo().value).toBe('1500')
    render({ raioDeVisao: null, onRaioDeVisaoChange: vi.fn() })
    expect(campo().value).toBe('')
    expect(campo().placeholder).toBe('o do jogador')
  })

  it('digitar não grava; Enter grava UMA vez, dentro dos limites do raio', () => {
    const props = render({ raioDeVisao: null, onRaioDeVisaoChange: vi.fn() })
    digitar(campo(), '7')
    digitar(campo(), '70')
    digitar(campo(), '700')
    expect(props.onRaioDeVisaoChange).not.toHaveBeenCalled()
    tecla(campo(), 'Enter')
    expect(props.onRaioDeVisaoChange).toHaveBeenCalledTimes(1)
    expect(props.onRaioDeVisaoChange).toHaveBeenCalledWith(700)
    digitar(campo(), '5')
    tecla(campo(), 'Enter')
    expect(props.onRaioDeVisaoChange).toHaveBeenLastCalledWith(VISION_RADIUS_MIN)
    digitar(campo(), '999999')
    tecla(campo(), 'Enter')
    expect(props.onRaioDeVisaoChange).toHaveBeenLastCalledWith(VISION_RADIUS_MAX)
  })

  it('apagar o número e confirmar devolve a sala ao raio do jogador', () => {
    const props = render({ raioDeVisao: 1500, onRaioDeVisaoChange: vi.fn() })
    digitar(campo(), '')
    tecla(campo(), 'Enter')
    expect(props.onRaioDeVisaoChange).toHaveBeenCalledWith(null)
  })

  it('sair do campo confirma; Esc desiste do que foi digitado', () => {
    const props = render({ raioDeVisao: 300, onRaioDeVisaoChange: vi.fn() })
    digitar(campo(), '900')
    tecla(campo(), 'Escape')
    expect(campo().value).toBe('300')
    expect(props.onRaioDeVisaoChange).not.toHaveBeenCalled()
    digitar(campo(), '1200')
    act(() => campo().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(props.onRaioDeVisaoChange).toHaveBeenCalledWith(1200)
  })
})
