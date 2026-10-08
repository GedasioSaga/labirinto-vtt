import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * VER ATRAVÉS DAS PAREDES, lado do PAINEL: os dois interruptores da Sala, com
 * a explicação de cada um, e o "De fora, vê aqui dentro" apagado com o motivo
 * enquanto o teto fechado estiver ligado — o teto vence.
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

function render(overrides: Partial<RoomControlsProps> = {}): void {
  const props: RoomControlsProps = {
    name: 'Vitrine',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 128,
    height: 128,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    ...overrides,
  }
  act(() => root.render(<RoomControls {...props} />))
}

function interruptor(rotulo: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  return label?.querySelector('input') ?? null
}

function dicaDe(input: HTMLInputElement | null): string {
  return document.getElementById(input?.getAttribute('aria-describedby') ?? '')?.textContent ?? ''
}

const DENTRO = 'De dentro, vê lá fora'
const FORA = 'De fora, vê aqui dentro'

describe('RoomControls — ver através das paredes', () => {
  it('mostra os dois interruptores desligados, cada um com a explicação ligada a ele', () => {
    render({ dentroVeFora: false, onDentroVeForaChange: vi.fn(), foraVeDentro: false, onForaVeDentroChange: vi.fn() })
    const dentro = interruptor(DENTRO)
    const fora = interruptor(FORA)
    expect(dentro?.checked).toBe(false)
    expect(fora?.checked).toBe(false)
    expect(fora?.disabled).toBe(false)
    expect(dicaDe(dentro)).toContain('barrando o passo')
    expect(dicaDe(fora)).toContain('interior')
  })

  it('ligar cada um chama o callback dele com true; ligado aparece marcado', () => {
    const onDentroVeForaChange = vi.fn()
    const onForaVeDentroChange = vi.fn()
    render({ dentroVeFora: false, onDentroVeForaChange, foraVeDentro: false, onForaVeDentroChange })
    act(() => interruptor(DENTRO)?.click())
    act(() => interruptor(FORA)?.click())
    expect(onDentroVeForaChange).toHaveBeenCalledWith(true)
    expect(onForaVeDentroChange).toHaveBeenCalledWith(true)

    render({ dentroVeFora: true, onDentroVeForaChange, foraVeDentro: true, onForaVeDentroChange })
    expect(interruptor(DENTRO)?.checked).toBe(true)
    expect(interruptor(FORA)?.checked).toBe(true)
  })

  it('com o teto fechado, "De fora" fica apagado, com o motivo, e não responde; "De dentro" segue valendo', () => {
    const onForaVeDentroChange = vi.fn()
    const onDentroVeForaChange = vi.fn()
    render({ roof: true, onRoofChange: vi.fn(), dentroVeFora: false, onDentroVeForaChange, foraVeDentro: false, onForaVeDentroChange })
    const fora = interruptor(FORA)
    expect(fora?.disabled).toBe(true)
    expect(dicaDe(fora)).toContain('O teto fechado esconde o interior de quem está fora')
    act(() => fora?.click())
    expect(onForaVeDentroChange).not.toHaveBeenCalled()
    expect(interruptor(DENTRO)?.disabled).toBe(false)
  })

  it('sem os callbacks os interruptores não aparecem', () => {
    render()
    expect(interruptor(DENTRO)).toBeNull()
    expect(interruptor(FORA)).toBeNull()
  })
})
