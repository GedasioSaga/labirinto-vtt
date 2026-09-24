import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MovementControls } from './MovementControls'

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

function interruptorMundo(): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Mapa-mundi'))
  return label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
}

describe('MovementControls: marca de mapa-mundi (caravana)', () => {
  it('cena comum: interruptor desligado, com a explicação ligada a ele; ligar avisa `true`', () => {
    const onWorldMapChange = vi.fn()
    act(() => root.render(<MovementControls movement={undefined} onMovementChange={vi.fn()} worldMap={false} onWorldMapChange={onWorldMapChange} />))
    const input = interruptorMundo()
    expect(input?.checked).toBe(false)
    const dica = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toContain('uma ficha só')
    act(() => input?.click())
    expect(onWorldMapChange).toHaveBeenCalledWith(true)
  })

  it('cena marcada: ligado; desligar avisa `false`', () => {
    const onWorldMapChange = vi.fn()
    act(() => root.render(<MovementControls movement={undefined} onMovementChange={vi.fn()} worldMap onWorldMapChange={onWorldMapChange} />))
    const input = interruptorMundo()
    expect(input?.checked).toBe(true)
    act(() => input?.click())
    expect(onWorldMapChange).toHaveBeenCalledWith(false)
  })

  it('sem quem grave a marca, o interruptor não aparece', () => {
    act(() => root.render(<MovementControls movement={undefined} onMovementChange={vi.fn()} />))
    expect(interruptorMundo()).toBeNull()
  })
})
