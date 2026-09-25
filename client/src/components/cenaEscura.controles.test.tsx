/**
 * CENA ESCURA e SALA ESCURA, lado do PAINEL: o mestre liga "Cena escura" na
 * janela Configurações do mapa e "Sala escura" no painel da Sala. Os dois são
 * interruptores nativos (checkbox), achados pelo rótulo que o mestre lê.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'
import { SceneVisionControls } from './SceneVisionControls'

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

/** O checkbox dentro do rótulo com este texto; `null` se o painel não o tem. */
function interruptor(texto: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.querySelector('span')?.textContent === texto)
  return label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
}

function roomProps(overrides: Partial<RoomControlsProps> = {}): RoomControlsProps {
  return {
    name: 'Quarto',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 120,
    height: 120,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    ...overrides,
  }
}

describe('"Sala escura" no painel da Sala', () => {
  it('desligado por padrão; clicar liga, e o texto explica o que o jogador vê', () => {
    const onDarkChange = vi.fn()
    act(() => root.render(<RoomControls {...roomProps({ dark: false, onDarkChange })} />))
    const toggle = interruptor('Sala escura')
    expect(toggle?.checked).toBe(false)
    const hint = toggle?.getAttribute('aria-describedby')
    expect(hint ? document.getElementById(hint)?.textContent : null).toContain('o que uma Luz ilumina')
    act(() => toggle?.click())
    expect(onDarkChange).toHaveBeenCalledWith(true)
  })

  it('ligada, desligar devolve false', () => {
    const onDarkChange = vi.fn()
    act(() => root.render(<RoomControls {...roomProps({ dark: true, onDarkChange })} />))
    const toggle = interruptor('Sala escura')
    expect(toggle?.checked).toBe(true)
    act(() => toggle?.click())
    expect(onDarkChange).toHaveBeenCalledWith(false)
  })

  it('sem o valor, o interruptor não aparece', () => {
    act(() => root.render(<RoomControls {...roomProps()} />))
    expect(interruptor('Sala escura')).toBeNull()
  })
})

describe('"Cena escura" na janela Configurações do mapa', () => {
  it('desligado por padrão; clicar liga, clicar de novo desliga', () => {
    const onDarkChange = vi.fn()
    act(() => root.render(<SceneVisionControls visionCells={undefined} onVisionCellsChange={vi.fn()} dark={false} onDarkChange={onDarkChange} />))
    const toggle = interruptor('Cena escura')
    expect(toggle?.checked).toBe(false)
    act(() => toggle?.click())
    expect(onDarkChange).toHaveBeenLastCalledWith(true)

    act(() => root.render(<SceneVisionControls visionCells={undefined} onVisionCellsChange={vi.fn()} dark={true} onDarkChange={onDarkChange} />))
    expect(interruptor('Cena escura')?.checked).toBe(true)
    act(() => interruptor('Cena escura')?.click())
    expect(onDarkChange).toHaveBeenLastCalledWith(false)
  })

  it('sem o valor, o interruptor não aparece e o campo de visão segue igual', () => {
    act(() => root.render(<SceneVisionControls visionCells={4} onVisionCellsChange={vi.fn()} />))
    expect(interruptor('Cena escura')).toBeNull()
    expect(container.querySelector<HTMLInputElement>('#lb-scene-vision')?.value).toBe('4')
  })
})
