import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * CÔMODO LEMBRADO, lado do PAINEL: o interruptor que liga o modo na Sala, com
 * o texto que diz ao mestre o que o jogador vai perceber.
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

function render(overrides: Partial<RoomControlsProps> = {}): RoomControlsProps {
  const props: RoomControlsProps = {
    name: 'Quarto',
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
  return props
}

function interruptor(rotulo: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  return label?.querySelector('input') ?? null
}

const ROTULO = 'Cômodo: aparece só depois de visto'

describe('RoomControls — Cômodo lembrado', () => {
  it('mostra o interruptor desligado, com a explicação ligada a ele', () => {
    render({ comodo: false, onComodoChange: vi.fn() })
    const input = interruptor(ROTULO)
    expect(input).not.toBeNull()
    expect(input?.checked).toBe(false)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('lembrado')
  })

  it('ligar chama onComodoChange(true); ligado aparece marcado', () => {
    const onComodoChange = vi.fn()
    render({ comodo: false, onComodoChange })
    act(() => interruptor(ROTULO)?.click())
    expect(onComodoChange).toHaveBeenCalledWith(true)

    render({ comodo: true, onComodoChange })
    expect(interruptor(ROTULO)?.checked).toBe(true)
  })

  it('sem o callback o interruptor não aparece', () => {
    render()
    expect(interruptor(ROTULO)).toBeNull()
  })
})
